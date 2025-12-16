# @fileoverview Playwright client for LiveRC connector browser fallback
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Browser automation client for pages requiring JavaScript
# 
# @purpose Provides Playwright-based browser automation for LiveRC pages
#          that require JavaScript execution. Used only when HTTPX fails
#          to extract required content.

from typing import Optional

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    Playwright,
    async_playwright,
    TimeoutError as PlaywrightTimeoutError,
)

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import ConnectorHTTPError, RacePageFormatError

logger = get_logger(__name__)

# User-Agent matching HTTPX client
USER_AGENT = "MRE-IngestionBot/1.0 (contact: admin@domain.com)"


class PlaywrightClient:
    """
    Playwright browser client for dynamic content extraction.
    
    Per specification:
    - Headless Chromium instance
    - Realistic User-Agent
    - Wait for specific selectors before extraction
    - Close browser context after scraping one page
    """
    
    def __init__(self):
        """Initialize Playwright client."""
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
    
    async def fetch_page(
        self,
        url: str,
        wait_for_selector: Optional[str] = None,
        timeout: int = 30000,  # 30 seconds default
    ) -> str:
        """
        Fetch page HTML using Playwright.
        
        Args:
            url: URL to fetch
            wait_for_selector: CSS selector to wait for before extracting HTML
            timeout: Maximum wait time in milliseconds
        
        Returns:
            Page HTML content
        
        Raises:
            ConnectorHTTPError: On navigation or timeout errors
            RacePageFormatError: If required selector is not found
        """
        if not self._browser:
            raise RuntimeError("PlaywrightClient must be used as async context manager")
        
        context: Optional[BrowserContext] = None
        page: Optional[Page] = None
        
        try:
            # Create new context for each page (per specification)
            context = await self._browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1920, "height": 1080},
            )
            
            page = await context.new_page()
            
            logger.debug("playwright_navigate", url=url)
            
            # Navigate to page
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
            
            # Wait for specific selector if provided
            if wait_for_selector:
                try:
                    logger.debug("playwright_wait_selector", selector=wait_for_selector)
                    await page.wait_for_selector(wait_for_selector, timeout=timeout)
                except PlaywrightTimeoutError:
                    raise RacePageFormatError(
                        f"Required selector '{wait_for_selector}' not found on page",
                        url=url,
                    )
            
            # Wait a bit for any remaining JS to execute
            await page.wait_for_timeout(1000)  # 1 second
            
            # Extract final DOM state
            html = await page.content()
            
            logger.debug("playwright_success", url=url, html_length=len(html))
            
            return html
        
        except PlaywrightTimeoutError as e:
            raise ConnectorHTTPError(
                f"Playwright timeout while fetching {url}",
                url=url,
            )
        
        except Exception as e:
            logger.error("playwright_error", url=url, error=str(e))
            raise ConnectorHTTPError(
                f"Playwright error: {str(e)}",
                url=url,
            )
        
        finally:
            # Clean up context (closes all pages)
            if context:
                await context.close()

