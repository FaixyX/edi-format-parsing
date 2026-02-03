#!/usr/bin/env python3
"""
Stress test script for Decodo proxy server.

This script tests the proxy server's ability to handle concurrent connections
by simulating multiple browser contexts (similar to Dramatiq worker threads).

Usage:
    python scripts/stress_test_proxy.py --concurrent 100 --duration 60
    python scripts/stress_test_proxy.py --test-levels 10,25,50,75,100
"""
import argparse
import asyncio
import json
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

# Setup path for imports
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv

# Load environment variables
env_files = [PROJECT_ROOT / ".env", BACKEND_DIR / ".env"]
for env_file in env_files:
    if env_file.exists():
        load_dotenv(env_file)

from app.services.browser_manager import browser_manager
from app.services.decodo_proxy import get_decodo_env_info

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ProxyStressTest:
    """Stress test for Decodo proxy with concurrent connections."""

    def __init__(
        self,
        concurrent_connections: int,
        test_duration: float = 60.0,
        hold_time: float = 10.0,
        test_url: Optional[str] = None,
    ):
        """
        Initialize stress test.

        Args:
            concurrent_connections: Number of concurrent browser contexts to create
            test_duration: How long to keep connections open (seconds)
            hold_time: How long each connection should stay active (seconds)
            test_url: Optional URL to navigate to (default: IP check endpoint)
        """
        self.concurrent_connections = concurrent_connections
        self.test_duration = test_duration
        self.hold_time = hold_time
        self.test_url = test_url or "https://ip.decodo.com/json"
        self.results: List[Dict[str, Any]] = []
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None

    async def _run_single_connection(
        self, connection_id: int, start_delay: float = 0.0
    ) -> Dict[str, Any]:
        """
        Run a single proxy connection test.

        Args:
            connection_id: Unique identifier for this connection
            start_delay: Delay before starting (to stagger connections)

        Returns:
            Dictionary with test results
        """
        if start_delay > 0:
            await asyncio.sleep(start_delay)

        result: Dict[str, Any] = {
            "connection_id": connection_id,
            "started_at": time.time(),
            "success": False,
            "error": None,
            "ip_info": None,
            "connection_time": None,
            "navigation_time": None,
            "total_time": None,
        }

        try:
            # Create browser context with proxy
            context_start = time.time()
            async with browser_manager.get_context(
                use_proxy=True, bandwidth_saver=True
            ) as context:
                result["connection_time"] = time.time() - context_start

                # Create page
                page = await browser_manager.get_page(context)

                try:
                    # Test IP endpoint (simulates proxy connection)
                    nav_start = time.time()
                    await page.goto(
                        self.test_url,
                        timeout=30000,  # 30 second timeout
                        wait_until="domcontentloaded",
                    )
                    result["navigation_time"] = time.time() - nav_start

                    # Get IP info
                    try:
                        ip_content = await page.text_content("body")
                        result["ip_info"] = ip_content
                        result["success"] = True
                    except Exception as e:
                        result["error"] = f"Failed to read IP info: {str(e)}"

                    # Hold connection for specified duration (simulates task processing)
                    if self.hold_time > 0:
                        await asyncio.sleep(self.hold_time)

                except Exception as e:
                    result["error"] = f"Navigation failed: {str(e)}"
                finally:
                    try:
                        await page.close()
                    except Exception:
                        pass

        except Exception as e:
            result["error"] = f"Context creation failed: {str(e)}"

        result["total_time"] = time.time() - result["started_at"]
        return result

    async def run_test(self) -> Dict[str, Any]:
        """
        Run the stress test with specified concurrent connections.

        Returns:
            Dictionary with test summary and detailed results
        """
        logger.info(
            f"Starting stress test: {self.concurrent_connections} concurrent connections, "
            f"duration={self.test_duration}s, hold_time={self.hold_time}s"
        )

        # Ensure browser manager is started
        if not browser_manager.is_ready:
            logger.info("Starting browser manager...")
            started = await browser_manager.start()
            if not started:
                raise RuntimeError("Failed to start browser manager")

        self.start_time = time.time()

        # Create tasks for all concurrent connections
        # Stagger start times slightly to avoid all hitting at once
        tasks = []
        stagger_delay = 0.1  # 100ms between each connection start

        for i in range(self.concurrent_connections):
            start_delay = i * stagger_delay
            task = asyncio.create_task(
                self._run_single_connection(i + 1, start_delay=start_delay)
            )
            tasks.append(task)

        # Wait for all tasks to complete or timeout
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=self.test_duration + 30,  # Add buffer for completion
            )
        except asyncio.TimeoutError:
            logger.warning("Test timed out - some connections may still be active")
            results = []
            for task in tasks:
                if not task.done():
                    task.cancel()
                try:
                    results.append(await task)
                except asyncio.CancelledError:
                    results.append({"error": "Task cancelled due to timeout"})
                except Exception as e:
                    results.append({"error": f"Task exception: {str(e)}"})

        # Process results
        self.results = []
        for result in results:
            if isinstance(result, Exception):
                self.results.append(
                    {
                        "connection_id": "unknown",
                        "error": str(result),
                        "success": False,
                    }
                )
            else:
                self.results.append(result)

        self.end_time = time.time()

        # Calculate statistics
        stats = self._calculate_statistics()

        return {
            "test_config": {
                "concurrent_connections": self.concurrent_connections,
                "test_duration": self.test_duration,
                "hold_time": self.hold_time,
                "test_url": self.test_url,
            },
            "summary": stats,
            "results": self.results,
        }

    def _calculate_statistics(self) -> Dict[str, Any]:
        """Calculate statistics from test results."""
        if not self.results:
            return {"error": "No results to analyze"}

        total = len(self.results)
        successful = sum(1 for r in self.results if r.get("success", False))
        failed = total - successful

        # Connection times
        connection_times = [
            r["connection_time"]
            for r in self.results
            if r.get("connection_time") is not None
        ]

        # Navigation times
        navigation_times = [
            r["navigation_time"]
            for r in self.results
            if r.get("navigation_time") is not None
        ]

        # Total times
        total_times = [
            r["total_time"] for r in self.results if r.get("total_time") is not None
        ]

        # Error analysis
        errors = defaultdict(int)
        for r in self.results:
            if r.get("error"):
                error_msg = r["error"]
                # Categorize errors
                if "timeout" in error_msg.lower():
                    errors["timeout"] += 1
                elif (
                    "connection" in error_msg.lower() or "refused" in error_msg.lower()
                ):
                    errors["connection_refused"] += 1
                elif "proxy" in error_msg.lower():
                    errors["proxy_error"] += 1
                elif (
                    "authentication" in error_msg.lower() or "auth" in error_msg.lower()
                ):
                    errors["authentication"] += 1
                else:
                    errors["other"] += 1

        stats = {
            "total_connections": total,
            "successful": successful,
            "failed": failed,
            "success_rate": (successful / total * 100) if total > 0 else 0,
            "connection_times": {
                "min": min(connection_times) if connection_times else None,
                "max": max(connection_times) if connection_times else None,
                "avg": (
                    sum(connection_times) / len(connection_times)
                    if connection_times
                    else None
                ),
            },
            "navigation_times": {
                "min": min(navigation_times) if navigation_times else None,
                "max": max(navigation_times) if navigation_times else None,
                "avg": (
                    sum(navigation_times) / len(navigation_times)
                    if navigation_times
                    else None
                ),
            },
            "total_times": {
                "min": min(total_times) if total_times else None,
                "max": max(total_times) if total_times else None,
                "avg": sum(total_times) / len(total_times) if total_times else None,
            },
            "errors": dict(errors),
            "test_duration": (
                self.end_time - self.start_time
                if self.start_time and self.end_time
                else None
            ),
        }

        return stats


async def run_multiple_tests(
    test_levels: List[int],
    test_duration: float = 60.0,
    hold_time: float = 10.0,
    test_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run stress tests at multiple concurrent connection levels.

    Args:
        test_levels: List of concurrent connection counts to test
        test_duration: How long to keep connections open
        hold_time: How long each connection should stay active
        test_url: Optional URL to navigate to

    Returns:
        Dictionary with results from all test levels
    """
    all_results = {}
    env_info = get_decodo_env_info()

    logger.info(f"Running stress tests at levels: {test_levels}")
    logger.info(f"Proxy configuration: {env_info}")

    # Ensure browser manager is started
    if not browser_manager.is_ready:
        logger.info("Starting browser manager...")
        started = await browser_manager.start()
        if not started:
            raise RuntimeError("Failed to start browser manager")

    for level in test_levels:
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing with {level} concurrent connections")
        logger.info(f"{'='*60}")

        test = ProxyStressTest(
            concurrent_connections=level,
            test_duration=test_duration,
            hold_time=hold_time,
            test_url=test_url,
        )

        try:
            result = await test.run_test()
            all_results[f"{level}_connections"] = result

            # Print summary
            summary = result["summary"]
            logger.info(f"\nResults for {level} connections:")
            logger.info(f"  Success rate: {summary['success_rate']:.2f}%")
            logger.info(
                f"  Successful: {summary['successful']}/{summary['total_connections']}"
            )
            logger.info(f"  Failed: {summary['failed']}")
            if summary.get("errors"):
                logger.info(f"  Errors: {summary['errors']}")
            if summary.get("connection_times", {}).get("avg"):
                logger.info(
                    f"  Avg connection time: {summary['connection_times']['avg']:.2f}s"
                )
            if summary.get("navigation_times", {}).get("avg"):
                logger.info(
                    f"  Avg navigation time: {summary['navigation_times']['avg']:.2f}s"
                )

            # Wait between tests to let proxy recover
            if level != test_levels[-1]:  # Don't wait after last test
                wait_time = 10
                logger.info(f"\nWaiting {wait_time}s before next test...")
                await asyncio.sleep(wait_time)

        except Exception as e:
            logger.error(f"Test failed for {level} connections: {str(e)}")
            all_results[f"{level}_connections"] = {"error": str(e)}

    return {
        "proxy_config": env_info,
        "test_levels": test_levels,
        "results": all_results,
    }


async def main():
    """Main entry point for stress test script."""
    parser = argparse.ArgumentParser(
        description="Stress test Decodo proxy server with concurrent connections",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test with 100 concurrent connections
  python scripts/stress_test_proxy.py --concurrent 100

  # Test multiple levels (10, 25, 50, 75, 100)
  python scripts/stress_test_proxy.py --test-levels 10,25,50,75,100

  # Test with custom duration and hold time
  python scripts/stress_test_proxy.py --concurrent 50 --duration 120 --hold-time 30

  # Test with custom URL
  python scripts/stress_test_proxy.py --concurrent 25 --url https://example.com
        """,
    )

    parser.add_argument(
        "--concurrent",
        type=int,
        default=None,
        help="Number of concurrent connections to test (default: 100)",
    )
    parser.add_argument(
        "--test-levels",
        type=str,
        default=None,
        help="Comma-separated list of concurrent connection counts to test (e.g., '10,25,50,100')",
    )
    parser.add_argument(
        "--duration",
        type=float,
        default=60.0,
        help="Maximum test duration in seconds (default: 60)",
    )
    parser.add_argument(
        "--hold-time",
        type=float,
        default=10.0,
        help="How long each connection should stay active in seconds (default: 10)",
    )
    parser.add_argument(
        "--url",
        type=str,
        default=None,
        help="URL to navigate to (default: Decodo IP check endpoint)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file for JSON results (default: print to stdout)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Determine test levels
    if args.test_levels:
        try:
            test_levels = [int(x.strip()) for x in args.test_levels.split(",")]
        except ValueError:
            logger.error("Invalid test-levels format. Use comma-separated integers.")
            sys.exit(1)
    elif args.concurrent:
        test_levels = [args.concurrent]
    else:
        # Default: test multiple levels
        test_levels = [10, 25, 50, 75, 100]

    # Validate test levels
    if not test_levels or any(x <= 0 for x in test_levels):
        logger.error("Test levels must be positive integers")
        sys.exit(1)

    try:
        if len(test_levels) == 1:
            # Single test
            test = ProxyStressTest(
                concurrent_connections=test_levels[0],
                test_duration=args.duration,
                hold_time=args.hold_time,
                test_url=args.url,
            )
            result = await test.run_test()
            output = {
                "proxy_config": get_decodo_env_info(),
                "test": result,
            }
        else:
            # Multiple tests
            output = await run_multiple_tests(
                test_levels=test_levels,
                test_duration=args.duration,
                hold_time=args.hold_time,
                test_url=args.url,
            )

        # Output results
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w") as f:
                json.dump(output, f, indent=2)
            logger.info(f"\nResults saved to: {output_path}")
        else:
            print(json.dumps(output, indent=2))

    except KeyboardInterrupt:
        logger.info("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test failed: {str(e)}", exc_info=True)
        sys.exit(1)
    finally:
        # Cleanup
        if browser_manager.is_ready:
            logger.info("Stopping browser manager...")
            await browser_manager.stop()


if __name__ == "__main__":
    asyncio.run(main())

