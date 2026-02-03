import logging
import subprocess
import sys
import os
import csv
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union, Callable, Coroutine
from datetime import datetime, date
from uuid import UUID
from playwright.async_api import (
    async_playwright,
    Browser,
    Page,
    BrowserContext,
    Locator,
)
import asyncio
import re

from sqlalchemy import true
from app.services.browser_manager import browser_manager
from app.services.exceptions import PlaywrightError
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@contextmanager
def get_db_session():
    """Context manager for database sessions to ensure proper cleanup"""
    from app.db.session import get_db

    db = next(get_db())
    try:
        yield db
    finally:
        db.close()


class PlaywrightBotService:
    """
    Service for interacting with medical websites using Playwright.
    This is a placeholder that will be implemented later.
    """

    @staticmethod
    def _ensure_browsers_installed():
        """Ensure Playwright browsers are installed"""
        try:
            # Try to import playwright to check if it's available
            from playwright.async_api import async_playwright

            logger.info("Playwright is available")
            return True
        except Exception as e:
            logger.warning(f"Playwright not available: {e}")
            return False

    @staticmethod
    async def _copy_session_data(source_page: Page, target_page: Page) -> bool:
        """
        Copy session data (cookies, localStorage, sessionStorage) from source page to target page.

        Args:
            source_page: The page with the active session
            target_page: The page to copy session data to

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info("Copying session data between pages...")

            # Get cookies from source page
            cookies = await source_page.context.cookies()
            if cookies:
                await target_page.context.add_cookies(cookies)
                logger.info(f"Copied {len(cookies)} cookies")

            # Copy localStorage
            try:
                localStorage = await source_page.evaluate(
                    "() => Object.entries(localStorage)"
                )
                if localStorage:
                    for key, value in localStorage:
                        await target_page.evaluate(
                            f"localStorage.setItem('{key}', '{value}')"
                        )
                    logger.info(f"Copied {len(localStorage)} localStorage items")
            except Exception as e:
                logger.debug(f"Could not copy localStorage: {str(e)}")

            # Copy sessionStorage
            try:
                sessionStorage = await source_page.evaluate(
                    "() => Object.entries(sessionStorage)"
                )
                if sessionStorage:
                    for key, value in sessionStorage:
                        await target_page.evaluate(
                            f"sessionStorage.setItem('{key}', '{value}')"
                        )
                    logger.info(f"Copied {len(sessionStorage)} sessionStorage items")
            except Exception as e:
                logger.debug(f"Could not copy sessionStorage: {str(e)}")

            logger.info("Session data copied successfully")
            return True

        except Exception as e:
            logger.error(f"Error copying session data: {str(e)}")
            return False

    @staticmethod
    async def _create_page_with_session(
        context: BrowserContext, source_page: Page
    ) -> Page:
        """
        Create a new page with session data copied from the source page.

        Args:
            context: The browser context to create the page in
            source_page: The page with the active session

        Returns:
            New page with session data copied
        """
        try:
            # Create new page in the context
            new_page = await context.new_page()
            logger.info("Created new page in context")

            # Copy session data
            await PlaywrightBotService._copy_session_data(source_page, new_page)

            return new_page

        except Exception as e:
            logger.error(f"Error creating page with session: {str(e)}")
            raise e

    @staticmethod
    def _is_synergyemr_domain(agency_link: str) -> bool:
        """
        Check if the agency link contains synergyemr.net domain.

        Args:
            agency_link: The agency URL to check

        Returns:
            True if the URL contains synergyemr.net, False otherwise
        """
        return "synergyemr.net" in agency_link.lower()

    @staticmethod
    async def _navigate_and_login(
        page: Page,
        agency_link: str,
        agency_username: str,
        agency_password: str,
        agency_id: str = None,
        force_login: bool = False,
        update_credentials_status: bool = True,
    ) -> bool:
        """
        Navigate to the agency link and perform login.

        Args:
            page: The Playwright page object
            agency_link: The URL of the medical website
            agency_username: The username for the medical website
            agency_password: The password for the medical website
            agency_id: The agency ID to check credentials flag and update on failure

        Returns:
            True if login successful, False otherwise
        """
        try:
            from app.services.agency_service import get_agency

            # Navigate to the agency link
            logger.info(f"Navigating to: {agency_link}")
            await page.goto(
                agency_link,
                wait_until="domcontentloaded",
                timeout=150000,  # Increased from 100000ms to 150000ms for slower connections
            )
            logger.info("Navigation completed")

            # Wait for the login form to be visible
            logger.info("Waiting for login form...")
            await page.wait_for_selector(
                "#txtUserName", timeout=150000
            )  # Increased from 100000ms to 150000ms
            logger.info("Login form found")

            # Fill in the username
            logger.info("Filling username")
            await page.fill("#txtUserName", agency_username)

            # Fill in the password
            logger.info("Filling password")
            await page.fill("#txtPassword", agency_password)

            # Click the login button
            logger.info("Clicking login button")
            await page.click("#btnLogin")

            # Wait for login to complete by checking for either success or failure indicators
            logger.info("Waiting for login to complete...")
            try:
                # Wait for either the main dashboard to load or an error message
                await page.wait_for_selector(
                    "a.ts__links[href='IntakeList.aspx?all=1'], .error-message, #txtUserName, #divAlert",
                    timeout=30000,  # Increased from 15000ms to 30000ms for slower connections
                )

                # Check if we're still on login page (login failed)
                login_form = await page.locator("#txtUserName").count()
                if login_form > 0:
                    logger.error("Login failed - still on login page")
                    try:
                        # Check for specific error message
                        error_div = await page.locator("#divAlert").count()
                        if error_div > 0:
                            error_text = await page.locator("#divAlert").text_content()
                            # Note: Not logging full error text to protect potential sensitive info
                            logger.error("Login error message present on page")
                            logger.error(
                                "Invalid credentials detected - checking if should flag agency"
                            )
                            if (
                                agency_id
                                and update_credentials_status
                                and PlaywrightBotService._is_synergyemr_domain(
                                    agency_link
                                )
                            ):
                                # Update agency credentials status only for synergyemr.net domains
                                try:
                                    from app.services.agency_service import (
                                        update_agency_credentials_status,
                                    )

                                    with get_db_session() as db:
                                        try:
                                            update_agency_credentials_status(
                                                db, agency_id, True
                                            )
                                            logger.info(
                                                f"Agency {agency_id} credentials flagged as invalid (synergyemr.net domain)"
                                            )
                                        except Exception as e:
                                            logger.error(
                                                f"Failed to update agency credentials status: {str(e)}"
                                            )
                                        return False
                                except Exception as e:
                                    logger.error(
                                        f"Could not update agency credentials status: {str(e)}"
                                    )
                            elif agency_id and update_credentials_status:
                                logger.info(
                                    f"Agency {agency_id} login failed but not flagging credentials (non-synergyemr.net domain)"
                                )
                    except Exception as e:
                        logger.warning(
                            f"Could not check for specific error message: {str(e)}"
                        )

                    return False

                logger.info("Login completed successfully")
                return True

            except Exception as e:
                logger.warning(f"Login wait timeout: {str(e)}")
                # Continue anyway, let the navigation handle any issues
                return True

        except Exception as e:
            logger.error(f"Error during navigation and login: {str(e)}")
            return False

    @staticmethod
    async def _handle_popup_dialog(page: Page) -> bool:
        """
        Handle any popup dialogs that might appear after login.

        Args:
            page: The Playwright page object

        Returns:
            True if popup was handled, False if no popup found
        """
        try:
            # Check for multiple types of popups with shorter timeout
            popup_selectors = [
                "div.ui-dialog[aria-describedby='dialog-show-message']",  # AI Subscription popup
                "#aiLandingMainDivContainer",  # AI Landing popup
            ]

            popup_found = False
            popup_selector = None

            for selector in popup_selectors:
                try:
                    await page.wait_for_selector(selector, timeout=3000)
                    popup_found = True
                    popup_selector = selector
                    logger.info(f"Found popup with selector: {selector}")
                    break
                except:
                    logger.debug(f"No popup found with selector: {selector}")
                    continue

            # Additional check for any dialog-like elements that might be popups
            if not popup_found:
                try:
                    # Check for any ui-dialog elements that might be popups
                    dialog_elements = await page.locator("div.ui-dialog").count()
                    if dialog_elements > 0:
                        logger.info(
                            f"Found {dialog_elements} ui-dialog elements, checking if any are popups..."
                        )
                        # Check if any of these dialogs are visible and might be popups
                        for i in range(dialog_elements):
                            dialog = page.locator("div.ui-dialog").nth(i)
                            is_visible = await dialog.is_visible()
                            if is_visible:
                                # Check if this is the AI Subscription dialog
                                # by checking for aria-describedby='dialog-show-message'
                                try:
                                    aria_describedby = await dialog.get_attribute(
                                        "aria-describedby"
                                    )
                                    if aria_describedby == "dialog-show-message":
                                        logger.info(
                                            f"Found AI Subscription dialog (ui-dialog element {i})"
                                        )
                                        popup_found = True
                                        popup_selector = "div.ui-dialog[aria-describedby='dialog-show-message']"
                                        break
                                except:
                                    pass

                                # Also check for "AI Subscription" title
                                try:
                                    title_element = dialog.locator(
                                        ".ui-dialog-title:has-text('AI Subscription')"
                                    )
                                    if await title_element.count() > 0:
                                        logger.info(
                                            f"Found AI Subscription dialog by title (ui-dialog element {i})"
                                        )
                                        popup_found = True
                                        popup_selector = "div.ui-dialog[aria-describedby='dialog-show-message']"
                                        break
                                except:
                                    pass

                                # If no specific match, treat as generic popup
                                logger.info(
                                    f"Found visible ui-dialog element {i}, treating as popup"
                                )
                                popup_found = True
                                popup_selector = "div.ui-dialog"
                                break
                except Exception as e:
                    logger.debug(f"Error checking for additional popups: {str(e)}")

            if not popup_found:
                # No popup found, return early
                return False

            # Handle AI Subscription popup
            if (
                popup_selector
                == "div.ui-dialog[aria-describedby='dialog-show-message']"
            ):
                logger.info("AI Subscription popup detected, closing it...")
                return await PlaywrightBotService._close_ai_subscription_popup(page)

            # Handle AI Landing popup
            elif popup_selector == "#aiLandingMainDivContainer":
                logger.info("AI Landing popup detected, closing it...")
                return await PlaywrightBotService._close_ai_landing_popup(page)

            # Handle generic ui-dialog popup
            elif popup_selector == "div.ui-dialog":
                logger.info("Generic ui-dialog popup detected, closing it...")
                return await PlaywrightBotService._close_generic_dialog_popup(page)

            return False

        except Exception as e:
            logger.warning(f"Error handling popup: {str(e)}")
            return False

    @staticmethod
    async def _close_ai_subscription_popup(page: Page) -> bool:
        """
        Close the AI Subscription popup using multiple strategies.
        Handles dialogs with title "AI Subscription" and aria-describedby='dialog-show-message'.

        Args:
            page: The Playwright page object

        Returns:
            True if popup was closed successfully, False otherwise
        """
        try:
            # Try to find the popup using multiple selectors
            popup_selector = "div.ui-dialog[aria-describedby='dialog-show-message']"
            popup_exists = await page.locator(popup_selector).count() > 0

            # Also check for dialog with "AI Subscription" title if first selector doesn't match
            if not popup_exists:
                try:
                    # Look for any ui-dialog with "AI Subscription" title
                    all_dialogs = page.locator("div.ui-dialog")
                    dialog_count = await all_dialogs.count()
                    for i in range(dialog_count):
                        dialog = all_dialogs.nth(i)
                        if await dialog.is_visible():
                            title = dialog.locator(
                                ".ui-dialog-title:has-text('AI Subscription')"
                            )
                            if await title.count() > 0:
                                popup_exists = True
                                logger.info("Found AI Subscription popup by title")
                                break
                except Exception as e:
                    logger.debug(f"Error checking for AI Subscription title: {str(e)}")

            if not popup_exists:
                return False

            # Try multiple strategies to close the popup
            close_successful = False

            # Strategy 1: Try to click the OK button in the buttonpane (most reliable)
            try:
                ok_button = page.locator(
                    "div.ui-dialog-buttonpane button.ui-button:has-text('Ok')"
                )
                if await ok_button.count() > 0:
                    await ok_button.click()
                    logger.info(
                        "Clicked OK button on AI Subscription popup (strategy 1)"
                    )
                    close_successful = True
            except Exception as e:
                logger.debug(f"Strategy 1 failed: {str(e)}")

            # Strategy 2: Try OK button with span.ui-button-text containing 'Ok'
            if not close_successful:
                try:
                    ok_button = page.locator(
                        "div.ui-dialog-buttonpane button:has(span.ui-button-text:has-text('Ok'))"
                    )
                    if await ok_button.count() > 0:
                        await ok_button.click()
                        logger.info(
                            "Clicked OK button on AI Subscription popup (strategy 2)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 2 failed: {str(e)}")

            # Strategy 3: Try alternative OK button selector (without ui-button class requirement)
            if not close_successful:
                try:
                    alt_ok_button = page.locator(
                        "div.ui-dialog-buttonpane button:has-text('Ok')"
                    )
                    if await alt_ok_button.count() > 0:
                        await alt_ok_button.click()
                        logger.info(
                            "Clicked OK button on AI Subscription popup (strategy 3)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 3 failed: {str(e)}")

            # Strategy 4: Try to click the close button (X) with exact selector from HTML
            if not close_successful:
                try:
                    close_button = page.locator(
                        "div.ui-dialog-titlebar button.ui-dialog-titlebar-close"
                    )
                    if await close_button.count() > 0:
                        await close_button.click()
                        logger.info(
                            "Clicked close button on AI Subscription popup (strategy 4)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 4 failed: {str(e)}")

            # Strategy 5: Try alternative close button selector
            if not close_successful:
                try:
                    alt_close_button = page.locator(
                        "div.ui-dialog-titlebar button.ui-button-icon-only"
                    )
                    if await alt_close_button.count() > 0:
                        await alt_close_button.click()
                        logger.info(
                            "Clicked close button on AI Subscription popup (strategy 5)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 5 failed: {str(e)}")

            # Strategy 6: Try to click close button with closethick icon
            if not close_successful:
                try:
                    close_icon_button = page.locator(
                        "div.ui-dialog-titlebar button:has(span.ui-icon-closethick)"
                    )
                    if await close_icon_button.count() > 0:
                        await close_icon_button.click()
                        logger.info(
                            "Clicked close button on AI Subscription popup (strategy 6)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 6 failed: {str(e)}")

            # Strategy 7: Try to press Escape key
            if not close_successful:
                try:
                    await page.keyboard.press("Escape")
                    logger.info(
                        "Pressed Escape key to close AI Subscription popup (strategy 7)"
                    )
                    close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 7 failed: {str(e)}")

            if not close_successful:
                logger.warning("All AI Subscription popup closing strategies failed")
                return False

            # Wait a bit for the dialog to close
            await page.wait_for_timeout(1000)

            # Verify the popup is actually closed
            popup_exists = await page.locator(popup_selector).count() > 0
            if popup_exists:
                # Double check by looking for visible dialogs with AI Subscription title
                try:
                    all_dialogs = page.locator("div.ui-dialog")
                    dialog_count = await all_dialogs.count()
                    for i in range(dialog_count):
                        dialog = all_dialogs.nth(i)
                        if await dialog.is_visible():
                            title = dialog.locator(
                                ".ui-dialog-title:has-text('AI Subscription')"
                            )
                            if await title.count() > 0:
                                logger.warning(
                                    "AI Subscription popup still exists after attempting to close it"
                                )
                                return False
                except:
                    pass

                logger.warning(
                    "AI Subscription popup still exists after attempting to close it"
                )
                return False
            else:
                logger.info("AI Subscription popup successfully closed")
                return True

        except Exception as e:
            logger.warning(f"Error closing AI Subscription popup: {str(e)}")
            return False

    @staticmethod
    async def _close_ai_landing_popup(page: Page) -> bool:
        """
        Close the AI Landing popup using multiple strategies.

        Args:
            page: The Playwright page object

        Returns:
            True if popup was closed successfully, False otherwise
        """
        try:
            popup_selector = "#aiLandingMainDivContainer"
            popup_exists = await page.locator(popup_selector).count() > 0

            if not popup_exists:
                return False

            # Try multiple strategies to close the popup
            close_successful = False

            # Strategy 1: Try to click the close button (X) with exact classes from HTML
            try:
                close_button = page.locator(
                    "#aiLandingHeader button.ui-button.ui-widget.ui-state-default.ui-corner-all.ui-button-icon-only.ui-dialog-titlebar-close"
                )
                if await close_button.count() > 0:
                    await close_button.click()
                    logger.info(
                        "Clicked close button on AI Landing popup (strategy 1 - exact classes)"
                    )
                    close_successful = True
            except Exception as e:
                logger.debug(f"Strategy 1 failed: {str(e)}")

            # Strategy 2: Try to click the close button with partial classes
            if not close_successful:
                try:
                    close_button = page.locator(
                        "#aiLandingHeader button.ui-dialog-titlebar-close"
                    )
                    if await close_button.count() > 0:
                        await close_button.click()
                        logger.info(
                            "Clicked close button on AI Landing popup (strategy 2 - partial classes)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 2 failed: {str(e)}")

            # Strategy 3: Try alternative close button selector with icon-only class
            if not close_successful:
                try:
                    alt_close_button = page.locator(
                        "#aiLandingHeader button.ui-button-icon-only"
                    )
                    if await alt_close_button.count() > 0:
                        await alt_close_button.click()
                        logger.info(
                            "Clicked close button on AI Landing popup (strategy 3 - icon-only)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 3 failed: {str(e)}")

            # Strategy 4: Try to click any close button in the popup container
            if not close_successful:
                try:
                    any_close_button = page.locator(
                        "#aiLandingMainDivContainer button.ui-dialog-titlebar-close"
                    )
                    if await any_close_button.count() > 0:
                        await any_close_button.click()
                        logger.info(
                            "Clicked close button on AI Landing popup (strategy 4 - any in container)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 4 failed: {str(e)}")

            # Strategy 5: Try to click any button with close icon in the popup
            if not close_successful:
                try:
                    close_icon_button = page.locator(
                        "#aiLandingMainDivContainer button:has(.ui-icon-closethick)"
                    )
                    if await close_icon_button.count() > 0:
                        await close_icon_button.click()
                        logger.info(
                            "Clicked close button on AI Landing popup (strategy 5 - close icon)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 5 failed: {str(e)}")

            # Strategy 6: Try to press Escape key as final fallback
            if not close_successful:
                try:
                    await page.keyboard.press("Escape")
                    logger.info(
                        "Pressed Escape key to close AI Landing popup (strategy 6 - escape)"
                    )
                    close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 6 failed: {str(e)}")

            if not close_successful:
                logger.warning("All AI Landing popup closing strategies failed")
                return False

            await page.wait_for_timeout(1000)
            popup_exists = await page.locator(popup_selector).count() > 0
            if popup_exists:
                logger.warning(
                    "AI Landing popup still exists after attempting to close it"
                )
                return False
            else:
                logger.info("AI Landing popup successfully closed")
                return True

        except Exception as e:
            logger.warning(f"Error closing AI Landing popup: {str(e)}")
            return False

    @staticmethod
    async def _close_generic_dialog_popup(page: Page) -> bool:
        """
        Close a generic ui-dialog popup using multiple strategies.

        Args:
            page: The Playwright page object

        Returns:
            True if popup was closed successfully, False otherwise
        """
        try:
            popup_selector = "div.ui-dialog"
            popup_exists = await page.locator(popup_selector).count() > 0

            if not popup_exists:
                return False

            # Try multiple strategies to close the popup
            close_successful = False

            # Strategy 1: Try to click the close button (X) in the titlebar
            try:
                close_button = page.locator(
                    "div.ui-dialog-titlebar button.ui-dialog-titlebar-close"
                )
                if await close_button.count() > 0:
                    await close_button.click()
                    logger.info(
                        "Clicked close button on generic dialog popup (strategy 1)"
                    )
                    close_successful = True
            except Exception as e:
                logger.debug(f"Strategy 1 failed: {str(e)}")

            # Strategy 2: Try alternative close button selector
            if not close_successful:
                try:
                    alt_close_button = page.locator(
                        "div.ui-dialog-titlebar button.ui-button-icon-only"
                    )
                    if await alt_close_button.count() > 0:
                        await alt_close_button.click()
                        logger.info(
                            "Clicked close button on generic dialog popup (strategy 2)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 2 failed: {str(e)}")

            # Strategy 3: Try to click any close button in the dialog
            if not close_successful:
                try:
                    any_close_button = page.locator(
                        "div.ui-dialog button.ui-dialog-titlebar-close"
                    )
                    if await any_close_button.count() > 0:
                        await any_close_button.click()
                        logger.info(
                            "Clicked close button on generic dialog popup (strategy 3)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 3 failed: {str(e)}")

            # Strategy 4: Try to click OK button if present
            if not close_successful:
                try:
                    ok_button = page.locator(
                        "div.ui-dialog-buttonpane button.ui-button:has-text('Ok')"
                    )
                    if await ok_button.count() > 0:
                        await ok_button.click()
                        logger.info(
                            "Clicked OK button on generic dialog popup (strategy 4)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 4 failed: {str(e)}")

            # Strategy 5: Try to click any button with "OK" text
            if not close_successful:
                try:
                    ok_button = page.locator("div.ui-dialog button:has-text('OK')")
                    if await ok_button.count() > 0:
                        await ok_button.click()
                        logger.info(
                            "Clicked OK button on generic dialog popup (strategy 5)"
                        )
                        close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 5 failed: {str(e)}")

            # Strategy 6: Try to press Escape key
            if not close_successful:
                try:
                    await page.keyboard.press("Escape")
                    logger.info(
                        "Pressed Escape key to close generic dialog popup (strategy 6)"
                    )
                    close_successful = True
                except Exception as e:
                    logger.debug(f"Strategy 6 failed: {str(e)}")

            # Strategy 7: Try to refresh the page as last resort
            if not close_successful:
                try:
                    logger.info(
                        "Refreshing page to close generic dialog popup (strategy 7 - last resort)"
                    )
                    await page.reload(
                        wait_until="domcontentloaded", timeout=90000
                    )  # Increased from 30000ms to 90000ms for slower connections
                    await page.wait_for_timeout(2000)
                    # Check if dialog still exists after refresh
                    popup_exists_after_refresh = (
                        await page.locator(popup_selector).count() > 0
                    )
                    if not popup_exists_after_refresh:
                        logger.info("Dialog closed after page refresh")
                        close_successful = True
                    else:
                        logger.warning("Dialog still exists after page refresh")
                except Exception as e:
                    logger.debug(f"Strategy 7 (page refresh) failed: {str(e)}")

            if not close_successful:
                logger.warning("All generic dialog popup closing strategies failed")
                return False

            await page.wait_for_timeout(1000)
            popup_exists = await page.locator(popup_selector).count() > 0
            if popup_exists:
                logger.warning(
                    "Generic dialog popup still exists after attempting to close it"
                )
                return False
            else:
                logger.info("Generic dialog popup successfully closed")
                return True

        except Exception as e:
            logger.warning(f"Error closing generic dialog popup: {str(e)}")
            return False

    @staticmethod
    async def _test_session_sharing(
        context: BrowserContext, base_url: str, source_page: Page
    ) -> bool:
        """
        Test if new pages can access the patient list without being redirected to login.

        Args:
            context: The browser context to use
            base_url: The base URL for the patient list
            source_page: The original page with the active session

        Returns:
            True if session is properly shared, False otherwise
        """
        test_page = None
        try:
            logger.info("Testing session sharing...")

            # Create a test page with session data
            test_page = await PlaywrightBotService._create_page_with_session(
                context, source_page
            )

            # Navigate to the base URL
            await test_page.goto(
                base_url,
                wait_until="domcontentloaded",
                timeout=150000,  # Increased from 100000ms to 150000ms for slower connections
            )

            # Check if we got redirected to login page
            current_url = test_page.url
            page_content = await test_page.content()

            if "login" in current_url.lower() or "txtUserName" in page_content:
                logger.warning("Session sharing test failed: redirected to login page")
                return False

            # Try to find the patient table
            try:
                await test_page.wait_for_selector("#dvCtCharts", timeout=10000)
                logger.info("Session sharing test successful: can access patient list")
                return True
            except Exception as e:
                logger.warning(
                    f"Session sharing test failed: table not found - {str(e)}"
                )
                return False

        except Exception as e:
            logger.error(f"Error during session sharing test: {str(e)}")
            return False
        finally:
            if test_page:
                await test_page.close()

    @staticmethod
    async def _get_table_column_mapping(
        page: Page, table_id: str = "#tbChartDocuments"
    ) -> Dict[str, int]:
        """
        Get column mapping for the assessment table by reading header text.

        Args:
            page: The Playwright page object
            table_id: The table selector (default: "#tbChartDocuments")

        Returns:
            Dictionary mapping column names to their indices
        """
        try:
            # Wait for the visible table headers in the scroll head (not the hidden ones in scroll body)
            await page.wait_for_selector(
                ".dataTables_scrollHead thead th",
                timeout=20000,  # Increased from 10000ms to 20000ms
            )

            # Get all header cells from the visible scroll head table
            headers = await page.locator(".dataTables_scrollHead thead th").all()

            column_mapping = {}

            for i, header in enumerate(headers):
                try:
                    # Get the header text content
                    header_text = await header.text_content()
                    if header_text:
                        # Clean up the header text
                        clean_text = header_text.strip()

                        # Map common column names to their indices
                        if (
                            "status" in clean_text.lower()
                            and "description" not in clean_text.lower()
                        ):
                            column_mapping["status"] = i
                        elif "status description" in clean_text.lower():
                            column_mapping["status_description"] = i
                        elif "episode" in clean_text.lower():
                            column_mapping["episode"] = i
                        elif "effective dates" in clean_text.lower():
                            column_mapping["effective_dates"] = i
                        elif "plan of" in clean_text.lower():
                            column_mapping["plan_of"] = i
                        elif "oasis" in clean_text.lower():
                            column_mapping["oasis"] = i
                        elif "medical" in clean_text.lower():
                            column_mapping["medical"] = i
                        elif "seq" in clean_text.lower():
                            column_mapping["seq"] = i
                        elif "hipps" in clean_text.lower():
                            column_mapping["hipps"] = i
                        elif "nurse" in clean_text.lower():
                            column_mapping["nurse"] = i

                except Exception as e:
                    logger.debug(f"Error processing header {i}: {str(e)}")
                    continue

            logger.info(f"Column mapping: {column_mapping}")
            return column_mapping

        except Exception as e:
            logger.error(f"Error getting table column mapping: {str(e)}")
            # Return default mapping as fallback
            return {
                "status": 1,
                "status_description": 2,
                "episode": 3,
                "effective_dates": 4,
                "plan_of": 5,
                "oasis": 7,
                "medical": 6,
                "seq": 8,
                "hipps": 9,
                "nurse": 10,
            }

    @staticmethod
    async def _execute_with_browser_session(
        agency_link: str,
        agency_username: str,
        agency_password: str,
        operation_func,
        agency_id: str = None,
    ):
        """
        Execute a browser operation using the warm browser manager.

        Args:
            agency_link: The URL of the medical website
            agency_username: The username for the medical website
            agency_password: The password for the medical website
            operation_func: Async function that takes (page) as parameter
            agency_id: The agency ID to check credentials flag

        Returns:
            Result of the operation_func

        Raises:
            Exception: If browser session fails or operation fails
        """
        try:
            # Check if browser manager is ready, if not, initialize it
            if not browser_manager.is_ready:
                logger.info("Browser manager not ready, initializing...")
                browser_started = await browser_manager.start()
                if not browser_started:
                    error_data = {
                        "status": "error",
                        "message": "Failed to initialize browser manager",
                        "error_type": "browser_init_failed",
                        "timestamp": datetime.now().isoformat(),
                    }
                    error_msg = "Failed to initialize browser manager"
                    logger.error(error_msg)
                    raise PlaywrightError(error_msg, error_data)
                logger.info("Browser manager initialized successfully")

            # Use browser manager to get a context
            async with browser_manager.get_context() as context:
                # Create a page in the context
                page = await browser_manager.get_page(context)

                try:
                    # Navigate and login
                    if not await PlaywrightBotService._navigate_and_login(
                        page, agency_link, agency_username, agency_password, agency_id
                    ):
                        error_data = {
                            "status": "error",
                            "message": "Failed to login to agency website",
                            "error_type": "login_failed",
                            "timestamp": datetime.now().isoformat(),
                        }
                        error_msg = "Failed to login to agency website"
                        logger.error(error_msg)
                        raise PlaywrightError(error_msg, error_data)

                    # Handle any popup dialogs
                    logger.info("Checking for popup dialogs...")
                    await PlaywrightBotService._handle_popup_dialog(page)

                    # Execute the specific operation
                    result = await operation_func(page)

                    # Validate result is not None
                    if result is None:
                        error_data = {
                            "status": "error",
                            "message": "Operation function returned None result",
                            "error_type": "operation_failed",
                            "timestamp": datetime.now().isoformat(),
                        }
                        error_msg = "Operation function returned None result"
                        logger.error(error_msg)
                        raise PlaywrightError(error_msg, error_data)

                    return result

                finally:
                    # Close the page (context is automatically closed by the context manager)
                    try:
                        await page.close()
                    except Exception as e:
                        logger.warning(f"Error closing page: {str(e)}")

        except Exception as e:
            # Note: Only logging error type, not full message/traceback to protect potential ePHI
            logger.error(f"Error in browser session: {type(e).__name__}")
            # Re-raise the exception so it can be caught by the worker for retries
            raise

    @staticmethod
    async def process_edi_billing_file(
        agency_id: str,
        agency_link: str,
        agency_username: str,
        agency_password: str,
        edi_file_path: str,
        task_id: str,
        check_number: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process an EDI billing file upload and validate patient records.

        Args:
            agency_id: UUID of the agency
            agency_link: URL of the medical website
            agency_username: Username for login
            agency_password: Password for login
            edi_file_path: Path to the EDI file to upload
            task_id: UUID of the background task
            check_number: Check number from EDI file (trimmed)

        Returns:
            Dictionary containing validation results for all patients
        """
        logger.info(f"Starting EDI billing file processing for task {task_id}")

        async def process_with_browser(page: Page):
            """Inner function to process with browser session"""

            try:
                # Note: Login and popup are already handled by _execute_with_browser_session
                # Step 1: Navigate to RA Page
                logger.info("Step 1: Navigating to RA Page")
                navigation_success = await PlaywrightBotService._navigate_to_ra_page(
                    page, agency_link
                )

                if not navigation_success:
                    raise Exception("Failed to navigate to RA Page")

                # Step 2: Upload EDI file
                logger.info("Step 2: Uploading EDI file")
                try:
                    upload_success = await PlaywrightBotService._upload_edi_file(
                        page, edi_file_path
                    )

                    if not upload_success:
                        raise Exception("Failed to upload EDI file")
                except PlaywrightError as upload_error:
                    # Check if this is the "already imported" error
                    if upload_error.error_type == "edi_already_imported":
                        logger.info(
                            "EDI file was already imported, attempting to open existing RA by check number"
                        )
                        duplicate_status = (
                            await PlaywrightBotService._handle_already_imported_ra(
                                page, check_number
                            )
                        )

                        if duplicate_status == "opened_posted":
                            logger.info(
                                "Opened existing RA with POSTED status, running validation to extract claim and paid amounts"
                            )
                            # Step 3: Show patient details if hidden
                            logger.info("Step 3: Ensuring patient details are visible")
                            await PlaywrightBotService._ensure_patient_details_visible(
                                page
                            )

                            # Step 3.5: Extract remarks
                            logger.info("Step 3.5: Extracting remarks")
                            remarks = await PlaywrightBotService._extract_remarks(page)

                            # Step 4: Extract and validate patients to get per-patient claim amounts
                            logger.info(
                                "Step 4: Extracting and validating patients to get claim amounts"
                            )
                            validation_results = (
                                await PlaywrightBotService._validate_all_patients(page)
                            )

                            # Calculate totals from validation results
                            total_claim_amount = sum(
                                (r.get("final_claim_amount") or 0)
                                for r in validation_results
                            )
                            total_paid_amount = sum(
                                (r.get("final_payment_amount") or 0)
                                for r in validation_results
                            )

                            # Close the page without review/post (file is already posted)
                            logger.info(
                                "Closing RA page (no review/post needed for already posted file)"
                            )
                            close_button = page.locator("#btnCloseRADetail")
                            await close_button.click(timeout=5000)
                            await page.wait_for_timeout(1000)

                            return {
                                "status": "success",
                                "message": "EDI file was already imported and posted. Extracted claim and paid amounts from validation.",
                                "patients_validated": len(validation_results),
                                "validation_results": validation_results,
                                "already_imported": True,
                                "total_claim_amount": total_claim_amount,
                                "total_paid_amount": total_paid_amount,
                                "remarks": remarks,
                                "timestamp": datetime.now().isoformat(),
                            }
                        elif duplicate_status == "opened":
                            logger.info(
                                "Opened existing RA with matching bank/check, continuing validation flow"
                            )
                            # proceed with validation steps below
                        else:
                            message = "EDI file has already been imported"
                            if duplicate_status == "not_open":
                                message = "EDI file has already been imported (existing payment not open)"
                            elif duplicate_status == "not_found":
                                message = "EDI file has already been imported (matching Bank/Check not found)"
                            elif duplicate_status == "missing_check_number":
                                message = "EDI file has already been imported (no Bank/Check provided to match)"
                            elif duplicate_status == "missing_columns":
                                message = "EDI file has already been imported (RA table headers missing for Bank/Check lookup)"
                            elif duplicate_status == "table_not_ready":
                                message = "EDI file has already been imported (RA table not available)"

                            return {
                                "status": "success",
                                "message": message,
                                "patients_validated": 0,
                                "validation_results": [],
                                "already_imported": True,
                                "timestamp": datetime.now().isoformat(),
                            }
                    else:
                        # Re-raise other PlaywrightErrors
                        raise

                # Step 3: Show patient details if hidden
                logger.info("Step 3: Ensuring patient details are visible")
                await PlaywrightBotService._ensure_patient_details_visible(page)

                # Step 3.5: Extract remarks
                logger.info("Step 3.5: Extracting remarks")
                remarks = await PlaywrightBotService._extract_remarks(page)

                # Step 4: Extract and validate patients
                logger.info("Step 4: Extracting and validating patients")
                validation_results = await PlaywrightBotService._validate_all_patients(
                    page
                )

                # Step 5: Save and close
                logger.info("Step 5: Saving results")
                save_success = await PlaywrightBotService._close_ra_page(page)
                if not save_success:
                    raise Exception("Failed to post after validation")

                return {
                    "status": "success",
                    "message": f"Successfully processed EDI file and validated {len(validation_results)} patients",
                    "patients_validated": len(validation_results),
                    "validation_results": validation_results,
                    "remarks": remarks,
                    "timestamp": datetime.now().isoformat(),
                }

            except PlaywrightError as e:
                # Re-raise PlaywrightError to preserve error_type (e.g., missing_claim_info)
                raise
            except Exception as e:
                error_msg = f"{str(e)}"
                # Note: Only logging error type to protect ePHI that might be in error message
                logger.error(f"Error in EDI processing: {type(e).__name__}")
                raise PlaywrightError(
                    error_msg,
                    {
                        "status": "error",
                        "message": error_msg,
                        "error_type": "edi_processing_failed",
                        "timestamp": datetime.now().isoformat(),
                    },
                )

        # Execute with browser session
        return await PlaywrightBotService._execute_with_browser_session(
            agency_link,
            agency_username,
            agency_password,
            process_with_browser,
            agency_id,
        )

    @staticmethod
    async def _navigate_to_ra_page(page: Page, agency_link: str) -> bool:
        """
        Navigate to the RA Page using URL manipulation with retry logic.
        Tries up to 3 times before failing.

        Args:
            page: Playwright page object
            agency_link: Base agency link

        Returns:
            True if navigation successful, False otherwise
        """
        max_retries = 3

        for attempt in range(max_retries):
            try:
                logger.info(f"RA navigation attempt {attempt + 1}/{max_retries}")

                # Method 1: Try direct URL navigation (preferred)
                current_url = page.url
                logger.info(f"Current URL: {current_url}")

                # Check if we're on IntakeList.aspx (patients list page)
                # This happens for some agencies that redirect after login
                if "IntakeList.aspx" in current_url:
                    logger.info(
                        "Detected IntakeList.aspx page, attempting to navigate to home first"
                    )
                    try:
                        # Try clicking the logo to go home
                        # The logo has onclick handlers on inner divs, try container first, then inner divs
                        logo_selector = "#dvLogo"
                        logo = page.locator(logo_selector)
                        if await logo.count() > 0:
                            logger.info("Clicking logo to navigate to home")
                            # Try clicking the container first
                            try:
                                await logo.click(timeout=5000)
                            except:
                                # If container click fails, try clicking the inner div with onclick
                                logo_inner = logo.locator(
                                    "div[onclick*='GoToTreeSelector']"
                                ).first
                                if await logo_inner.count() > 0:
                                    await logo_inner.click(timeout=5000)
                            await page.wait_for_timeout(2000)
                            # Wait for navigation to complete
                            await page.wait_for_load_state(
                                "domcontentloaded", timeout=10000
                            )
                            current_url = page.url
                            logger.info(f"After logo click, current URL: {current_url}")
                    except Exception as logo_err:
                        logger.warning(f"Could not click logo to go home: {logo_err}")

                # Replace /Pages/TreeSelector.aspx with /Pages/RAPage.aspx
                if "TreeSelector.aspx" in current_url:
                    ra_page_url = current_url.replace(
                        "TreeSelector.aspx", "RAPage.aspx"
                    )
                elif "IntakeList.aspx" in current_url:
                    # If still on IntakeList, construct from current URL
                    ra_page_url = current_url.replace("IntakeList.aspx", "RAPage.aspx")
                else:
                    # Construct URL from agency link
                    from urllib.parse import urlparse

                    parsed = urlparse(agency_link)
                    ra_page_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rsplit('/', 1)[0]}/Pages/RAPage.aspx"

                logger.info(f"Navigating to RA Page: {ra_page_url}")
                await page.goto(
                    ra_page_url,
                    wait_until="domcontentloaded",
                    timeout=90000,  # Increased from 30000ms to 90000ms for slower connections
                )

                # Wait for the ERA button to be visible
                await page.wait_for_selector(
                    "#btnERALoad", timeout=20000
                )  # Increased from 10000ms to 20000ms
                logger.info("Successfully navigated to RA Page")
                return True

            except Exception as e:
                logger.warning(
                    f"Direct URL navigation attempt {attempt + 1} failed: {str(e)}"
                )

                # If this was the last attempt, try fallback methods
                if attempt == max_retries - 1:
                    # Try clicking logo and retrying one more time if we haven't already
                    if "IntakeList.aspx" not in page.url:
                        try:
                            logger.info(
                                "Last attempt failed, trying logo click before menu navigation"
                            )
                            logo_selector = "#dvLogo"
                            logo = page.locator(logo_selector)
                            if await logo.count() > 0:
                                logger.info("Clicking logo to navigate to home")
                                # Try clicking the container first
                                try:
                                    await logo.click(timeout=5000)
                                except:
                                    # If container click fails, try clicking the inner div with onclick
                                    logo_inner = logo.locator(
                                        "div[onclick*='GoToTreeSelector']"
                                    ).first
                                    if await logo_inner.count() > 0:
                                        await logo_inner.click(timeout=5000)
                                await page.wait_for_timeout(2000)
                                await page.wait_for_load_state(
                                    "domcontentloaded", timeout=10000
                                )

                                # Try direct navigation one more time after logo click
                                current_url = page.url
                                if "TreeSelector.aspx" in current_url:
                                    ra_page_url = current_url.replace(
                                        "TreeSelector.aspx", "RAPage.aspx"
                                    )
                                else:
                                    from urllib.parse import urlparse

                                    parsed = urlparse(agency_link)
                                    ra_page_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rsplit('/', 1)[0]}/Pages/RAPage.aspx"

                                logger.info(
                                    f"Retrying navigation to RA Page after logo click: {ra_page_url}"
                                )
                                await page.goto(
                                    ra_page_url,
                                    wait_until="domcontentloaded",
                                    timeout=90000,  # Increased from 30000ms to 90000ms for slower connections
                                )
                                await page.wait_for_selector(
                                    "#btnERALoad", timeout=10000
                                )
                                logger.info(
                                    "Successfully navigated to RA Page after logo click retry"
                                )
                                return True
                        except Exception as logo_retry_err:
                            logger.warning(
                                f"Logo click retry also failed: {logo_retry_err}"
                            )

                    # Method 2: Try menu navigation as final fallback
                    try:
                        logger.info("Trying menu navigation as final fallback")
                        return await PlaywrightBotService._navigate_via_menu(page)
                    except Exception as menu_error:
                        logger.error(f"Menu navigation also failed: {str(menu_error)}")
                        return False
                else:
                    # Wait a bit before retrying
                    await page.wait_for_timeout(1000)

        return False

    @staticmethod
    async def _navigate_via_menu(page: Page) -> bool:
        """
        Navigate to RA Page via the menu system.

        Args:
            page: Playwright page object

        Returns:
            True if navigation successful, False otherwise
        """
        try:
            # Check if Billing menu is visible
            billing_menu = page.locator("span.fancytree-title:has-text('Billing')")
            is_visible = await billing_menu.is_visible()

            if not is_visible:
                # Click the hamburger menu to show sidebar
                logger.info("Billing menu not visible, opening sidebar")
                await page.click("#menuTrigger", timeout=5000)
                await page.wait_for_timeout(1000)

            # Click Billing menu
            logger.info("Clicking Billing menu")
            await billing_menu.click(timeout=5000)
            await page.wait_for_timeout(1000)

            # Click "Payments EOB RA" in the submenu
            logger.info("Clicking Payments EOB RA")
            payments_menu = page.locator(
                "span.fancytree-title:has-text('Payments EOB RA')"
            )
            await payments_menu.click(timeout=5000)

            # Wait for RA Page to load
            await page.wait_for_selector(
                "#btnERALoad", timeout=20000
            )  # Increased from 10000ms to 20000ms
            logger.info("Successfully navigated via menu")
            return True

        except Exception as e:
            logger.error(f"Menu navigation failed: {str(e)}")
            return False

    @staticmethod
    async def _upload_edi_file(page: Page, edi_file_path: str) -> bool:
        """
        Upload EDI file to the RA Page.

        Args:
            page: Playwright page object
            edi_file_path: Path to the EDI file

        Returns:
            True if upload successful, False otherwise
        """
        try:
            # Click ERA button
            logger.info("Clicking ERA button")
            await page.click(
                "#btnERALoad", timeout=20000
            )  # Increased from 10000ms to 20000ms
            await page.wait_for_timeout(1000)

            # Wait for dialog to appear
            await page.wait_for_selector(
                "div.ui-dialog-buttonset", timeout=10000
            )  # Increased from 5000ms to 10000ms
            logger.info("Dialog appeared")

            # Click "Local" button and capture file chooser in one step
            logger.info("Clicking Local button")
            local_button = page.locator(
                "div.ui-dialog-buttonset button:has-text('Local')"
            )
            # Increased timeout for file chooser (30s) to handle proxy delays and concurrent load
            async with page.expect_file_chooser(timeout=30000) as fc_info:
                await local_button.click(
                    timeout=10000
                )  # Increased from 5000ms to 10000ms

            # Handle file upload dialog
            logger.info(f"Uploading file: {edi_file_path}")

            file_chooser = await fc_info.value
            await file_chooser.set_files(edi_file_path)
            logger.info("File uploaded successfully")

            # Give the page a moment to react and check for errors
            await page.wait_for_timeout(2000)

            # Check for "already imported" error first
            if await PlaywrightBotService._check_for_already_imported_error(page):
                # Raise a specific error that will be caught and handled as success
                error_data = {
                    "status": "success",
                    "message": "EDI file has already been imported",
                    "error_type": "edi_already_imported",
                    "timestamp": datetime.now().isoformat(),
                }
                raise PlaywrightError("EDI file has already been imported", error_data)

            # Check for Missing Claim Info dialog (unknown patient/claim codes)
            await PlaywrightBotService._raise_if_missing_claim_info_dialog(page)

            # Check for other RA errors (like wrong agency)
            await PlaywrightBotService._raise_if_ra_error_dialog(page)

            # Check if patient details are now visible
            try:
                await page.wait_for_selector(
                    "#dvDetailsRa", timeout=20000
                )  # Increased from 10000ms to 20000ms
            except Exception as wait_error:
                # Check for "already imported" error
                if await PlaywrightBotService._check_for_already_imported_error(page):
                    error_data = {
                        "status": "success",
                        "message": "EDI file has already been imported",
                        "error_type": "edi_already_imported",
                        "timestamp": datetime.now().isoformat(),
                    }
                    raise PlaywrightError(
                        "EDI file has already been imported", error_data
                    )

                await PlaywrightBotService._raise_if_ra_error_dialog(page)
                await PlaywrightBotService._raise_if_missing_claim_info_dialog(page)
                logger.error(f"RA Page did not load after EDI upload: {wait_error}")
                raise PlaywrightError(
                    "RA page did not load after EDI upload",
                    {
                        "status": "error",
                        "message": "RA page did not load after EDI upload",
                        "error_type": "edi_upload_failed",
                        "detail": str(wait_error),
                        "timestamp": datetime.now().isoformat(),
                    },
                )

            logger.info("RA Page loaded with patient data")
            return True

        except PlaywrightError as e:
            # Re-raise PlaywrightError (especially for "already imported" case)
            # so it can be handled properly in the calling function
            raise
        except Exception as e:
            logger.error(f"File upload failed: {str(e)}")
            raise PlaywrightError(
                "Failed to upload EDI file",
                {
                    "status": "error",
                    "message": "Failed to upload EDI file",
                    "error_type": "edi_upload_failed",
                    "detail": str(e),
                    "timestamp": datetime.now().isoformat(),
                },
            )

    @staticmethod
    async def _ensure_patient_details_visible(page: Page) -> bool:
        """
        Ensure patient details are expanded/visible.

        Args:
            page: Playwright page object

        Returns:
            True if details are visible or were successfully expanded
        """
        try:
            # Check if the details section shows "Show Patient Details"
            details_section = page.locator("#dvDetailsRa span.raDetailTitle")
            text_content = await details_section.text_content(timeout=5000)

            if "Show Patient Details" in text_content:
                logger.info("Patient details are hidden, expanding them")
                await details_section.click(timeout=5000)
                await page.wait_for_timeout(1000)

                # Verify they're now visible
                new_text = await details_section.text_content(timeout=5000)
                if "Hide Patient Details" in new_text:
                    logger.info("Patient details successfully expanded")
                    return True
                else:
                    logger.warning("Failed to expand patient details")
                    return False
            else:
                logger.info("Patient details already visible")
                return True

        except Exception as e:
            logger.error(f"Error ensuring patient details visible: {str(e)}")
            return False

    @staticmethod
    async def _extract_remarks(page: Page) -> Optional[str]:
        """
        Extract remarks from the "Remark To Adjustment" textarea.

        Args:
            page: Playwright page object

        Returns:
            Remarks text if found, None otherwise
        """
        try:
            # Wait for the textarea to be available
            remarks_textarea = page.locator("#txtRemarkAdjusment")
            await remarks_textarea.wait_for(state="attached", timeout=10000)

            # Get the text content from the textarea
            remarks_text = await remarks_textarea.input_value(timeout=5000)

            if remarks_text:
                remarks_text = remarks_text.strip()
                logger.info("Successfully extracted remarks from textarea")
                return remarks_text if remarks_text else None
            else:
                logger.info("Remarks textarea is empty")
                return None

        except Exception as e:
            logger.warning(f"Could not extract remarks: {type(e).__name__} - {str(e)}")
            return None

    @staticmethod
    async def _check_for_already_imported_error(page: Page) -> bool:
        """
        Check if the "already imported" error dialog is present.

        Args:
            page: Playwright page object

        Returns:
            True if the "already imported" error is detected, False otherwise
        """
        try:
            error_dialog = page.locator("#dialog-Error")
            if await error_dialog.count() == 0:
                return False

            if not await error_dialog.is_visible():
                return False

            message_locator = error_dialog.locator(".labelError")
            message = (
                await message_locator.text_content(timeout=10000)
            ) or ""  # Added timeout for concurrent load
            clean_message = message.strip()

            # Check if this is the "already imported" error
            if "already been imported" in clean_message.lower():
                # Note: Not logging full message to protect potential ePHI
                logger.info("EDI file already imported detected")

                # Close the dialog
                try:
                    close_button = error_dialog.locator(
                        "button.ui-button:has-text('Ok')"
                    )
                    if await close_button.count() > 0:
                        await close_button.click(
                            timeout=10000
                        )  # Added timeout for concurrent load
                        await page.wait_for_timeout(1000)
                        logger.info("Closed 'already imported' error dialog")
                except Exception as close_err:
                    logger.debug(f"Could not close error dialog: {close_err}")

                return True

            return False
        except Exception as e:
            logger.debug(f"Failed to check for already imported error: {e}")
            return False

    @staticmethod
    async def _get_ra_list_table(page: Page) -> Optional[Locator]:
        """
        Locate the RA list table that contains data rows (excluding header-only tables).
        """
        try:
            candidate_selectors = [
                "table#tbRAList",
                "table.display.provider-list.dataTable",
            ]
            for selector in candidate_selectors:
                table = page.locator(selector)
                if await table.count() == 0:
                    continue

                try:
                    body_rows = table.locator("tbody tr[role='row']")
                    fallback_rows = table.locator("tbody tr")
                    row_count = await body_rows.count()
                    if row_count == 0:
                        row_count = await fallback_rows.count()
                    if row_count > 0:
                        return table
                except Exception:
                    continue
            return None
        except Exception as e:
            logger.debug(f"Could not locate RA list table: {e}")
            return None

    @staticmethod
    async def _get_ra_column_mapping(table: Locator) -> Dict[str, int]:
        """
        Build a column index mapping for the RA list table based on header text.
        """
        mapping: Dict[str, int] = {}
        try:
            headers = table.locator("thead th")
            header_count = await headers.count()
            for idx in range(header_count):
                text = (await headers.nth(idx).text_content() or "").strip().lower()
                if not text:
                    continue
                if "bank/check" in text:
                    mapping["bank_check"] = idx
                elif "status" in text:
                    mapping["status"] = idx
                elif "description" in text:
                    mapping["description"] = idx
            return mapping
        except Exception as e:
            logger.debug(f"Failed to map RA columns: {e}")
            return mapping

    @staticmethod
    def _extract_check_from_bank_check(
        bank_check_value: Optional[str],
    ) -> Optional[str]:
        """
        Extract only the check part from a bank/check string.

        If the value is in format "bank/check", returns only "check" (trimmed).
        If the value doesn't contain "/", returns the value as-is (trimmed).
        Returns None if input is None or empty.

        Args:
            bank_check_value: String in format "bank/check" or just "check"

        Returns:
            Check number (trimmed) or None
        """
        if not bank_check_value:
            return None

        bank_check_value = bank_check_value.strip()
        if not bank_check_value:
            return None

        # If it contains "/", extract the part after "/"
        if "/" in bank_check_value:
            parts = bank_check_value.split("/", 1)
            if len(parts) > 1:
                check_part = parts[1].strip()
                return check_part if check_part else None

        # If no "/", return the value as-is (trimmed)
        return bank_check_value

    @staticmethod
    async def _handle_already_imported_ra(
        page: Page, check_number: Optional[str]
    ) -> str:
        """
        After detecting an 'already imported' message, attempt to open the matching RA.

        Args:
            check_number: The check number (trimmed)

        Returns one of:
        - "opened": matching row found with OPEN status and opened
        - "opened_posted": matching row found with any status other than OPEN (e.g., POSTED) and opened
        - "not_open": matching row found but could not be opened (link not found)
        - "not_found": no matching check number
        - "missing_check_number": no check number provided
        - "missing_columns": unable to map required columns
        - "table_not_ready": RA table missing/empty
        """
        if not check_number:
            logger.info("Check number not provided; cannot locate existing RA")
            return "missing_check_number"

        # check_number is already just the check (from parser), just trim it
        provided_check_val = check_number.strip()
        if not provided_check_val:
            logger.info(
                "Check number is empty after trimming; cannot locate existing RA"
            )
            return "missing_check_number"

        try:
            await page.locator("button.ui-button:has-text('Ok')").click(timeout=2000)
            await page.wait_for_timeout(500)
        except Exception:
            pass

        table = await PlaywrightBotService._get_ra_list_table(page)
        if not table:
            logger.warning("RA list table not available to locate existing RA")
            return "table_not_ready"

        mapping = await PlaywrightBotService._get_ra_column_mapping(table)
        required_keys = {"bank_check", "description", "status"}
        if not required_keys.issubset(mapping.keys()):
            logger.warning(
                f"Missing required RA columns for lookup. Found: {list(mapping.keys())}"
            )
            return "missing_columns"

        rows = table.locator("tbody tr[role='row']")
        row_count = await rows.count()
        logger.info(
            f"Scanning {row_count} RA rows to match check number: '{provided_check_val}'"
        )

        for i in range(row_count):
            try:
                row = rows.nth(i)
                cells = row.locator("td")

                bank_val = (
                    await cells.nth(mapping["bank_check"]).text_content() or ""
                ).strip()

                # Extract only the check part from table value (table may have "bank/check" format)
                table_check_val = PlaywrightBotService._extract_check_from_bank_check(
                    bank_val
                )

                logger.debug(
                    f"Row {i}: table value='{bank_val}', extracted check='{table_check_val}', "
                    f"comparing with provided check='{provided_check_val}'"
                )

                # Compare the check parts
                if not table_check_val:
                    logger.debug(f"Row {i}: No check value extracted, skipping")
                    continue
                if table_check_val.lower() != provided_check_val.lower():
                    logger.debug(
                        f"Row {i}: Check mismatch - table check '{table_check_val}' != provided check '{provided_check_val}'"
                    )
                    continue

                logger.info(
                    f"Row {i}: Found matching check number! Table value='{bank_val}', "
                    f"extracted check='{table_check_val}', provided check='{provided_check_val}'"
                )

                status_val = (
                    await cells.nth(mapping["status"]).text_content() or ""
                ).strip()

                desc_cell = cells.nth(mapping["description"])
                link = desc_cell.locator("a")
                if await link.count() == 0:
                    logger.warning("Description link not found for matching RA row")
                    return "not_found"

                await link.first.click(timeout=5000)
                await page.wait_for_timeout(500)
                await page.wait_for_selector(
                    "#dvDetailsRa", timeout=20000
                )  # Increased from 10000ms to 20000ms

                if status_val.lower() == "open":
                    logger.info(
                        "Opened existing RA details page for matched bank/check with OPEN status"
                    )
                    return "opened"
                else:
                    logger.info(
                        f"Found matching check number with status '{status_val}' (not OPEN). "
                        f"Table value='{bank_val}', extracted check='{table_check_val}', "
                        f"provided check='{provided_check_val}'"
                    )
                    return "opened_posted"
            except Exception as row_err:
                logger.debug(f"Error scanning RA row {i}: {row_err}")
                continue

        logger.info(
            f"No RA row matched the provided check number '{provided_check_val}' "
            f"after scanning {row_count} rows"
        )
        return "not_found"

    @staticmethod
    async def _raise_if_ra_error_dialog(page: Page) -> None:
        """
        Detect the RA error dialog shown when the uploaded EDI file does not belong to the agency.
        Note: This method does not check for "already imported" errors - use _check_for_already_imported_error for that.

        Raises:
            PlaywrightError: When the error dialog is present (excluding "already imported" errors).
        """
        try:
            error_dialog = page.locator("#dialog-Error")
            if await error_dialog.count() == 0:
                return

            if not await error_dialog.is_visible():
                return

            message_locator = error_dialog.locator(".labelError")
            message = (
                await message_locator.text_content(timeout=10000)
            ) or ""  # Added timeout for concurrent load
            clean_message = message.strip() or "Unknown RA validation error."

            # Skip if this is the "already imported" error (handled separately)
            if "already been imported" in clean_message.lower():
                return

            # Note: Not logging full error message to protect potential ePHI
            logger.error("EDI upload error dialog detected")

            # Attempt to close the dialog to keep UI clean
            try:
                close_button = error_dialog.locator("button.ui-button:has-text('Ok')")
                if await close_button.count() > 0:
                    await close_button.click(
                        timeout=10000
                    )  # Added timeout for concurrent load
                    logger.info("Closed RA error dialog")
            except Exception as close_err:
                logger.debug(f"Could not close RA error dialog: {close_err}")

            error_data = {
                "status": "error",
                "message": clean_message,
                "error_type": "edi_wrong_agency",
                "timestamp": datetime.now().isoformat(),
            }
            raise PlaywrightError(clean_message, error_data)
        except PlaywrightError:
            raise
        except Exception as e:
            logger.debug(f"Failed to evaluate RA error dialog: {e}")
            return

    @staticmethod
    async def _raise_if_missing_claim_info_dialog(page: Page) -> None:
        """
        Detect the Missing Claim Info dialog shown when patient or claim codes are unknown.

        Raises:
            PlaywrightError: When the dialog is present.
        """
        try:
            # Wait a bit for the dialog to appear after file upload
            await page.wait_for_timeout(1000)

            # Try to wait for the dialog/container to appear (with short timeout)
            try:
                await page.wait_for_selector(
                    "#raClaimMissingInfoContainer, div.ui-dialog:has(.ui-dialog-title:has-text('Missing Claim Info'))",
                    timeout=3000,
                    state="visible",
                )
            except Exception:
                # Dialog might not appear, that's okay - we'll check anyway
                pass

            # Try multiple selectors to find the dialog
            dialog = page.locator(
                "div.ui-dialog:has(.ui-dialog-title:has-text('Missing Claim Info'))"
            )
            # Also check by container ID which is more reliable
            container = page.locator("#raClaimMissingInfoContainer")
            # Alternative: check for dialog with the container inside
            dialog_with_container = page.locator(
                "div.ui-dialog:has(#raClaimMissingInfoContainer)"
            )

            # Check if any of these exist and are visible
            dialog_exists = await dialog.count() > 0
            container_exists = await container.count() > 0
            dialog_with_container_exists = await dialog_with_container.count() > 0

            if (
                not dialog_exists
                and not container_exists
                and not dialog_with_container_exists
            ):
                return

            # Determine which locator to use for visibility check
            visible_dialog = None
            if dialog_with_container_exists:
                if await dialog_with_container.is_visible():
                    visible_dialog = dialog_with_container
            elif dialog_exists:
                if await dialog.is_visible():
                    visible_dialog = dialog
            elif container_exists:
                if await container.is_visible():
                    # If container is visible, find its parent dialog
                    visible_dialog = container.locator(
                        "xpath=ancestor::div[contains(@class, 'ui-dialog')]"
                    )
                    if await visible_dialog.count() == 0:
                        visible_dialog = dialog  # Fallback

            if not visible_dialog:
                return

            # Extract error messages (added timeouts for concurrent load)
            patient_msg = (
                (await page.locator("#patientMessagesp").text_content(timeout=10000))
                or ""
            ).strip()
            claim_msg = (
                (await page.locator("#claimMessagesp").text_content(timeout=10000))
                or ""
            ).strip()
            patient_name = (
                (await page.locator("#patientNamesp").text_content(timeout=10000)) or ""
            ).strip()
            claim_range = (
                (await page.locator("#claimRangesp").text_content(timeout=10000)) or ""
            ).strip()

            messages: list[str] = []
            if patient_msg:
                messages.append(patient_msg)
            if claim_msg:
                messages.append(claim_msg)

            logger.error("missing claim info dialog detected")

            # Build details message
            details = (
                ", ".join(messages) if messages else "Unknown patient or claim code"
            )

            # Full message with ePHI for error_data only (not logged)
            extra_parts: list[str] = []
            if patient_name:
                extra_parts.append(f"Patient: {patient_name}")
            if claim_range:
                extra_parts.append(f"Range: {claim_range}")

            if extra_parts:
                clean_message = (
                    f"Missing Claim Info: {details} ({', '.join(extra_parts)})"
                )
            else:
                clean_message = f"Missing Claim Info: {details}"

            # Try to close the dialog
            try:
                # Try Cancel button first
                close_button = visible_dialog.locator(
                    "button.ui-button:has-text('Cancel')"
                )
                if await close_button.count() == 0:
                    # Try Close button
                    close_button = visible_dialog.locator(
                        "button.ui-button:has-text('Close')"
                    )
                if await close_button.count() == 0:
                    # Try the X button in titlebar
                    close_button = visible_dialog.locator(
                        "button.ui-dialog-titlebar-close"
                    )
                if await close_button.count() > 0:
                    await close_button.click(
                        timeout=10000
                    )  # Added timeout for concurrent load
                    await page.wait_for_timeout(500)
                    logger.info("Closed Missing Claim Info dialog")
            except Exception as close_err:
                logger.debug(f"Could not close Missing Claim Info dialog: {close_err}")

            error_data = {
                "status": "error",
                "message": clean_message,
                "error_type": "missing_claim_info",
                "patient_message": patient_msg,
                "claim_message": claim_msg,
                "patient_name": patient_name,
                "claim_range": claim_range,
                "timestamp": datetime.now().isoformat(),
            }
            raise PlaywrightError(clean_message, error_data)
        except PlaywrightError:
            raise
        except Exception as e:
            logger.debug(f"Failed to evaluate Missing Claim Info dialog: {e}")
            return

    @staticmethod
    async def _find_patient_number_column_index(page: Page) -> Optional[int]:
        """
        Find the column index for patient number by looking at table headers.

        The header structure is:
        <thead><tr role="row"><th data-column-index="0">...</th><th data-column-index="2" aria-label="Patient No.: ...">...</th>...</tr></thead>
        The text "Patient No." is inside: th > div.dataTables_sizing > div.DataTables_sort_wrapper

        Args:
            page: Playwright page object

        Returns:
            Column index (0-based) for patient number, or None if not found
        """
        try:
            # Find the table header row - use thead tr th selector
            headers = page.locator("#details_grid thead tr th")
            header_count = await headers.count()

            if header_count == 0:
                logger.warning("Could not find table headers")
                return None

            # Look for patient number column by checking header text and aria-label
            # Common variations: "Patient No.", "Pt No", "Patient No", "PT#", "Patient #", etc.
            for i in range(header_count):
                try:
                    header = headers.nth(i)

                    # First, try to get the text content from the nested div structure
                    # The text is in: th > div.dataTables_sizing > div.DataTables_sort_wrapper
                    sort_wrapper = header.locator("div.DataTables_sort_wrapper")
                    if await sort_wrapper.count() > 0:
                        header_text = await sort_wrapper.text_content(timeout=2000)
                    else:
                        # Fallback to direct text content
                        header_text = await header.text_content(timeout=2000)

                    # Also check aria-label attribute
                    aria_label = await header.get_attribute("aria-label")
                    if aria_label:
                        # aria-label format: "Patient No.: activate to sort column ascending"
                        # Extract just the column name part
                        aria_label = aria_label.split(":")[0].strip()

                    # Combine both sources for matching
                    text_to_check = ""
                    if header_text:
                        text_to_check += header_text.strip() + " "
                    if aria_label:
                        text_to_check += aria_label.strip() + " "

                    if text_to_check:
                        clean_text = text_to_check.lower()
                        # Check for various patient number indicators
                        if any(
                            indicator in clean_text
                            for indicator in [
                                "patient no.",
                                "patient no",
                                "pt no.",
                                "pt no",
                                "pt#",
                                "patient #",
                                "pt number",
                                "patient number",
                                "pt num",
                            ]
                        ):
                            # Try to use data-column-index if available, otherwise use position index
                            column_index_attr = await header.get_attribute(
                                "data-column-index"
                            )
                            if column_index_attr:
                                try:
                                    column_index = int(column_index_attr)
                                    logger.info(
                                        f"Found patient number column at data-column-index {column_index}"
                                    )
                                    return column_index
                                except ValueError:
                                    pass

                            # Fallback to position index
                            logger.info(f"Found patient number column at index {i}")
                            return i

                except Exception as e:
                    logger.debug(f"Error reading header {i}: {type(e).__name__}")
                    continue

            logger.warning("Could not find patient number column in headers")
            return None

        except Exception as e:
            logger.warning(f"Error finding patient number column: {type(e).__name__}")
            return None

    @staticmethod
    async def _validate_all_patients(page: Page) -> List[Dict[str, Any]]:
        """
        Extract and validate all patients from the table.

        Args:
            page: Playwright page object

        Returns:
            List of validation results for each patient
        """
        validation_results = []

        try:
            # Wait for table to be visible
            await page.wait_for_selector(
                "#details_grid tbody tr", timeout=20000
            )  # Increased from 10000ms to 20000ms

            # Find the patient number column index dynamically
            patient_number_column_index = (
                await PlaywrightBotService._find_patient_number_column_index(page)
            )

            if patient_number_column_index is None:
                logger.warning(
                    "Could not determine patient number column index, will skip patient number extraction"
                )

            # Get all patient rows
            patient_rows = page.locator("#details_grid tbody tr[role='row']")
            row_count = await patient_rows.count()
            logger.info(f"Found {row_count} patients to validate")

            for i in range(row_count):
                try:
                    row = patient_rows.nth(i)

                    # Extract patient name from the link
                    patient_link = row.locator("a.underlineAnc")
                    patient_name = await patient_link.text_content(timeout=5000)
                    # Note: Patient name intentionally not logged to protect ePHI

                    # Extract patient number from the dynamically found column
                    patient_number = None
                    if patient_number_column_index is not None:
                        try:
                            # Get all td elements in the row
                            td_elements = row.locator("td")
                            td_count = await td_elements.count()
                            if td_count > patient_number_column_index:
                                patient_number_td = td_elements.nth(
                                    patient_number_column_index
                                )
                                patient_number_text = (
                                    await patient_number_td.text_content(timeout=5000)
                                )
                                if patient_number_text:
                                    patient_number = patient_number_text.strip()
                                    logger.debug(
                                        f"Extracted patient number for patient {i+1}"
                                    )
                                else:
                                    logger.warning(
                                        f"Patient number text is empty for patient {i+1} at column index {patient_number_column_index}"
                                    )
                            else:
                                logger.warning(
                                    f"Row {i+1} has only {td_count} columns, need index {patient_number_column_index}"
                                )
                        except Exception as e:
                            logger.warning(
                                f"Could not extract patient number from row {i+1}: {type(e).__name__} - {str(e)}"
                            )
                    else:
                        logger.warning(
                            f"Patient number column index is None, cannot extract patient number for patient {i+1}"
                        )

                    logger.info(f"Processing patient {i+1}/{row_count}")

                    # Ensure any previous dialog is closed before opening a new one
                    try:
                        # Check if a dialog is still open and close it
                        existing_dialog = page.locator(
                            "div.ui-dialog:visible, div.ui-dialog-content:visible"
                        )
                        if await existing_dialog.count() > 0:
                            logger.debug(
                                "Closing existing dialog before opening new one"
                            )
                            close_button = page.locator(
                                "button.ui-button:has-text('Close'):visible"
                            )
                            if await close_button.count() > 0:
                                await close_button.click(timeout=2000)
                                await page.wait_for_timeout(1000)
                            # Also try pressing Escape key as fallback
                            await page.keyboard.press("Escape")
                            await page.wait_for_timeout(500)
                    except Exception as e:
                        logger.debug(
                            f"Error checking for existing dialog: {type(e).__name__}"
                        )

                    # Click on patient name to open dialog
                    await patient_link.click(
                        timeout=10000
                    )  # Increased from 5000ms to 10000ms for slower connections
                    await page.wait_for_timeout(1500)

                    # Wait for dialog to open
                    await PlaywrightBotService._raise_if_missing_claim_info_dialog(page)

                    # Wait for dialog to be visible and then for the label
                    try:
                        # First wait for dialog to be visible
                        await page.wait_for_selector(
                            "div.ui-dialog:visible, div.ui-dialog-content:visible",
                            timeout=20000,  # Increased from 10000ms to 20000ms
                        )
                        # Then wait for the specific label
                        await page.wait_for_selector(
                            "label#spActualEpisode",
                            timeout=20000,  # Increased from 10000ms to 20000ms
                        )
                    except Exception as e:
                        # If dialog didn't open, try clicking again
                        logger.warning(
                            f"Dialog did not open on first click for patient {i+1}, retrying..."
                        )
                        await patient_link.click(
                            timeout=10000
                        )  # Increased from 5000ms to 10000ms for slower connections
                        await page.wait_for_timeout(2000)
                        await page.wait_for_selector(
                            "label#spActualEpisode",
                            timeout=20000,  # Increased from 10000ms to 20000ms
                        )

                    # Extract final claim amount from label
                    final_claim_label = page.locator("label#spActualEpisode")
                    final_claim_text = await final_claim_label.text_content(
                        timeout=5000
                    )
                    # Note: Not logging claim text content to protect ePHI

                    # Parse final claim amount from text like "Final Claim Sent on 11/05/2025, for $ 2,078.90 By Synergy"
                    final_claim_amount = PlaywrightBotService._parse_amount_from_text(
                        final_claim_text
                    )

                    # Extract final payment amount from input
                    # Try odata attribute first (most reliable based on HTML structure),
                    # then fallback to value attribute, then input_value()
                    final_payment_input = page.locator("input#txtFinalClaimAmount")
                    final_payment_amount = 0.0

                    # Try odata attribute first
                    try:
                        odata_value = await final_payment_input.get_attribute("odata")
                        if odata_value:
                            final_payment_amount = (
                                PlaywrightBotService._parse_amount_from_text(
                                    odata_value
                                )
                            )
                            if final_payment_amount > 0:
                                logger.info(
                                    f"Read final payment from odata attribute: {final_payment_amount}"
                                )
                    except Exception as e:
                        logger.debug(f"Could not read odata attribute: {str(e)}")

                    # Fallback to value attribute
                    if final_payment_amount == 0.0:
                        try:
                            value_attr = await final_payment_input.get_attribute(
                                "value"
                            )
                            if value_attr:
                                final_payment_amount = (
                                    PlaywrightBotService._parse_amount_from_text(
                                        value_attr
                                    )
                                )
                                if final_payment_amount > 0:
                                    logger.info(
                                        f"Read final payment from value attribute: {final_payment_amount}"
                                    )
                        except Exception as e:
                            logger.debug(f"Could not read value attribute: {str(e)}")

                    # Fallback to input_value()
                    if final_payment_amount == 0.0:
                        try:
                            final_payment_value = await final_payment_input.input_value(
                                timeout=5000
                            )
                            final_payment_amount = (
                                PlaywrightBotService._parse_amount_from_text(
                                    final_payment_value
                                )
                            )
                            if final_payment_amount > 0:
                                logger.info(
                                    f"Read final payment from input_value(): {final_payment_amount}"
                                )
                        except Exception as e:
                            logger.warning(
                                f"Could not read final payment from input_value(): {str(e)}"
                            )

                    # Note: Not logging financial amounts to protect ePHI
                    logger.debug(f"Validation completed for patient {i+1}/{row_count}")

                    # Validate: final payment >= final claim
                    is_valid = final_payment_amount >= final_claim_amount

                    validation_result = {
                        "patient_name": patient_name.strip(),
                        "patient_number": (
                            patient_number.strip() if patient_number else None
                        ),
                        "final_claim_amount": final_claim_amount,
                        "final_payment_amount": final_payment_amount,
                        "is_valid": is_valid,
                        "validation_message": (
                            "Payment >= Claim" if is_valid else "Payment < Claim"
                        ),
                    }

                    validation_results.append(validation_result)
                    # Note: Not logging validation result details to protect ePHI
                    logger.info(
                        f"Patient {i+1}/{row_count} validation: {'valid' if is_valid else 'invalid'}"
                    )

                    # Close the dialog and verify it's closed
                    try:
                        close_button = page.locator(
                            "button.ui-button:has-text('Close'):visible"
                        )
                        # Wait for close button to be visible
                        await close_button.wait_for(state="visible", timeout=5000)
                        await close_button.click(timeout=5000)

                        # Wait for dialog to be hidden by checking if it's no longer visible
                        dialog_locator = page.locator(
                            "div.ui-dialog:visible, div.ui-dialog-content:visible"
                        )
                        # Wait up to 5 seconds for dialog to disappear
                        for _ in range(10):  # Check 10 times over 5 seconds
                            count = await dialog_locator.count()
                            if count == 0:
                                break
                            await page.wait_for_timeout(500)

                        await page.wait_for_timeout(1000)
                    except Exception as e:
                        # If close button click fails, try Escape key
                        logger.warning(
                            f"Close button click failed for patient {i+1}, trying Escape key: {type(e).__name__}"
                        )
                        try:
                            await page.keyboard.press("Escape")
                            await page.wait_for_timeout(1000)
                        except:
                            pass

                except Exception as patient_error:
                    # Note: Only logging error type to protect ePHI that might be in error message
                    logger.error(
                        f"Error validating patient {i+1}: {type(patient_error).__name__}"
                    )
                    validation_results.append(
                        {
                            "patient_name": f"Patient {i+1}",
                            "patient_number": None,  # Could not extract patient number due to error
                            "final_claim_amount": 0.0,
                            "final_payment_amount": 0.0,
                            "is_valid": False,
                            "validation_message": "Task Failed",
                            "error": str(patient_error),
                        }
                    )

                    # Try to close dialog if it's still open
                    try:
                        close_button = page.locator(
                            "button.ui-button:has-text('Close')"
                        )
                        if await close_button.count() > 0:
                            await close_button.click(timeout=2000)
                            await page.wait_for_timeout(500)
                    except:
                        pass

            return validation_results

        except Exception as e:
            # Note: Only logging error type to protect potential ePHI in exception message
            logger.error(f"Error validating patients: {type(e).__name__}")
            raise

    @staticmethod
    def _parse_amount_from_text(text: str) -> float:
        """
        Parse dollar amount from text.
        Handles:
        - "for $ amount" pattern (e.g., "Final Claim Sent on 11/07/2025, for $ 1,385.08 By Synergy")
        - "$ amount" pattern (e.g., "$ 1338.89")
        - Plain number (e.g., "1338.89" from odata attribute)

        Args:
            text: Text containing dollar amount

        Returns:
            Float amount
        """
        try:
            import re

            if not text:
                return 0.0

            text = text.strip()
            text_no_commas = text.replace(",", "")

            # First try to match "for $ amount" pattern (for Final Claim and RAP formats)
            # This avoids matching date numbers like "11/06/2025"
            match = re.search(r"for\s+\$\s*([\d,]+\.?\d*)", text_no_commas)

            # Fallback to general "$ amount" pattern if "for $" pattern not found
            if not match:
                match = re.search(r"\$\s*([\d,]+\.?\d*)", text_no_commas)

            # If still no match, try to match a plain number (for odata attributes)
            if not match:
                match = re.search(r"^([\d,]+\.?\d*)$", text_no_commas)

            if match:
                return float(match.group(1).replace(",", ""))
            return 0.0
        except Exception as e:
            # Note: Not logging amount text to protect financial ePHI
            logger.warning(f"Error parsing amount: {str(e)}")
            return 0.0

    @staticmethod
    async def _extract_claim_and_paid_amounts(page: Page) -> Tuple[float, float, int]:
        """
        Extract claim and paid amounts from the RA page.
        This is used when a file is already posted - we just need to read the values.

        Args:
            page: Playwright page object

        Returns:
            Tuple of (final_claim_amount, final_payment_amount, patient_count)
        """
        try:
            # Wait for patient details to be visible
            await PlaywrightBotService._ensure_patient_details_visible(page)

            # Get all patient rows to extract amounts from each
            patient_rows = page.locator("#details_grid tbody tr[role='row']")
            row_count = await patient_rows.count()
            logger.info(f"Extracting amounts from {row_count} patients")

            total_claim_amount = 0.0
            total_paid_amount = 0.0

            for i in range(row_count):
                try:
                    row = patient_rows.nth(i)
                    patient_link = row.locator("a.underlineAnc")

                    # Click on patient name to open dialog
                    await patient_link.click(timeout=10000)
                    await page.wait_for_timeout(1500)

                    # Wait for dialog to be visible
                    await page.wait_for_selector(
                        "label#spActualEpisode",
                        timeout=20000,
                    )

                    # Extract final claim amount from label
                    final_claim_label = page.locator("label#spActualEpisode")
                    final_claim_text = await final_claim_label.text_content(
                        timeout=5000
                    )

                    # Parse final claim amount
                    final_claim_amount = PlaywrightBotService._parse_amount_from_text(
                        final_claim_text
                    )

                    # Extract final payment amount from input
                    final_payment_input = page.locator("input#txtFinalClaimAmount")
                    final_payment_amount = 0.0

                    # Try odata attribute first
                    try:
                        odata_value = await final_payment_input.get_attribute("odata")
                        if odata_value:
                            final_payment_amount = (
                                PlaywrightBotService._parse_amount_from_text(
                                    odata_value
                                )
                            )
                    except Exception:
                        pass

                    # Fallback to value attribute
                    if final_payment_amount == 0.0:
                        try:
                            value_attr = await final_payment_input.get_attribute(
                                "value"
                            )
                            if value_attr:
                                final_payment_amount = (
                                    PlaywrightBotService._parse_amount_from_text(
                                        value_attr
                                    )
                                )
                        except Exception:
                            pass

                    # Fallback to input_value()
                    if final_payment_amount == 0.0:
                        try:
                            final_payment_value = await final_payment_input.input_value(
                                timeout=5000
                            )
                            final_payment_amount = (
                                PlaywrightBotService._parse_amount_from_text(
                                    final_payment_value
                                )
                            )
                        except Exception:
                            pass

                    total_claim_amount += final_claim_amount
                    total_paid_amount += final_payment_amount

                    # Close the dialog
                    try:
                        close_button = page.locator(
                            "button.ui-button:has-text('Close'):visible"
                        )
                        await close_button.wait_for(state="visible", timeout=5000)
                        await close_button.click(timeout=5000)
                        await page.wait_for_timeout(1000)
                    except Exception:
                        # Try Escape key as fallback
                        try:
                            await page.keyboard.press("Escape")
                            await page.wait_for_timeout(1000)
                        except:
                            pass

                except Exception as patient_error:
                    logger.warning(
                        f"Error extracting amounts from patient {i+1}: {type(patient_error).__name__}"
                    )
                    # Try to close dialog if still open
                    try:
                        close_button = page.locator(
                            "button.ui-button:has-text('Close')"
                        )
                        if await close_button.count() > 0:
                            await close_button.click(timeout=2000)
                            await page.wait_for_timeout(500)
                    except:
                        pass

            logger.info(
                f"Extracted total claim: {total_claim_amount}, total paid: {total_paid_amount}, "
                f"from {row_count} patients"
            )
            return total_claim_amount, total_paid_amount, row_count

        except Exception as e:
            logger.error(f"Error extracting claim and paid amounts: {type(e).__name__}")
            return 0.0, 0.0, 0

    @staticmethod
    async def _review_all_patients(page: Page) -> bool:
        """
        Review all patients in the RA Page by selecting each row, clicking Review,
        saving and closing the review dialog for each patient.

        Args:
            page: Playwright page object

        Returns:
            True if all patients were reviewed successfully, False otherwise
        """
        try:
            # Wait for the patient table to be visible
            await page.wait_for_selector(
                "#details_grid tbody tr[role='row']",
                timeout=20000,  # Increased from 10000ms to 20000ms
            )

            max_passes = (
                5  # safety to avoid infinite loops if something prevents completion
            )
            for pass_idx in range(max_passes):
                # Collect ids of patients that are not yet reviewed
                patient_rows = page.locator("#details_grid tbody tr[role='row']")
                row_count = await patient_rows.count()
                pending_ids: list[str] = []

                for i in range(row_count):
                    row = patient_rows.nth(i)
                    row_id = await row.get_attribute("id")
                    if not row_id:
                        continue
                    checkbox = page.locator(f"#cb_{row_id}")
                    checkbox_classes = (
                        await checkbox.get_attribute("class") or ""
                    ).split()
                    if "checked_tag_disabled" not in checkbox_classes:
                        pending_ids.append(row_id)

                logger.info(
                    f"Pass {pass_idx+1}: {len(pending_ids)} pending patients (from {row_count} rows)"
                )

                if not pending_ids:
                    logger.info("No unchecked patients remain; stopping.")
                    break

                # Review patients by id so row reordering does not matter
                for idx, row_id in enumerate(pending_ids):
                    try:
                        logger.info(
                            f"Pass {pass_idx+1}: Processing patient {idx+1}/{len(pending_ids)} (row id: {row_id})"
                        )

                        checkbox = page.locator(f"#cb_{row_id}")
                        checkbox_classes = (
                            await checkbox.get_attribute("class") or ""
                        ).split()
                        if "checked_tag_disabled" in checkbox_classes:
                            logger.info(
                                f"Pass {pass_idx+1}: Patient {idx+1} already reviewed, skipping"
                            )
                            continue

                        row = page.locator(
                            f"#details_grid tbody tr[role='row'][id='{row_id}']"
                        )

                        # Click on the row to select it (click in the center of the row)
                        logger.info(
                            f"Pass {pass_idx+1}: Clicking on patient row {idx+1} (id: {row_id})"
                        )
                        await row.click(timeout=5000)
                        await page.wait_for_timeout(500)

                        # Click Review button
                        logger.info(
                            f"Pass {pass_idx+1}: Clicking Review button for patient {idx+1}"
                        )
                        review_button = page.locator("#btnReviewRAEntry")
                        await review_button.click(
                            timeout=10000
                        )  # Increased from 5000ms to 10000ms
                        await page.wait_for_timeout(1000)

                        # Wait for the review dialog to appear
                        logger.info(
                            f"Pass {pass_idx+1}: Waiting for review dialog to open for patient {idx+1}"
                        )
                        save_button = page.locator("#btnSave")
                        await save_button.wait_for(
                            state="visible", timeout=20000
                        )  # Increased from 10000ms to 20000ms

                        # Click Save button in the dialog
                        logger.info(
                            f"Pass {pass_idx+1}: Clicking Save button in review dialog for patient {idx+1}"
                        )
                        await save_button.click(timeout=5000)
                        await page.wait_for_timeout(1000)

                        # Click Close button in the dialog
                        logger.info(
                            f"Pass {pass_idx+1}: Clicking Close button in review dialog for patient {idx+1}"
                        )
                        close_dialog_button = page.locator(
                            "button.ui-button:has-text('Close')"
                        ).first
                        await close_dialog_button.click(timeout=5000)
                        await page.wait_for_timeout(1000)

                        # Wait for dialog to close and verify checkbox is now marked
                        try:
                            await save_button.wait_for(state="hidden", timeout=5000)
                            logger.info(
                                f"Pass {pass_idx+1}: Review dialog closed for patient {idx+1}"
                            )

                            await page.wait_for_timeout(500)
                            updated_checkbox_classes = (
                                await checkbox.get_attribute("class") or ""
                            )
                            if "checked_tag_disabled" in updated_checkbox_classes:
                                logger.info(
                                    f"Pass {pass_idx+1}: Patient {idx+1} successfully reviewed and marked"
                                )
                            else:
                                logger.warning(
                                    f"Pass {pass_idx+1}: Patient {idx+1} checkbox may not be marked yet"
                                )
                        except Exception as verify_err:
                            logger.warning(
                                f"Pass {pass_idx+1}: Could not verify dialog closed for patient {idx+1}: {verify_err}"
                            )

                    except Exception as patient_review_error:
                        logger.error(
                            f"Pass {pass_idx+1}: Error reviewing patient {idx+1}: {str(patient_review_error)}"
                        )
                        # Try to close dialog if it's still open
                        try:
                            close_dialog_button = page.locator(
                                "button.ui-button:has-text('Close')"
                            ).first
                            if await close_dialog_button.count() > 0:
                                await close_dialog_button.click(timeout=2000)
                                await page.wait_for_timeout(500)
                        except:
                            pass
                        # Continue with next patient
                        continue

            # Final verification: ensure no unchecked rows remain
            unchecked_count = await page.locator(
                "#details_grid tbody tr[role='row'] div[id^='cb_']:not(.checked_tag_disabled)"
            ).count()
            if unchecked_count > 0:
                logger.warning(
                    f"{unchecked_count} patients remain unchecked after review passes"
                )
                return False

            logger.info("All patients reviewed successfully")
            return True

        except Exception as e:
            # Note: Only logging error type to protect potential ePHI
            logger.error(f"Error reviewing patients: {type(e).__name__}")
            return False

    @staticmethod
    async def _close_ra_page(page: Page) -> bool:
        """
        Review all patients, post, and close the RA Page.

        Args:
            page: Playwright page object

        Returns:
            True if successful
        """
        try:
            # Review all patients
            review_success = await PlaywrightBotService._review_all_patients(page)
            if not review_success:
                logger.warning("Some patients may not have been reviewed successfully")

            # After all patients are reviewed, click Post button
            logger.info("All patients reviewed, clicking Post button")
            post_button = page.locator("#btnPostRADetail")
            await post_button.click(timeout=5000)
            # Confirm the post action by clicking Yes on the confirmation dialog
            try:
                logger.info("Waiting for Post confirmation dialog")
                yes_button = page.locator(
                    "div.ui-dialog-buttonset button:has-text('Yes')"
                ).first
                await yes_button.wait_for(
                    state="visible", timeout=20000
                )  # Increased from 10000ms to 20000ms
                logger.info("Clicking Yes on Post confirmation dialog")
                await yes_button.click(timeout=5000)
                await page.wait_for_timeout(1000)
            except Exception as confirm_err:
                logger.error(f"Unable to confirm Post action: {confirm_err}")
                return False

            # Handle optional Posting Date dialog (enter date/confirm). We simply accept the default and click Ok.
            try:
                posting_dialog = page.locator("#dialog-PostWithDate")
                if (
                    await posting_dialog.count() > 0
                    and await posting_dialog.is_visible()
                ):
                    logger.info("Posting Date dialog detected, clicking Ok")
                    dialog_container = posting_dialog.locator(
                        "xpath=ancestor::div[contains(@class,'ui-dialog')][1]"
                    )
                    ok_button = dialog_container.locator(
                        "div.ui-dialog-buttonset button:has-text('Ok')"
                    ).first
                    await ok_button.click(timeout=5000)
                    await page.wait_for_timeout(500)
                    return True
            except Exception as post_date_err:
                logger.error(f"Unable to handle Posting Date dialog: {post_date_err}")
                return False

            # Click Close button to close the RA page
            logger.info("Clicking Close button to close RA Page")
            close_button = page.locator("#btnCloseRADetail")
            await close_button.click(timeout=5000)
            await page.wait_for_timeout(1000)

            logger.info(
                "Successfully reviewed all patients, posted, and closed RA Page"
            )
            return True

        except Exception as e:
            # Note: Only logging error type to protect potential ePHI
            logger.error(f"Error reviewing patients and closing: {type(e).__name__}")
            return False
