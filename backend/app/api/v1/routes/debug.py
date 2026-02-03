import logging
from datetime import datetime
from fastapi import APIRouter
from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    Error as PlaywrightError,
)
from app.services.browser_manager import browser_manager
from app.services.decodo_proxy import get_decodo_env_info

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/debug/proxy-ip")
async def debug_proxy_ip():
    """
    Uses the Decodo-configured context to check the outward-facing IP.
    """
    if not browser_manager.is_ready:
        started = await browser_manager.start()
        if not started:
            return {"status": "error", "message": "Could not start browser"}

    env_info = get_decodo_env_info()

    async with browser_manager.get_context() as context:
        page = await browser_manager.get_page(context)
        try:
            # Try HTTPS first; fall back to HTTP if the proxy blocks HTTPS
            for url in ("https://ip.decodo.com/json", "http://ip.decodo.com/json"):
                try:
                    await page.goto(url, timeout=30000, wait_until="load")
                    body = await page.text_content("body")
                    break
                except PlaywrightTimeoutError:
                    body = None
                    continue

            if not body:
                return {
                    "status": "error",
                    "message": "Timeout checking IP via proxy (both https and http)",
                    **env_info,
                }
        except PlaywrightError as exc:
            return {
                "status": "error",
                "message": f"Playwright error checking IP: {exc}",
                **env_info,
            }
        finally:
            await page.close()

    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "raw_body": body,
        **env_info,
    }
