#!/usr/bin/env python3
"""
Test script to investigate file upload timing and proxy behavior.

This script specifically tests:
1. File upload timing with proxy
2. Network request patterns during file upload
3. Proxy connection stability during file operations
4. Compare behavior with and without proxy

Usage:
    python scripts/test_proxy_file_upload_timing.py --with-proxy --concurrent 15
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
import json

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
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ProxyFileUploadTimingTest:
    """Test file upload timing with proxy."""

    def __init__(self, concurrent_tasks: int = 15, use_proxy: bool = True):
        self.concurrent_tasks = concurrent_tasks
        self.use_proxy = use_proxy
        self.results: List[Dict[str, Any]] = []

    async def test_file_upload_with_network_monitoring(
        self, task_id: int
    ) -> Dict[str, Any]:
        """Test file upload while monitoring network requests."""
        result = {
            "task_id": task_id,
            "use_proxy": self.use_proxy,
            "started_at": time.time(),
            "upload_success": False,
            "error": None,
            "error_type": None,
            "timings": {},
            "network_requests": [],
            "proxy_connection_time": None,
            "file_upload_time": None,
            "total_duration": None,
        }

        try:
            async with browser_manager.get_context(use_proxy=self.use_proxy) as context:
                context_start = time.time()
                result["timings"]["context_creation"] = time.time() - context_start

                page = await browser_manager.get_page(context)
                page_start = time.time()
                result["timings"]["page_creation"] = time.time() - page_start

                # Monitor network requests
                requests_log = []

                def handle_request(request):
                    requests_log.append(
                        {
                            "url": request.url,
                            "method": request.method,
                            "resource_type": request.resource_type,
                            "timestamp": time.time(),
                        }
                    )

                def handle_response(response):
                    for req in requests_log:
                        if req["url"] == response.url:
                            req["status"] = response.status
                            req["response_time"] = time.time() - req["timestamp"]

                page.on("request", handle_request)
                page.on("response", handle_response)

                try:
                    # Create test file
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w", suffix=".txt", delete=False
                    )
                    temp_file.write("Test EDI file content for upload timing test")
                    temp_file.close()
                    temp_file_path = temp_file.name

                    try:
                        # Navigate to test page
                        nav_start = time.time()
                        await page.goto("https://httpbin.org/forms/post", timeout=30000)
                        result["timings"]["navigation"] = time.time() - nav_start

                        # Test proxy connection (if using proxy)
                        if self.use_proxy:
                            proxy_test_start = time.time()
                            try:
                                await page.goto("https://httpbin.org/ip", timeout=10000)
                                result["proxy_connection_time"] = (
                                    time.time() - proxy_test_start
                                )
                                ip_content = await page.text_content("body")
                                result["proxy_ip"] = json.loads(ip_content).get(
                                    "origin"
                                )
                            except Exception as e:
                                logger.warning(
                                    f"[Task {task_id}] Proxy IP check failed: {e}"
                                )

                        # Navigate back to form
                        await page.goto("https://httpbin.org/forms/post", timeout=30000)

                        # File upload
                        upload_start = time.time()
                        file_input = page.locator('input[type="file"]')

                        try:
                            await file_input.set_input_files(temp_file_path)
                            result["file_upload_time"] = time.time() - upload_start
                            result["upload_success"] = True

                            # Wait a bit for any network activity
                            await asyncio.sleep(1)

                        except PlaywrightTimeoutError as e:
                            result["error"] = f"Upload timeout: {str(e)}"
                            result["error_type"] = "timeout"
                            result["file_upload_time"] = time.time() - upload_start
                        except Exception as e:
                            result["error"] = str(e)
                            result["error_type"] = type(e).__name__
                            result["file_upload_time"] = time.time() - upload_start

                        result["network_requests"] = requests_log

                    finally:
                        try:
                            os.unlink(temp_file_path)
                        except Exception:
                            pass

                except Exception as e:
                    result["error"] = str(e)
                    result["error_type"] = type(e).__name__
                finally:
                    await page.close()

        except Exception as e:
            result["error"] = str(e)
            result["error_type"] = type(e).__name__
            logger.error(f"[Task {task_id}] Test failed: {e}")

        result["total_duration"] = time.time() - result["started_at"]
        result["completed_at"] = time.time()
        return result

    async def run_concurrent_tests(self) -> Dict[str, Any]:
        """Run concurrent file upload tests."""
        logger.info(
            f"Starting {self.concurrent_tasks} concurrent file upload tests "
            f"(proxy: {'enabled' if self.use_proxy else 'disabled'})..."
        )

        # Stagger start times slightly
        tasks = []
        for i in range(self.concurrent_tasks):
            task = asyncio.create_task(
                self.test_file_upload_with_network_monitoring(i + 1)
            )
            tasks.append(task)
            # Small stagger to avoid all hitting at exact same time
            await asyncio.sleep(0.1)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = sum(
            1 for r in results if isinstance(r, dict) and r.get("upload_success")
        )
        failed = len(results) - successful

        # Analyze errors
        error_types = {}
        for r in results:
            if isinstance(r, dict) and r.get("error_type"):
                error_type = r["error_type"]
                error_types[error_type] = error_types.get(error_type, 0) + 1

        # Calculate average timings
        avg_timings = {}
        if successful > 0:
            successful_results = [
                r for r in results if isinstance(r, dict) and r.get("upload_success")
            ]
            if successful_results:
                avg_timings = {
                    "avg_context_creation": sum(
                        r.get("timings", {}).get("context_creation", 0)
                        for r in successful_results
                    )
                    / len(successful_results),
                    "avg_file_upload": sum(
                        r.get("file_upload_time", 0) for r in successful_results
                    )
                    / len(successful_results),
                    "avg_total_duration": sum(
                        r.get("total_duration", 0) for r in successful_results
                    )
                    / len(successful_results),
                }

        return {
            "test_type": "proxy_file_upload_timing",
            "use_proxy": self.use_proxy,
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / len(results) * 100) if results else 0,
            "error_types": error_types,
            "average_timings": avg_timings,
            "results": results,
        }

    def print_summary(self, results: Dict[str, Any]):
        """Print detailed test summary."""
        print("\n" + "=" * 80)
        print("FILE UPLOAD TIMING TEST SUMMARY")
        print("=" * 80)
        print(f"Proxy: {'Enabled' if results['use_proxy'] else 'Disabled'}")
        print(f"Total Tasks: {results['total']}")
        print(f"Successful: {results['successful']}")
        print(f"Failed: {results['failed']}")
        print(f"Success Rate: {results['success_rate']:.1f}%")

        if results["error_types"]:
            print("\nError Types:")
            for error_type, count in results["error_types"].items():
                print(f"  {error_type}: {count}")

        if results["average_timings"]:
            print("\nAverage Timings (successful tasks):")
            for timing_name, timing_value in results["average_timings"].items():
                print(f"  {timing_name}: {timing_value:.3f}s")

        # Show detailed results for failed tasks
        if results["failed"] > 0:
            print("\nFailed Task Details:")
            for result in results["results"]:
                if isinstance(result, dict) and not result.get("upload_success"):
                    print(f"\n  Task {result.get('task_id', '?')}:")
                    print(f"    Error: {result.get('error', 'Unknown')}")
                    print(f"    Error Type: {result.get('error_type', 'Unknown')}")
                    if result.get("file_upload_time"):
                        print(f"    Upload Time: {result['file_upload_time']:.3f}s")
                    if result.get("timings"):
                        print(f"    Timings: {result['timings']}")

        print("\n" + "=" * 80)


async def main():
    parser = argparse.ArgumentParser(description="Test file upload timing with proxy")
    parser.add_argument(
        "--concurrent",
        type=int,
        default=15,
        help="Number of concurrent tasks (default: 15)",
    )
    parser.add_argument(
        "--with-proxy",
        action="store_true",
        help="Test with proxy enabled (default: False)",
    )
    parser.add_argument(
        "--without-proxy",
        action="store_true",
        help="Test without proxy (default: False)",
    )
    parser.add_argument(
        "--both",
        action="store_true",
        help="Test both with and without proxy",
    )

    args = parser.parse_args()

    try:
        if args.both or (not args.with_proxy and not args.without_proxy):
            # Test both
            logger.info("Testing with proxy...")
            test_with_proxy = ProxyFileUploadTimingTest(
                concurrent_tasks=args.concurrent, use_proxy=True
            )
            if not browser_manager.is_ready:
                await browser_manager.start()
            results_with = await test_with_proxy.run_concurrent_tests()
            test_with_proxy.print_summary(results_with)

            await asyncio.sleep(2)

            logger.info("\nTesting without proxy...")
            test_without_proxy = ProxyFileUploadTimingTest(
                concurrent_tasks=args.concurrent, use_proxy=False
            )
            results_without = await test_without_proxy.run_concurrent_tests()
            test_without_proxy.print_summary(results_without)

            # Compare
            print("\n" + "=" * 80)
            print("COMPARISON")
            print("=" * 80)
            print(f"With Proxy - Success Rate: {results_with['success_rate']:.1f}%")
            print(
                f"Without Proxy - Success Rate: {results_without['success_rate']:.1f}%"
            )

        elif args.with_proxy:
            test = ProxyFileUploadTimingTest(
                concurrent_tasks=args.concurrent, use_proxy=True
            )
            if not browser_manager.is_ready:
                await browser_manager.start()
            results = await test.run_concurrent_tests()
            test.print_summary(results)

        else:  # without_proxy
            test = ProxyFileUploadTimingTest(
                concurrent_tasks=args.concurrent, use_proxy=False
            )
            if not browser_manager.is_ready:
                await browser_manager.start()
            results = await test.run_concurrent_tests()
            test.print_summary(results)

    finally:
        if browser_manager.is_ready:
            await browser_manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
