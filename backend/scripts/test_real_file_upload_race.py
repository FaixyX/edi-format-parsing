#!/usr/bin/env python3
"""
Test script to simulate real file upload race conditions.

This script tests the exact file upload pattern used in production:
- expect_file_chooser() pattern
- Multiple concurrent uploads
- Proxy behavior during file chooser operations

Usage:
    python scripts/test_real_file_upload_race.py --concurrent 15
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
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


class RealFileUploadRaceTest:
    """Test real file upload race conditions."""

    def __init__(self, concurrent_tasks: int = 15):
        self.concurrent_tasks = concurrent_tasks
        self.results: List[Dict[str, Any]] = []

    async def simulate_real_file_upload(self, task_id: int) -> Dict[str, Any]:
        """
        Simulate the exact file upload pattern used in production.

        This matches the pattern in _upload_edi_file():
        1. Click button
        2. expect_file_chooser()
        3. set_files()
        """
        result = {
            "task_id": task_id,
            "started_at": time.time(),
            "upload_success": False,
            "error": None,
            "error_type": None,
            "stage": None,  # Which stage failed
            "timings": {},
        }

        try:
            async with browser_manager.get_context(use_proxy=True) as context:
                page = await browser_manager.get_page(context)

                try:
                    # Create test file
                    temp_file = tempfile.NamedTemporaryFile(
                        mode="w", suffix=".edi", delete=False
                    )
                    temp_file.write(
                        "ISA*00*          *00*          *ZZ*TEST          *ZZ*TEST          *"
                    )
                    temp_file.close()
                    temp_file_path = temp_file.name

                    try:
                        # Stage 1: Navigate to page with file upload
                        stage1_start = time.time()
                        result["stage"] = "navigation"
                        await page.goto("https://httpbin.org/forms/post", timeout=30000)
                        result["timings"]["navigation"] = time.time() - stage1_start

                        # Stage 2: Wait for upload button/form (simulates waiting for dialog)
                        stage2_start = time.time()
                        result["stage"] = "waiting_for_form"
                        await page.wait_for_selector(
                            'input[type="file"]', timeout=10000
                        )
                        result["timings"]["wait_for_form"] = time.time() - stage2_start

                        # Stage 3: Click button and expect file chooser (PRODUCTION PATTERN)
                        stage3_start = time.time()
                        result["stage"] = "file_chooser_setup"

                        # This is the critical part - the exact pattern from production
                        try:
                            # Simulate clicking a button that triggers file chooser
                            # In production: local_button.click() triggers file chooser
                            file_input = page.locator('input[type="file"]')

                            # Pattern 1: Direct set_input_files (simpler, but different from production)
                            # await file_input.set_input_files(temp_file_path)

                            # Pattern 2: expect_file_chooser pattern (matches production)
                            # This is what might fail with proxy
                            async with page.expect_file_chooser(
                                timeout=10000
                            ) as fc_info:
                                # Click the file input to trigger file chooser
                                await file_input.click(timeout=5000)

                            file_chooser = await fc_info.value
                            result["timings"]["file_chooser_wait"] = (
                                time.time() - stage3_start
                            )

                            # Stage 4: Set files (this is where it might fail)
                            stage4_start = time.time()
                            result["stage"] = "setting_files"
                            await file_chooser.set_files(temp_file_path)
                            result["timings"]["set_files"] = time.time() - stage4_start

                            # Stage 5: Wait for upload to complete
                            stage5_start = time.time()
                            result["stage"] = "upload_complete"
                            await asyncio.sleep(1)  # Give time for upload
                            result["timings"]["upload_wait"] = (
                                time.time() - stage5_start
                            )

                            result["upload_success"] = True
                            logger.info(
                                f"[Task {task_id}] File upload successful "
                                f"(total: {time.time() - result['started_at']:.2f}s)"
                            )

                        except PlaywrightTimeoutError as e:
                            result["error"] = (
                                f"Timeout at stage '{result['stage']}': {str(e)}"
                            )
                            result["error_type"] = "timeout"
                            result["timings"][f"{result['stage']}_timeout"] = (
                                time.time() - stage3_start
                            )
                            logger.error(
                                f"[Task {task_id}] Timeout at {result['stage']}: {e}"
                            )
                        except Exception as e:
                            result["error"] = (
                                f"Error at stage '{result['stage']}': {str(e)}"
                            )
                            result["error_type"] = type(e).__name__
                            logger.error(
                                f"[Task {task_id}] Error at {result['stage']}: {e}"
                            )

                    finally:
                        try:
                            os.unlink(temp_file_path)
                        except Exception:
                            pass

                except Exception as e:
                    result["error"] = str(e)
                    result["error_type"] = type(e).__name__
                    logger.error(f"[Task {task_id}] Test failed: {e}")
                finally:
                    await page.close()

        except Exception as e:
            result["error"] = str(e)
            result["error_type"] = type(e).__name__
            logger.error(f"[Task {task_id}] Context creation failed: {e}")

        result["total_duration"] = time.time() - result["started_at"]
        result["completed_at"] = time.time()
        return result

    async def run_concurrent_tests(self) -> Dict[str, Any]:
        """Run concurrent real file upload tests."""
        logger.info(
            f"Starting {self.concurrent_tasks} concurrent real file upload tests..."
        )

        # Start all tasks with minimal stagger
        tasks = []
        for i in range(self.concurrent_tasks):
            task = asyncio.create_task(self.simulate_real_file_upload(i + 1))
            tasks.append(task)
            # Very small stagger (10ms) to simulate real-world scenario
            await asyncio.sleep(0.01)

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        successful = sum(
            1 for r in results if isinstance(r, dict) and r.get("upload_success")
        )
        failed = len(results) - successful

        # Analyze failures by stage
        failures_by_stage = {}
        error_types = {}
        for r in results:
            if isinstance(r, dict) and not r.get("upload_success"):
                stage = r.get("stage", "unknown")
                failures_by_stage[stage] = failures_by_stage.get(stage, 0) + 1
                error_type = r.get("error_type", "unknown")
                error_types[error_type] = error_types.get(error_type, 0) + 1

        # Calculate average timings for successful uploads
        avg_timings = {}
        if successful > 0:
            successful_results = [
                r for r in results if isinstance(r, dict) and r.get("upload_success")
            ]
            if successful_results:
                all_timings = {}
                for r in successful_results:
                    for key, value in r.get("timings", {}).items():
                        if key not in all_timings:
                            all_timings[key] = []
                        all_timings[key].append(value)

                avg_timings = {
                    key: sum(values) / len(values)
                    for key, values in all_timings.items()
                }

        return {
            "test_type": "real_file_upload_race",
            "total": len(results),
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / len(results) * 100) if results else 0,
            "failures_by_stage": failures_by_stage,
            "error_types": error_types,
            "average_timings": avg_timings,
            "results": results,
        }

    def print_summary(self, results: Dict[str, Any]):
        """Print detailed test summary."""
        print("\n" + "=" * 80)
        print("REAL FILE UPLOAD RACE CONDITION TEST SUMMARY")
        print("=" * 80)
        print(f"Total Tasks: {results['total']}")
        print(f"Successful: {results['successful']}")
        print(f"Failed: {results['failed']}")
        print(f"Success Rate: {results['success_rate']:.1f}%")

        if results["failures_by_stage"]:
            print("\nFailures by Stage:")
            for stage, count in results["failures_by_stage"].items():
                print(f"  {stage}: {count}")

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
                    print(f"    Stage: {result.get('stage', 'unknown')}")
                    print(f"    Error: {result.get('error', 'Unknown')}")
                    print(f"    Error Type: {result.get('error_type', 'Unknown')}")
                    if result.get("timings"):
                        print(f"    Timings: {result['timings']}")

        print("\n" + "=" * 80)


async def main():
    parser = argparse.ArgumentParser(
        description="Test real file upload race conditions"
    )
    parser.add_argument(
        "--concurrent",
        type=int,
        default=15,
        help="Number of concurrent tasks (default: 15)",
    )

    args = parser.parse_args()

    test = RealFileUploadRaceTest(concurrent_tasks=args.concurrent)

    try:
        if not browser_manager.is_ready:
            logger.info("Starting browser manager...")
            await browser_manager.start()

        results = await test.run_concurrent_tests()
        test.print_summary(results)

    finally:
        if browser_manager.is_ready:
            await browser_manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
