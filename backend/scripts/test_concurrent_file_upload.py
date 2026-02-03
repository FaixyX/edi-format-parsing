#!/usr/bin/env python3
"""
Test script to investigate file upload failures with concurrent tasks.

This script tests:
1. Multiple concurrent logins (should work)
2. Multiple concurrent file uploads (may fail)
3. Proxy connection behavior during file operations
4. Timing and race conditions

Usage:
    python scripts/test_concurrent_file_upload.py --concurrent 10
"""
import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Any
import tempfile

# Setup path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
# Also add backend directory to path for app imports
if str(PROJECT_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from dotenv import load_dotenv

# Load environment variables
env_files = [PROJECT_ROOT / ".env", BACKEND_DIR / ".env"]
for env_file in env_files:
    if env_file.exists():
        load_dotenv(env_file)

from app.services.browser_manager import browser_manager
from app.services.decodo_proxy import get_decodo_env_info
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


class FileUploadTest:
    """Test file upload behavior with concurrent tasks."""

    def __init__(self, concurrent_tasks: int = 10):
        self.concurrent_tasks = concurrent_tasks
        self.results: List[Dict[str, Any]] = []

    async def test_login_only(self, task_id: int) -> Dict[str, Any]:
        """Test login without file upload."""
        result = {
            "task_id": task_id,
            "test_type": "login_only",
            "started_at": time.time(),
            "login_success": False,
            "error": None,
            "duration": None,
        }

        try:
            async with browser_manager.get_context(use_proxy=True) as context:
                page = await browser_manager.get_page(context)

                try:
                    # Test navigation (simulates login)
                    logger.info(f"[Task {task_id}] Testing navigation/login...")
                    nav_start = time.time()

                    # Navigate to a test URL (or use actual login if you have test credentials)
                    await page.goto("https://httpbin.org/get", timeout=30000)

                    result["login_success"] = True
                    result["duration"] = time.time() - nav_start
                    logger.info(
                        f"[Task {task_id}] Login test successful ({result['duration']:.2f}s)"
                    )

                except Exception as e:
                    result["error"] = str(e)
                    logger.error(f"[Task {task_id}] Login test failed: {e}")
                finally:
                    await page.close()

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"[Task {task_id}] Context creation failed: {e}")

        result["completed_at"] = time.time()
        return result

    async def test_file_upload_simulation(self, task_id: int) -> Dict[str, Any]:
        """Test file upload simulation (without actual website)."""
        result = {
            "task_id": task_id,
            "test_type": "file_upload_simulation",
            "started_at": time.time(),
            "upload_success": False,
            "error": None,
            "duration": None,
            "proxy_info": None,
        }

        try:
            async with browser_manager.get_context(use_proxy=True) as context:
                page = await browser_manager.get_page(context)

                try:
                    # Create a temporary file for testing
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w", suffix=".txt", delete=False
                    )
                    temp_file.write("Test file content for upload simulation")
                    temp_file.close()
                    temp_file_path = temp_file.name

                    try:
                        logger.info(
                            f"[Task {task_id}] Testing file upload simulation..."
                        )
                        upload_start = time.time()

                        # Navigate to a page with file upload
                        await page.goto("https://httpbin.org/forms/post", timeout=30000)

                        # Try to interact with file input (simulates file chooser)
                        file_input = page.locator('input[type="file"]')

                        # Set files directly (simulates what set_files does)
                        await file_input.set_input_files(temp_file_path)

                        result["upload_success"] = True
                        result["duration"] = time.time() - upload_start
                        logger.info(
                            f"[Task {task_id}] File upload simulation successful ({result['duration']:.2f}s)"
                        )

                        # Get proxy info
                        try:
                            await page.goto("https://httpbin.org/ip", timeout=10000)
                            ip_content = await page.text_content("body")
                            result["proxy_info"] = ip_content
                        except Exception:
                            pass

                    finally:
                        # Clean up temp file
                        try:
                            os.unlink(temp_file_path)
                        except Exception:
                            pass

                except PlaywrightTimeoutError as e:
                    result["error"] = f"Timeout: {str(e)}"
                    logger.error(f"[Task {task_id}] File upload timeout: {e}")
                except Exception as e:
                    result["error"] = str(e)
                    logger.error(f"[Task {task_id}] File upload failed: {e}")
                finally:
                    await page.close()

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"[Task {task_id}] Context creation failed: {e}")

        result["completed_at"] = time.time()
        return result

    async def test_file_chooser_race_condition(self, task_id: int) -> Dict[str, Any]:
        """Test file chooser race condition with multiple concurrent attempts."""
        result = {
            "task_id": task_id,
            "test_type": "file_chooser_race",
            "started_at": time.time(),
            "chooser_success": False,
            "error": None,
            "duration": None,
        }

        try:
            async with browser_manager.get_context(use_proxy=True) as context:
                page = await browser_manager.get_page(context)

                try:
                    logger.info(
                        f"[Task {task_id}] Testing file chooser race condition..."
                    )
                    chooser_start = time.time()

                    # Create a temporary file
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w", suffix=".txt", delete=False
                    )
                    temp_file.write("Test file content")
                    temp_file.close()
                    temp_file_path = temp_file.name

                    try:
                        # Navigate to a page
                        await page.goto("https://httpbin.org/forms/post", timeout=30000)

                        # Try to trigger file chooser (this is what might fail with proxy)
                        file_input = page.locator('input[type="file"]')

                        # This simulates the expect_file_chooser pattern
                        # In real code: async with page.expect_file_chooser() as fc_info:
                        #              await button.click()
                        #              file_chooser = await fc_info.value
                        #              await file_chooser.set_files(path)

                        # Direct set_input_files (simpler, but might behave differently)
                        await file_input.set_input_files(temp_file_path)

                        result["chooser_success"] = True
                        result["duration"] = time.time() - chooser_start
                        logger.info(
                            f"[Task {task_id}] File chooser test successful ({result['duration']:.2f}s)"
                        )

                    finally:
                        try:
                            os.unlink(temp_file_path)
                        except Exception:
                            pass

                except PlaywrightTimeoutError as e:
                    result["error"] = f"Timeout: {str(e)}"
                    logger.error(f"[Task {task_id}] File chooser timeout: {e}")
                except Exception as e:
                    result["error"] = str(e)
                    logger.error(f"[Task {task_id}] File chooser failed: {e}")
                finally:
                    await page.close()

        except Exception as e:
            result["error"] = str(e)
            logger.error(f"[Task {task_id}] Context creation failed: {e}")

        result["completed_at"] = time.time()
        return result

    async def run_concurrent_login_tests(self) -> Dict[str, Any]:
        """Run multiple concurrent login tests."""
        logger.info(f"Starting {self.concurrent_tasks} concurrent login tests...")

        tasks = [self.test_login_only(i + 1) for i in range(self.concurrent_tasks)]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = sum(
            1 for r in results if isinstance(r, dict) and r.get("login_success")
        )
        failed = len(results) - successful

        return {
            "test_type": "concurrent_login",
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / len(results) * 100) if results else 0,
            "results": results,
        }

    async def run_concurrent_file_upload_tests(self) -> Dict[str, Any]:
        """Run multiple concurrent file upload tests."""
        logger.info(f"Starting {self.concurrent_tasks} concurrent file upload tests...")

        tasks = [
            self.test_file_upload_simulation(i + 1)
            for i in range(self.concurrent_tasks)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = sum(
            1 for r in results if isinstance(r, dict) and r.get("upload_success")
        )
        failed = len(results) - successful

        return {
            "test_type": "concurrent_file_upload",
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / len(results) * 100) if results else 0,
            "results": results,
        }

    async def run_concurrent_file_chooser_tests(self) -> Dict[str, Any]:
        """Run multiple concurrent file chooser tests."""
        logger.info(
            f"Starting {self.concurrent_tasks} concurrent file chooser tests..."
        )

        tasks = [
            self.test_file_chooser_race_condition(i + 1)
            for i in range(self.concurrent_tasks)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = sum(
            1 for r in results if isinstance(r, dict) and r.get("chooser_success")
        )
        failed = len(results) - successful

        return {
            "test_type": "concurrent_file_chooser",
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / len(results) * 100) if results else 0,
            "results": results,
        }

    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all test suites."""
        # Ensure browser is started
        if not browser_manager.is_ready:
            logger.info("Starting browser manager...")
            started = await browser_manager.start()
            if not started:
                raise RuntimeError("Failed to start browser manager")

        # Get proxy info
        proxy_info = get_decodo_env_info()
        logger.info(f"Proxy configuration: {proxy_info}")

        all_results = {}

        # Test 1: Concurrent logins
        logger.info("\n" + "=" * 80)
        logger.info("TEST 1: Concurrent Login Tests")
        logger.info("=" * 80)
        login_results = await self.run_concurrent_login_tests()
        all_results["login_tests"] = login_results

        # Wait a bit between test suites
        await asyncio.sleep(2)

        # Test 2: Concurrent file uploads
        logger.info("\n" + "=" * 80)
        logger.info("TEST 2: Concurrent File Upload Tests")
        logger.info("=" * 80)
        upload_results = await self.run_concurrent_file_upload_tests()
        all_results["upload_tests"] = upload_results

        # Wait a bit between test suites
        await asyncio.sleep(2)

        # Test 3: Concurrent file chooser
        logger.info("\n" + "=" * 80)
        logger.info("TEST 3: Concurrent File Chooser Tests")
        logger.info("=" * 80)
        chooser_results = await self.run_concurrent_file_chooser_tests()
        all_results["chooser_tests"] = chooser_results

        return all_results

    def print_summary(self, results: Dict[str, Any]):
        """Print test summary."""
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)

        for test_name, test_results in results.items():
            print(f"\n{test_name.upper().replace('_', ' ')}:")
            print(f"  Total: {test_results['total']}")
            print(f"  Successful: {test_results['successful']}")
            print(f"  Failed: {test_results['failed']}")
            print(f"  Success Rate: {test_results['success_rate']:.1f}%")

            # Show error details
            if test_results["failed"] > 0:
                print("\n  Error Details:")
                for result in test_results["results"]:
                    if isinstance(result, dict) and result.get("error"):
                        print(
                            f"    Task {result.get('task_id', '?')}: {result['error']}"
                        )

        print("\n" + "=" * 80)


async def main():
    parser = argparse.ArgumentParser(description="Test concurrent file upload behavior")
    parser.add_argument(
        "--concurrent",
        type=int,
        default=10,
        help="Number of concurrent tasks (default: 10)",
    )
    parser.add_argument(
        "--test-type",
        choices=["login", "upload", "chooser", "all"],
        default="all",
        help="Type of test to run (default: all)",
    )

    args = parser.parse_args()

    test = FileUploadTest(concurrent_tasks=args.concurrent)

    try:
        if args.test_type == "login":
            if not browser_manager.is_ready:
                await browser_manager.start()
            results = await test.run_concurrent_login_tests()
            test.print_summary({"login_tests": results})
        elif args.test_type == "upload":
            if not browser_manager.is_ready:
                await browser_manager.start()
            results = await test.run_concurrent_file_upload_tests()
            test.print_summary({"upload_tests": results})
        elif args.test_type == "chooser":
            if not browser_manager.is_ready:
                await browser_manager.start()
            results = await test.run_concurrent_file_chooser_tests()
            test.print_summary({"chooser_tests": results})
        else:
            results = await test.run_all_tests()
            test.print_summary(results)

    finally:
        # Clean up
        if browser_manager.is_ready:
            await browser_manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
