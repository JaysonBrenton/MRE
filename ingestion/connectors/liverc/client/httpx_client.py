# @fileoverview HTTPX client for LiveRC connector
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description HTTP client with retry logic, timeouts, and anti-bot configuration
# 
# @purpose Provides a shared AsyncClient instance per ingestion session with
#          proper timeout configuration, retry policies, and User-Agent headers
#          per HTTPX client architecture specification.

import asyncio
import random
from typing import Optional

import httpx

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import ConnectorHTTPError

logger = get_logger(__name__)

# User-Agent per specification
USER_AGENT = "MRE-IngestionBot/1.0 (contact: admin@domain.com)"

# Timeout configuration per specification
TIMEOUT_CONFIG = httpx.Timeout(
    connect=5.0,  # 5 seconds
    read=20.0,    # 20 seconds
    write=5.0,    # 5 seconds
    pool=5.0,     # 5 seconds
)

# Total request hard cap: 30 seconds
MAX_REQUEST_TIME = 30.0


class HTTPXClient:
    """
    HTTPX client wrapper with retry logic and proper configuration.
    
    Per specification:
    - One shared AsyncClient per ingestion session
    - Retry policy: 3 retries with exponential backoff
    - Retryable: connection errors, timeouts, 5xx, 429
    - Never retry 4xx errors except 429
    """
    
    def __init__(self):
        """Initialize HTTPX client with proper configuration."""
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self._client = httpx.AsyncClient(
            timeout=TIMEOUT_CONFIG,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
            },
            follow_redirects=True,
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    def _is_retryable(self, status_code: Optional[int], error: Optional[Exception]) -> bool:
        """
        Determine if a request should be retried.
        
        Args:
            status_code: HTTP status code (None if connection error)
            error: Exception if connection error occurred
        
        Returns:
            True if request should be retried
        """
        if error:
            # Connection errors, timeouts are retryable
            return True
        
        if status_code is None:
            return False
        
        # Retry 5xx errors and 429 rate limits
        if status_code >= 500 or status_code == 429:
            return True
        
        # Never retry 4xx errors except 429
        return False
    
    async def get(
        self,
        url: str,
        max_retries: int = 3,
        base_delay: float = 0.5,
    ) -> httpx.Response:
        """
        GET request with retry logic.
        
        Args:
            url: URL to fetch
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds for exponential backoff
        
        Returns:
            HTTP response
        
        Raises:
            ConnectorHTTPError: On non-retryable failures or after max retries
        """
        if not self._client:
            raise RuntimeError("HTTPXClient must be used as async context manager")
        
        last_error: Optional[Exception] = None
        last_status: Optional[int] = None
        
        for attempt in range(max_retries + 1):
            try:
                logger.debug("httpx_request", url=url, attempt=attempt + 1, max_retries=max_retries + 1)
                
                response = await self._client.get(url)
                last_status = response.status_code
                
                # Check if we should retry
                if response.is_success or not self._is_retryable(response.status_code, None):
                    return response
                
                # Retryable error - log and wait
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 0.1)  # Jitter
                    logger.warning(
                        "httpx_retry",
                        url=url,
                        status_code=response.status_code,
                        attempt=attempt + 1,
                        delay=delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                
                # Max retries reached
                raise ConnectorHTTPError(
                    f"Request failed after {max_retries + 1} attempts",
                    status_code=response.status_code,
                    url=url,
                )
            
            except httpx.TimeoutException as e:
                last_error = e
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 0.1)
                    logger.warning(
                        "httpx_retry_timeout",
                        url=url,
                        attempt=attempt + 1,
                        delay=delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise ConnectorHTTPError(
                    f"Request timed out after {max_retries + 1} attempts",
                    url=url,
                )
            
            except httpx.RequestError as e:
                last_error = e
                if attempt < max_retries:
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 0.1)
                    logger.warning(
                        "httpx_retry_error",
                        url=url,
                        error=str(e),
                        attempt=attempt + 1,
                        delay=delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise ConnectorHTTPError(
                    f"Request failed: {str(e)}",
                    url=url,
                )
        
        # Should not reach here, but handle edge case
        raise ConnectorHTTPError(
            f"Request failed after {max_retries + 1} attempts",
            status_code=last_status,
            url=url,
        )

