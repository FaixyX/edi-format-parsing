import logging
import asyncio
import os
from typing import Optional, Tuple
from playwright.async_api import (
    async_playwright,
    Browser,
    BrowserContext,
    Page,
    Playwright,
)
from contextlib import asynccontextmanager
from app.services.decodo_proxy import build_la_rotating_proxy

logger = logging.getLogger(__name__)


class BrowserManager:
    """
    Singleton browser manager that maintains a warm Chromium browser instance
    and provides browser contexts for requests.
    """

    _instance: Optional["BrowserManager"] = None
    _lock = asyncio.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized"):
            return

        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._is_ready = False
        self._startup_lock = asyncio.Lock()
        self._shutdown_lock = asyncio.Lock()
        self._initialized = True
        self._process_id = os.getpid()
        logger.info(f"BrowserManager instance created in process {self._process_id}")

    async def start(self) -> bool:
        """
        Start the warm browser instance with retry logic.

        Returns:
            True if browser started successfully, False otherwise
        """
        async with self._startup_lock:
            if self._is_ready:
                logger.info(f"Browser is already running in process {self._process_id}")
                return True

            # Get configurable timeout (default 120 seconds for containerized environments)
            launch_timeout = int(os.getenv("PLAYWRIGHT_LAUNCH_TIMEOUT", "120000"))
            max_retries = int(os.getenv("PLAYWRIGHT_LAUNCH_MAX_RETRIES", "3"))

            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(
                        f"Starting warm Chromium browser in process {self._process_id} "
                        f"(attempt {attempt}/{max_retries})..."
                    )

                    # Start Playwright
                    self._playwright = await async_playwright().start()
                    logger.info(f"Playwright started in process {self._process_id}")

                    # Launch browser with optimized settings
                    headless_mode = (
                        os.getenv("PLAYWRIGHT_HEADLESS", "True").lower() == "true"
                    )

                    launch_args = [
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-accelerated-2d-canvas",
                        "--no-first-run",
                        "--no-default-browser-check",
                        "--no-zygote",
                        "--disable-gpu",
                        "--disable-web-security",
                        "--disable-features=VizDisplayCompositor,TranslateUI",
                        "--disable-ipc-flooding-protection",
                        "--disable-background-networking",
                        "--disable-background-timer-throttling",
                        "--disable-backgrounding-occluded-windows",
                        "--disable-renderer-backgrounding",
                        "--disable-extensions",
                        "--disable-plugins",
                        "--disable-sync",
                        "--disable-component-extensions-with-background-pages",
                        "--disable-client-side-phishing-detection",
                        "--disable-default-apps",
                        "--disable-notifications",
                        "--mute-audio",
                        "--metrics-recording-only",
                        "--blink-settings=imagesEnabled=false",  # Avoid fetching images via proxy
                        "--max_old_space_size=512",  # Cap browser memory to 8GB to match worker budget
                        "--disable-software-rasterizer",  # Disable software rasterizer to reduce resource usage
                    ]

                    logger.info(
                        f"Launching Chromium with timeout={launch_timeout}ms in process {self._process_id}"
                    )

                    self._browser = await self._playwright.chromium.launch(
                        slow_mo=0,
                        headless=headless_mode,
                        timeout=launch_timeout,
                        args=launch_args,
                    )

                    logger.info(
                        f"Chromium browser launched successfully in process {self._process_id}"
                    )

                    # Test browser functionality
                    if await self._test_browser_health():
                        self._is_ready = True
                        logger.info(
                            f"Warm browser is ready for requests in process {self._process_id}"
                        )
                        return True
                    else:
                        logger.error(
                            f"Browser health check failed in process {self._process_id}"
                        )
                        await self._cleanup()
                        # Retry if we haven't exhausted attempts
                        if attempt < max_retries:
                            wait_time = 2**attempt  # Exponential backoff: 2s, 4s, 8s
                            logger.info(
                                f"Retrying browser launch in {wait_time} seconds..."
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        return False

                except Exception as e:
                    error_msg = str(e)
                    logger.error(
                        f"Failed to start warm browser in process {self._process_id} "
                        f"(attempt {attempt}/{max_retries}): {error_msg}"
                    )

                    # Check if it's a timeout error
                    if "timeout" in error_msg.lower() or "Timeout" in error_msg:
                        logger.warning(
                            f"Browser launch timed out after {launch_timeout}ms. "
                            f"This may indicate resource constraints in the container."
                        )

                    await self._cleanup()

                    # Retry if we haven't exhausted attempts
                    if attempt < max_retries:
                        wait_time = 2**attempt  # Exponential backoff: 2s, 4s, 8s
                        logger.info(
                            f"Retrying browser launch in {wait_time} seconds..."
                        )
                        await asyncio.sleep(wait_time)
                        continue

                    # Log final failure
                    logger.error(
                        f"Failed to start browser after {max_retries} attempts in process {self._process_id}"
                    )
                    return False

            return False

    async def stop(self):
        """Stop the warm browser instance."""
        async with self._shutdown_lock:
            if not self._is_ready:
                logger.info(f"Browser is not running in process {self._process_id}")
                return

            logger.info(f"Stopping warm browser in process {self._process_id}...")
            await self._cleanup()
            self._is_ready = False
            logger.info(f"Warm browser stopped in process {self._process_id}")

    async def _cleanup(self):
        """Internal cleanup method."""
        try:
            if self._browser:
                # Force cleanup of all browser contexts first
                await self._cleanup_contexts()
                await self._browser.close()
                self._browser = None
                logger.info("Browser closed")
        except Exception as e:
            logger.warning(f"Error closing browser: {str(e)}")

        try:
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None
                logger.info("Playwright stopped")
        except Exception as e:
            logger.warning(f"Error stopping playwright: {str(e)}")

    async def _cleanup_contexts(self):
        """Force cleanup of all browser contexts to prevent memory leaks."""
        if not self._browser:
            return

        try:
            contexts = self._browser.contexts
            logger.info(f"Cleaning up {len(contexts)} browser contexts")

            for context in contexts:
                try:
                    # Close all pages in the context first
                    pages = context.pages
                    for page in pages:
                        try:
                            await page.close()
                        except Exception as e:
                            logger.debug(f"Error closing page: {str(e)}")

                    # Close the context
                    await context.close()
                except Exception as e:
                    logger.warning(f"Error closing context: {str(e)}")

            logger.info("Browser contexts cleaned up successfully")
        except Exception as e:
            logger.warning(f"Error during context cleanup: {str(e)}")

    async def _test_browser_health(self) -> bool:
        """
        Test if the browser is working correctly.

        Returns:
            True if browser is healthy, False otherwise
        """
        try:
            if not self._browser:
                return False

            # Create a test context and page directly (without using the context manager)
            context = await self._browser.new_context()
            try:
                page = await context.new_page()
                try:
                    # Test navigation to a simple page
                    await page.goto(
                        "data:text/html,<html><body>Test</body></html>", timeout=10000
                    )
                    content = await page.content()
                    return "Test" in content
                finally:
                    await page.close()
            finally:
                await context.close()

        except Exception as e:
            logger.error(f"Browser health check failed: {str(e)}")
            return False

    async def _apply_bandwidth_saver(self, context: BrowserContext):
        """
        Reduce bandwidth by blocking unneeded asset types.
        """
        blocked_types = {"image", "media", "font"}

        async def _handle_route(route, request):
            if request.resource_type in blocked_types:
                await route.abort()
            else:
                await route.continue_()

        await context.route("**/*", _handle_route)

    @asynccontextmanager
    async def get_context(self, **context_options):
        """
        Get a browser context for a request. This is a context manager that
        automatically cleans up the context when done.

        Args:
            **context_options: Additional options to pass to new_context()
                Special key:
                - use_proxy (bool, default True): set to False to skip Decodo proxy.
                - bandwidth_saver (bool, default True): block heavy assets (images, media, fonts).

        Yields:
            BrowserContext: A new browser context
        """
        if not self._is_ready or not self._browser:
            raise RuntimeError("Browser is not ready. Call start() first.")

        context = None
        try:
            # Allow caller to disable proxy if needed
            use_proxy = context_options.pop("use_proxy", True)
            bandwidth_saver = context_options.pop("bandwidth_saver", True)

            # Create a new isolated context for this request
            default_options = {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "java_script_enabled": True,  # Enable JavaScript for contexts that need it
            }

            if use_proxy:
                proxy_config = build_la_rotating_proxy()
                default_options["proxy"] = proxy_config

            default_options.update(context_options)

            context = await self._browser.new_context(**default_options)
            if bandwidth_saver:
                await self._apply_bandwidth_saver(context)

            logger.debug(
                "Created new browser context (Decodo proxy = %s, bandwidth saver = %s)",
                use_proxy,
                bandwidth_saver,
            )
            yield context

        except Exception as e:
            logger.error(f"Error in browser context: {str(e)}")
            raise
        finally:
            if context:
                try:
                    await context.close()
                    logger.debug("Closed browser context")
                except Exception as e:
                    logger.warning(f"Error closing context: {str(e)}")

    async def get_page(self, context: BrowserContext) -> Page:
        """
        Create a new page in the given context.

        Args:
            context: The browser context to create the page in

        Returns:
            Page: A new page instance
        """
        page = await context.new_page()
        logger.debug("Created new page in context")
        return page

    async def health_check(self) -> dict:
        """
        Perform a comprehensive health check of the warm browser.

        Returns:
            dict: Health check results
        """
        try:
            if not self._is_ready:
                return {
                    "status": "unhealthy",
                    "message": "Browser is not started",
                    "details": "Browser manager not initialized",
                }

            if not self._browser:
                return {
                    "status": "unhealthy",
                    "message": "Browser instance is None",
                    "details": "Browser object is missing",
                }

            # Test browser connectivity
            if not self._browser.is_connected():
                return {
                    "status": "unhealthy",
                    "message": "Browser is not connected",
                    "details": "Browser process may have crashed",
                }

            # Test context creation and basic functionality
            if await self._test_browser_health():
                return {
                    "status": "healthy",
                    "message": "Warm browser is working correctly",
                    "details": "Browser ready for requests",
                }
            else:
                return {
                    "status": "unhealthy",
                    "message": "Browser health test failed",
                    "details": "Browser not responding to basic operations",
                }

        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            return {
                "status": "unhealthy",
                "message": f"Health check exception: {str(e)}",
                "details": "Unexpected error during health check",
            }

    @property
    def is_ready(self) -> bool:
        """Check if the browser is ready for requests."""
        return self._is_ready and self._browser is not None

    async def restart(self) -> bool:
        """
        Restart the browser instance. Useful for recovery from crashes.

        Returns:
            True if restart was successful, False otherwise
        """
        logger.info("Restarting warm browser...")
        await self.stop()
        return await self.start()


# Global browser manager instance
browser_manager = BrowserManager()
