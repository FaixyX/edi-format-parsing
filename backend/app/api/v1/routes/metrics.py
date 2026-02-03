"""
Prometheus metrics endpoint for autoscaling.

This endpoint exposes metrics that fly-autoscaler can scrape to determine
how many worker machines should be running.
"""

import logging
from fastapi import APIRouter
from prometheus_client import Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from app.services.metrics_service import (
    get_dramatiq_queue_depth,
    get_inflight_jobs,
    get_worker_threads_per_machine,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Prometheus metrics (Gauges)
PENDING_JOBS = Gauge(
    "dramatiq_pending_jobs",
    "Number of jobs waiting in Dramatiq queue",
)

INFLIGHT_JOBS = Gauge(
    "dramatiq_inflight_jobs",
    "Number of jobs currently executing",
)

THREADS_PER_MACHINE = Gauge(
    "worker_threads_per_machine",
    "Configured worker threads per machine",
)


def update_metrics():
    """Update all Prometheus metrics with current values."""
    try:
        pending = get_dramatiq_queue_depth()
        inflight = get_inflight_jobs()
        threads = get_worker_threads_per_machine()

        PENDING_JOBS.set(pending)
        INFLIGHT_JOBS.set(inflight)
        THREADS_PER_MACHINE.set(threads)

        logger.debug(
            f"Metrics updated: pending={pending}, inflight={inflight}, threads={threads}"
        )
    except Exception as e:
        logger.error(f"Failed to update metrics: {e}")


@router.get("/metrics")
async def metrics():
    """
    Prometheus metrics endpoint.

    This endpoint is scraped by fly-autoscaler to determine scaling decisions.
    Updates metrics on each request to ensure fresh data.
    """
    # Update metrics before generating response
    update_metrics()

    # Generate Prometheus format response
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
