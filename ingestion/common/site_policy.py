"""Shared site policy enforcement for external scraping.

Loads repo-level policy configuration (JSON) and enforces:
- Kill switch env flag
- Robots.txt allow/disallow + crawl-delay detection
- Per-host throttling / crawl-delay enforcement with jitter
- Conditional request caching (ETag / Last-Modified)
- Retry-After header honoring
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse
from urllib import robotparser

import httpx

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.ingestion.errors import ConnectorError

logger = get_logger(__name__)

_DEFAULT_POLICY_PATH = Path(__file__).resolve().parents[2] / "policies" / "site_policy" / "policy.json"
_POLICY_PATH = Path(os.getenv("SITE_POLICY_PATH", str(_DEFAULT_POLICY_PATH)))
_USER_AGENT = "MRE-IngestionBot/1.0 (contact: admin@domain.com)"


class ScrapingDisabledError(ConnectorError):
    """Raised when scraping has been disabled via kill switch."""

    def __init__(self, source: str = "external"):
        super().__init__(
            f"Scraping for {source} is currently disabled. Set MRE_SCRAPE_ENABLED=true to re-enable.",
            "SCRAPING_DISABLED",
            {"source": source},
        )


class RobotsDisallowedError(ConnectorError):
    """Raised when robots.txt disallows the request."""

    def __init__(self, url: str):
        super().__init__(
            f"Robots policy disallows fetching {url}",
            "ROBOTS_DISALLOWED",
            {"url": url},
        )


@dataclass
class HostRule:
    pattern: str
    crawl_delay: float
    max_concurrency: int
    respect_robots: bool
    conditional_requests: bool


@dataclass
class _HostState:
    semaphore: asyncio.Semaphore
    last_request_ts: float = 0.0


class SitePolicy:
    """Framework-agnostic policy helper shared by scraping paths."""

    _shared: Optional["SitePolicy"] = None

    def __init__(self, policy_path: Path = _POLICY_PATH):
        self._policy_path = policy_path
        self._config = self._load_config()
        self._kill_switch_env = self._config.get("killSwitchEnv", "MRE_SCRAPE_ENABLED")
        self._host_rules = [
            HostRule(
                pattern=item.get("pattern", "*"),
                crawl_delay=float(item.get("crawlDelaySeconds", 1.0)),
                max_concurrency=int(item.get("maxConcurrency", 1)),
                respect_robots=bool(item.get("respectRobots", True)),
                conditional_requests=bool(item.get("conditionalRequests", False)),
            )
            for item in self._config.get("hosts", [])
        ]
        self._robots_cache: Dict[str, robotparser.RobotFileParser] = {}
        self._robots_delay: Dict[str, float] = {}
        self._host_state: Dict[str, _HostState] = {}
        self._conditional_cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._conditional_cache_max = max(0, int(os.getenv("SITE_POLICY_CACHE_MAX", "256")))
        # Track hosts that don't have robots.txt (404) - per spec, these allow all paths
        self._no_robots_hosts: set[str] = set()

    @classmethod
    def shared(cls) -> "SitePolicy":
        if cls._shared is None:
            cls._shared = cls()
        return cls._shared

    def _load_config(self) -> Dict[str, Any]:
        if not self._policy_path.exists():
            logger.error(
                "site_policy_config_missing",
                path=str(self._policy_path),
                message="Set SITE_POLICY_PATH or mount policies/site_policy/policy.json inside the container.",
            )
            raise FileNotFoundError(
                f"Site policy configuration not found at {self._policy_path}."
                " Set SITE_POLICY_PATH or ensure policies/site_policy/policy.json is available."
            )
        with self._policy_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _match_rule(self, host: str) -> HostRule:
        for rule in self._host_rules:
            pattern = rule.pattern
            if pattern.startswith("*."):
                suffix = pattern[1:]
                if host.endswith(suffix):
                    return rule
            elif host == pattern:
                return rule
        # Default catch-all
        return HostRule(pattern="*", crawl_delay=1.0, max_concurrency=1, respect_robots=True, conditional_requests=False)

    def _host_sem(self, host: str, max_concurrency: int) -> asyncio.Semaphore:
        state = self._host_state.get(host)
        if not state:
            state = _HostState(semaphore=asyncio.Semaphore(max(1, max_concurrency)))
            self._host_state[host] = state
        return state.semaphore

    def _get_state(self, host: str, max_concurrency: int) -> _HostState:
        state = self._host_state.get(host)
        if not state:
            state = _HostState(semaphore=asyncio.Semaphore(max(1, max_concurrency)))
            self._host_state[host] = state
        return state

    def is_enabled(self) -> bool:
        flag = os.getenv(self._kill_switch_env, "true").strip().lower()
        return flag not in {"0", "false", "off", "no"}

    def ensure_enabled(self, source: str = "external") -> None:
        if not self.is_enabled():
            metrics.record_site_policy_event("disabled", host=source)
            raise ScrapingDisabledError(source)

    async def _fetch_robots(self, host: str) -> robotparser.RobotFileParser:
        # If we've already determined this host has no robots.txt, return a parser that allows all
        if host in self._no_robots_hosts:
            parser = robotparser.RobotFileParser()
            parser.set_url(f"https://{host}/robots.txt")
            # Parse an empty robots.txt which allows all paths
            parser.parse([])
            return parser
        
        parser = self._robots_cache.get(host)
        if parser:
            return parser
        robots_url = f"https://{host}/robots.txt"
        parser = robotparser.RobotFileParser()
        parser.set_url(robots_url)
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(robots_url)
                # Per robots.txt spec: if robots.txt doesn't exist (404), all paths are allowed
                if response.status_code == 404:
                    logger.debug("robots_not_found", host=host, url=robots_url, message="robots.txt not found - allowing all paths per spec")
                    # Mark this host as having no robots.txt
                    self._no_robots_hosts.add(host)
                    # Parse an empty robots.txt which allows all paths
                    parser.parse([])
                else:
                    response.raise_for_status()
                    parser.parse(response.text.splitlines())
                    logger.debug("robots_loaded", host=host, url=robots_url)
        except httpx.HTTPStatusError as exc:
            # Handle other HTTP errors
            if exc.response.status_code == 404:
                logger.debug("robots_not_found", host=host, url=robots_url, message="robots.txt not found - allowing all paths per spec")
                self._no_robots_hosts.add(host)
                parser.parse([])
            else:
                logger.warning("robots_load_failed", host=host, error=str(exc), status_code=exc.response.status_code)
                # On other HTTP errors, allow all (fail open)
                parser.parse([])
        except Exception as exc:  # pragma: no cover - network failure fallback
            logger.warning("robots_load_failed", host=host, error=str(exc))
            # On network errors, allow all (fail open)
            parser.parse([])
        self._robots_cache[host] = parser
        delay = parser.crawl_delay(_USER_AGENT) or parser.crawl_delay("*")
        if delay:
            self._robots_delay[host] = float(delay)
        return parser
    
    async def ensure_allowed(self, url: str) -> None:
        host = urlparse(url).netloc
        rule = self._match_rule(host)
        if not rule.respect_robots:
            return
        # Per robots.txt spec: if robots.txt doesn't exist (404), all paths are allowed
        if host in self._no_robots_hosts:
            return
        parser = await self._fetch_robots(host)
        path = urlparse(url).path or "/"
        allowed = parser.can_fetch(_USER_AGENT, path)
        if not allowed:
            metrics.record_site_policy_event("robots_block", host=host)
            raise RobotsDisallowedError(url)

    def retry_after_seconds(self, response: httpx.Response) -> Optional[float]:
        retry_after = response.headers.get("Retry-After")
        if not retry_after:
            return None
        try:
            seconds = float(retry_after)
            return min(seconds, 60.0)
        except ValueError:
            return None

    def _conditional_enabled(self, host: str) -> bool:
        return self._match_rule(host).conditional_requests

    def build_conditional_headers(self, url: str) -> Dict[str, str]:
        host = urlparse(url).netloc
        if not self._conditional_enabled(host):
            return {}
        cached = self._conditional_cache.get(url)
        if not cached:
            return {}
        headers: Dict[str, str] = {}
        if cached.get("etag"):
            headers["If-None-Match"] = cached["etag"]
        if cached.get("last_modified"):
            headers["If-Modified-Since"] = cached["last_modified"]
        return headers

    def record_success(self, url: str, response: httpx.Response) -> None:
        host = urlparse(url).netloc
        if not self._conditional_enabled(host):
            return
        if self._conditional_cache_max == 0:
            return
        cache_entry = {
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
            "body": response.content,
            "encoding": response.encoding,
            "headers": dict(response.headers),
        }
        if cache_entry["etag"] or cache_entry["last_modified"]:
            # Maintain insertion order for LRU semantics
            if url in self._conditional_cache:
                self._conditional_cache.pop(url)
            self._conditional_cache[url] = cache_entry
            while (
                self._conditional_cache_max > 0
                and len(self._conditional_cache) > self._conditional_cache_max
            ):
                self._conditional_cache.popitem(last=False)

    def maybe_use_cached(self, url: str, response: httpx.Response) -> httpx.Response:
        if response.status_code != 304:
            return response
        cached = self._conditional_cache.get(url)
        if not cached or not cached.get("body"):
            return response
        # Refresh LRU order so frequently used pages stay cached
        self._conditional_cache.move_to_end(url)
        new_headers = cached.get("headers") or {}
        new_response = httpx.Response(
            status_code=200,
            content=cached["body"],
            headers=new_headers,
            request=response.request,
        )
        if cached.get("encoding"):
            new_response.encoding = cached["encoding"]
        metrics.record_site_policy_event("cache_hit", host=urlparse(url).netloc)
        return new_response

    @asynccontextmanager
    async def throttle(self, url: str):
        host = urlparse(url).netloc
        rule = self._match_rule(host)
        state = self._get_state(host, rule.max_concurrency)
        await state.semaphore.acquire()
        try:
            min_delay = max(rule.crawl_delay, self._robots_delay.get(host, 0.0))
            now = time.perf_counter()
            wait_for = state.last_request_ts + min_delay - now
            if wait_for > 0:
                await asyncio.sleep(wait_for)
            yield
            state.last_request_ts = time.perf_counter()
        finally:
            state.semaphore.release()


__all__ = [
    "SitePolicy",
    "ScrapingDisabledError",
    "RobotsDisallowedError",
]
