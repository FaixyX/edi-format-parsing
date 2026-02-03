#!/usr/bin/env python3
"""
Simple test script to verify Playwright is working correctly.
This script will open a browser, navigate to a test URL, and take a screenshot.
"""
import os

import asyncio
from playwright.async_api import async_playwright


async def test_playwright():
    """Test Playwright functionality"""
    print("Starting Playwright test...")

    async with async_playwright() as p:
        # Launch browser with container-optimized settings
        # Set headless=False for development, True for production
        headless_mode = os.getenv("PLAYWRIGHT_HEADLESS", "True").lower() == "true"

        browser = await p.chromium.launch(
            headless=headless_mode,  # Configurable headless mode
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--disable-features=TranslateUI",
                "--disable-ipc-flooding-protection",
            ],
        )

        try:
            # Create a new page with 1080p viewport
            page = await browser.new_page()
            await page.set_viewport_size({"width": 1920, "height": 1080})

            # Navigate to a test URL
            test_url = "https://www.google.com"
            print(f"Navigating to: {test_url}")
            await page.goto(test_url)

            # Wait for 3 seconds to see what's happening
            print("Waiting 3 seconds to observe the page...")
            await asyncio.sleep(3)

            # Take a screenshot for debugging
            screenshot_path = "test_playwright_screenshot.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved as {screenshot_path}")

            # Wait another 3 seconds before closing
            print("Waiting another 3 seconds before closing...")
            await asyncio.sleep(3)

            print("Playwright test completed successfully!")

        except Exception as e:
            print(f"Error during Playwright test: {str(e)}")
            raise
        finally:
            # Close the browser
            await browser.close()


if __name__ == "__main__":
    asyncio.run(test_playwright())
