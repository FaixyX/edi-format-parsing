import argparse
import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.services.browser_manager import browser_manager
from app.services.decodo_proxy import get_decodo_env_info


async def _run_probe(
    run_id: int,
    target_url: Optional[str],
    nav_timeout_s: float,
    ip_timeout_s: float,
    sticky_minutes: Optional[int],
    no_session: bool = False,
    no_proxy: bool = False,
) -> Dict[str, Any]:
    """
    Perform a single probe: new proxy session -> IP check -> optional target navigation.
    """
    session_id = None if (no_session or no_proxy) else uuid4().hex
    result: Dict[str, Any] = {
        "run": run_id,
        "proxy_session_id": session_id,
        "sticky_minutes": sticky_minutes,
        "no_session": no_session,
        "no_proxy": no_proxy,
    }

    t_run_start = time.time()
    ip_info = None
    ip_error = None
    target_status = None
    target_error = None
    target_elapsed = None

    try:
        async with browser_manager.get_context(
            use_proxy=not no_proxy,
            bandwidth_saver=False,  # Disable to avoid route interference
        ) as context:
            page = await browser_manager.get_page(context)
            try:
                # IP check - try HTTPS first, fallback to HTTP
                for ip_url in [
                    "https://ip.decodo.com/json",
                    "http://ip.decodo.com/json",
                ]:
                    try:
                        await page.goto(
                            ip_url, timeout=int(ip_timeout_s * 1000), wait_until="load"
                        )
                        ip_info = await page.text_content("body")
                        break  # Success
                    except Exception as inner_exc:  # noqa: BLE001
                        ip_error = f"{ip_url}: {inner_exc}"
                        continue
            except Exception as exc:  # noqa: BLE001 - want full capture for diagnostics
                ip_error = str(exc)

            # Target navigation
            if target_url:
                t_nav_start = time.time()
                try:
                    await page.goto(
                        target_url,
                        timeout=int(nav_timeout_s * 1000),
                        wait_until="domcontentloaded",
                    )
                    target_status = "ok"
                except Exception as exc:  # noqa: BLE001
                    target_status = "error"
                    target_error = str(exc)
                target_elapsed = time.time() - t_nav_start

            await page.close()
    except Exception as exc:  # noqa: BLE001
        result["context_error"] = str(exc)

    result.update(
        {
            "ip_info": ip_info,
            "ip_error": ip_error,
            "target_status": target_status,
            "target_error": target_error,
            "target_elapsed_s": target_elapsed,
            "elapsed_s": time.time() - t_run_start,
        }
    )
    return result


async def main():
    parser = argparse.ArgumentParser(
        description="Probe Decodo proxy sessions and optional target navigation."
    )
    parser.add_argument(
        "--runs", type=int, default=3, help="Number of probe runs (default: 3)"
    )
    parser.add_argument(
        "--target",
        type=str,
        default=None,
        help="Optional target URL to navigate after IP check.",
    )
    parser.add_argument(
        "--nav-timeout",
        type=float,
        default=30,
        help="Navigation timeout in seconds for target URL (default: 30).",
    )
    parser.add_argument(
        "--ip-timeout",
        type=float,
        default=20,
        help="Timeout in seconds for IP check (default: 20).",
    )
    parser.add_argument(
        "--sticky-minutes",
        type=int,
        default=None,
        help="Sticky session TTL in minutes (overrides DECODO_STICKY_MINUTES).",
    )
    parser.add_argument(
        "--no-session",
        action="store_true",
        help="Disable session suffix (test plain credentials).",
    )
    parser.add_argument(
        "--no-proxy",
        action="store_true",
        help="Disable proxy entirely (test direct connection).",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )

    sticky_env = os.getenv("DECODO_STICKY_MINUTES")
    sticky_minutes = args.sticky_minutes
    if sticky_minutes is None and sticky_env:
        try:
            sticky_minutes = int(sticky_env)
        except ValueError:
            sticky_minutes = None

    env_info = get_decodo_env_info()
    logging.info("Proxy env: %s", env_info)
    logging.info(
        "Starting probe: runs=%s target=%s nav_timeout=%ss ip_timeout=%ss sticky_minutes=%s",
        args.runs,
        args.target,
        args.nav_timeout,
        args.ip_timeout,
        sticky_minutes,
    )

    started = await browser_manager.start()
    if not started:
        logging.error("Failed to start browser manager")
        return

    results: List[Dict[str, Any]] = []
    for i in range(1, args.runs + 1):
        logging.info("Probe run %s/%s", i, args.runs)
        results.append(
            await _run_probe(
                run_id=i,
                target_url=args.target,
                nav_timeout_s=args.nav_timeout,
                ip_timeout_s=args.ip_timeout,
                sticky_minutes=sticky_minutes,
                no_session=args.no_session,
                no_proxy=args.no_proxy,
            )
        )

    await browser_manager.stop()

    print(json.dumps({"env": env_info, "results": results}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
