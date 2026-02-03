"""
Integrated autoscaler service for Fly.io worker machines.

This service runs as a background task in the API server and automatically
scales worker machines up/down based on queue depth and inflight jobs.
"""

import os
import logging
import time
import threading
import httpx
from typing import Optional
from math import ceil
from app.services.metrics_service import (
    get_dramatiq_queue_depth,
    get_inflight_jobs,
    get_worker_threads_per_machine,
)

logger = logging.getLogger(__name__)

# Fly API configuration
FLY_API_BASE = "https://api.machines.dev/v1"
FLY_APP_NAME_ENV = "FLY_WORKER_APP_NAME"
FLY_API_TOKEN_ENV = "FLY_API_TOKEN"
AUTOSCALER_ENABLED_ENV = "AUTOSCALER_ENABLED"
AUTOSCALER_INTERVAL_ENV = "AUTOSCALER_INTERVAL_SECONDS"
AUTOSCALER_MAX_MACHINES_ENV = "AUTOSCALER_MAX_MACHINES"
AUTOSCALER_MIN_MACHINES_ENV = "AUTOSCALER_MIN_MACHINES"

# Default values
DEFAULT_INTERVAL = 30  # Check every 30 seconds
DEFAULT_MAX_MACHINES = 7
DEFAULT_MIN_MACHINES = 0


class AutoscalerService:
    """
    Service that automatically scales worker machines based on workload.

    Runs as a background thread that periodically:
    1. Reads metrics (pending + inflight jobs, threads per machine)
    2. Calculates desired machine count
    3. Calls Fly API to start/stop machines
    """

    def __init__(self):
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_scale_action = None
        self._last_scale_time = None

    def is_enabled(self) -> bool:
        """Check if autoscaler is enabled via environment variable."""
        return os.getenv(AUTOSCALER_ENABLED_ENV, "false").lower() == "true"

    def get_worker_app_name(self) -> Optional[str]:
        """Get the worker app name from environment."""
        return os.getenv(FLY_APP_NAME_ENV)

    def get_fly_api_token(self) -> Optional[str]:
        """Get Fly API token from environment."""
        return os.getenv(FLY_API_TOKEN_ENV)

    def get_interval(self) -> int:
        """Get autoscaler check interval in seconds."""
        return int(os.getenv(AUTOSCALER_INTERVAL_ENV, str(DEFAULT_INTERVAL)))

    def get_max_machines(self) -> int:
        """Get maximum number of machines."""
        return int(os.getenv(AUTOSCALER_MAX_MACHINES_ENV, str(DEFAULT_MAX_MACHINES)))

    def get_min_machines(self) -> int:
        """Get minimum number of machines."""
        return int(os.getenv(AUTOSCALER_MIN_MACHINES_ENV, str(DEFAULT_MIN_MACHINES)))

    def calculate_desired_machines(
        self, pending_jobs: int, inflight_jobs: int, threads_per_machine: int
    ) -> int:
        """
        Calculate desired number of machines based on workload.

        Formula: min(MAX_MACHINES, max(MIN_MACHINES, ceil((pending + inflight) / threads)))

        Args:
            pending_jobs: Number of jobs waiting in queue
            inflight_jobs: Number of jobs currently executing
            threads_per_machine: Worker threads per machine

        Returns:
            Desired number of machines
        """
        if threads_per_machine <= 0:
            logger.warning("Invalid threads_per_machine, using default of 10")
            threads_per_machine = 10

        work_items = pending_jobs + inflight_jobs
        desired = ceil(work_items / threads_per_machine)

        # Apply min/max constraints
        desired = max(self.get_min_machines(), desired)
        desired = min(self.get_max_machines(), desired)

        return desired

    def get_running_machines(self, app_name: str, api_token: str) -> Optional[int]:
        """
        Get the number of currently running (started) machines.

        Args:
            app_name: Fly app name
            api_token: Fly API token

        Returns:
            Number of running machines, or None if error
        """
        try:
            url = f"{FLY_API_BASE}/apps/{app_name}/machines"
            headers = {"Authorization": f"Bearer {api_token}"}

            with httpx.Client(timeout=10.0) as client:
                response = client.get(url, headers=headers)
                response.raise_for_status()

                machines = response.json()
                # Count machines that are in "started" state
                running = sum(
                    1 for machine in machines if machine.get("state") == "started"
                )

                return running

        except httpx.HTTPError as e:
            logger.error(f"Failed to get running machines: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting running machines: {e}")
            return None

    def start_machines(self, app_name: str, api_token: str, count: int) -> bool:
        """
        Start stopped machines to reach the desired count.

        Args:
            app_name: Fly app name
            api_token: Fly API token
            count: Number of machines to start

        Returns:
            True if successful, False otherwise
        """
        if count <= 0:
            return True

        try:
            url = f"{FLY_API_BASE}/apps/{app_name}/machines"
            headers = {"Authorization": f"Bearer {api_token}"}

            with httpx.Client(timeout=30.0) as client:
                # Get all machines
                response = client.get(url, headers=headers)
                response.raise_for_status()
                machines = response.json()

                # Find stopped machines
                stopped_machines = [m for m in machines if m.get("state") == "stopped"]

                if len(stopped_machines) < count:
                    logger.warning(
                        f"Only {len(stopped_machines)} stopped machines available, "
                        f"requested {count}"
                    )
                    count = len(stopped_machines)

                # Start machines
                started = 0
                for machine in stopped_machines[:count]:
                    machine_id = machine.get("id")
                    start_url = (
                        f"{FLY_API_BASE}/apps/{app_name}/machines/{machine_id}/start"
                    )

                    try:
                        start_response = client.post(start_url, headers=headers)
                        start_response.raise_for_status()
                        started += 1
                        logger.info(f"Started machine {machine_id}")
                    except httpx.HTTPError as e:
                        logger.warning(f"Failed to start machine {machine_id}: {e}")

                if started > 0:
                    logger.info(f"Started {started} machine(s)")
                    return True
                else:
                    logger.warning("No machines were started")
                    return False

        except httpx.HTTPError as e:
            logger.error(f"Failed to start machines: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error starting machines: {e}")
            return False

    def stop_machines(self, app_name: str, api_token: str, count: int) -> bool:
        """
        Stop running machines to reach the desired count.

        Args:
            app_name: Fly app name
            api_token: Fly API token
            count: Number of machines to stop

        Returns:
            True if successful, False otherwise
        """
        if count <= 0:
            return True

        try:
            url = f"{FLY_API_BASE}/apps/{app_name}/machines"
            headers = {"Authorization": f"Bearer {api_token}"}

            with httpx.Client(timeout=30.0) as client:
                # Get all machines
                response = client.get(url, headers=headers)
                response.raise_for_status()
                machines = response.json()

                # Find running machines
                running_machines = [m for m in machines if m.get("state") == "started"]

                if len(running_machines) < count:
                    logger.warning(
                        f"Only {len(running_machines)} running machines available, "
                        f"requested to stop {count}"
                    )
                    count = len(running_machines)

                # Stop machines (stop the ones with least recent activity if possible)
                stopped = 0
                for machine in running_machines[:count]:
                    machine_id = machine.get("id")
                    stop_url = (
                        f"{FLY_API_BASE}/apps/{app_name}/machines/{machine_id}/stop"
                    )

                    try:
                        stop_response = client.post(stop_url, headers=headers)
                        stop_response.raise_for_status()
                        stopped += 1
                        logger.info(f"Stopped machine {machine_id}")
                    except httpx.HTTPError as e:
                        logger.warning(f"Failed to stop machine {machine_id}: {e}")

                if stopped > 0:
                    logger.info(f"Stopped {stopped} machine(s)")
                    return True
                else:
                    logger.warning("No machines were stopped")
                    return False

        except httpx.HTTPError as e:
            logger.error(f"Failed to stop machines: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error stopping machines: {e}")
            return False

    def scale_workers(self) -> bool:
        """
        Perform one autoscaling check and action.

        Returns:
            True if scaling action was taken, False otherwise
        """
        app_name = self.get_worker_app_name()
        api_token = self.get_fly_api_token()

        if not app_name:
            logger.warning("FLY_WORKER_APP_NAME not set, skipping autoscaling")
            return False

        if not api_token:
            logger.warning("FLY_API_TOKEN not set, skipping autoscaling")
            return False

        try:
            # Get current metrics
            pending = get_dramatiq_queue_depth()
            inflight = get_inflight_jobs()
            threads = get_worker_threads_per_machine()

            # Calculate desired machine count
            desired = self.calculate_desired_machines(pending, inflight, threads)

            # Get current running machines
            current = self.get_running_machines(app_name, api_token)
            if current is None:
                logger.error("Failed to get current machine count, skipping scaling")
                return False

            logger.info(
                f"Autoscaling check: pending={pending}, inflight={inflight}, "
                f"threads={threads}, desired={desired}, current={current}"
            )

            # Scale if needed
            if desired > current:
                # Need to start machines
                to_start = desired - current
                logger.info(f"Scaling up: starting {to_start} machine(s)")
                success = self.start_machines(app_name, api_token, to_start)
                if success:
                    self._last_scale_action = f"started {to_start}"
                    self._last_scale_time = time.time()
                return success

            elif desired < current:
                # Need to stop machines
                to_stop = current - desired
                logger.info(f"Scaling down: stopping {to_stop} machine(s)")
                success = self.stop_machines(app_name, api_token, to_stop)
                if success:
                    self._last_scale_action = f"stopped {to_stop}"
                    self._last_scale_time = time.time()
                return success

            else:
                # Already at desired count
                logger.debug(f"No scaling needed: current={current}, desired={desired}")
                return False

        except Exception as e:
            logger.error(f"Error during autoscaling check: {e}")
            return False

    def _autoscaler_loop(self):
        """Background thread loop that periodically checks and scales."""
        logger.info("🚀 Autoscaler service started")
        interval = self.get_interval()

        while self._running:
            try:
                if self.is_enabled():
                    self.scale_workers()
                else:
                    logger.debug("Autoscaler is disabled")

                # Sleep until next check
                time.sleep(interval)

            except Exception as e:
                logger.error(f"Error in autoscaler loop: {e}")
                time.sleep(interval)  # Continue even on error

        logger.info("🛑 Autoscaler service stopped")

    def start(self):
        """Start the autoscaler background thread."""
        if not self.is_enabled():
            logger.info(
                "Autoscaler is disabled (set AUTOSCALER_ENABLED=true to enable)"
            )
            return

        if self._running:
            logger.warning("Autoscaler is already running")
            return

        app_name = self.get_worker_app_name()
        api_token = self.get_fly_api_token()

        if not app_name:
            logger.warning(f"Autoscaler cannot start: {FLY_APP_NAME_ENV} not set")
            return

        if not api_token:
            logger.warning(f"Autoscaler cannot start: {FLY_API_TOKEN_ENV} not set")
            return

        self._running = True
        self._thread = threading.Thread(target=self._autoscaler_loop, daemon=True)
        self._thread.start()
        logger.info(
            f"✅ Autoscaler started (interval={self.get_interval()}s, "
            f"min={self.get_min_machines()}, max={self.get_max_machines()})"
        )

    def stop(self):
        """Stop the autoscaler background thread."""
        if not self._running:
            return

        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Autoscaler stopped")

    def get_status(self) -> dict:
        """Get autoscaler status information."""
        return {
            "enabled": self.is_enabled(),
            "running": self._running,
            "interval_seconds": self.get_interval(),
            "min_machines": self.get_min_machines(),
            "max_machines": self.get_max_machines(),
            "last_scale_action": self._last_scale_action,
            "last_scale_time": self._last_scale_time,
        }


# Global autoscaler instance
autoscaler_service = AutoscalerService()
