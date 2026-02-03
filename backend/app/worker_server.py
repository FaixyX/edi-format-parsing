"""
Worker server that combines HTTP endpoints with Dramatiq worker functionality.
This allows the worker to be woken up from scale-to-zero deployments.
"""

import asyncio
import logging
import os
import signal
import sys
import threading
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional

import dramatiq
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Import the broker and tasks to ensure they're properly configured
from app.broker import broker
from app.tasks.edi_billing_tasks import (
    process_edi_billing_file_task,
)
from app.core.logging_config import setup_logging

# Setup logging configuration for the worker server
setup_logging()

# Configure Dramatiq-specific logging to ensure worker logs are visible
logging.getLogger("dramatiq").setLevel(logging.INFO)
logging.getLogger("dramatiq.worker").setLevel(logging.INFO)
logging.getLogger("dramatiq.middleware").setLevel(logging.INFO)

logger = logging.getLogger(__name__)


# Pydantic models for API requests
class TriggerRequest(BaseModel):
    action: str


class HealthResponse(BaseModel):
    status: str
    message: str
    worker_active: bool
    timestamp: str


# Global state to track worker status
worker_status = {"active": False, "started_at": None, "last_trigger": None}

# Global worker instance for graceful shutdown
_worker_instance: Optional[dramatiq.Worker] = None
_shutdown_event = threading.Event()


def start_dramatiq_worker():
    """Start the Dramatiq worker in a separate thread."""
    global worker_status, _worker_instance

    try:
        proxy_port_str = os.getenv("proxy_PORT")
        proxy_port = int(proxy_port_str) if proxy_port_str else None

        if proxy_port:
            logger.info(f"🚀 Starting Dramatiq worker... on proxy port {proxy_port}")
        else:
            logger.info("🚀 Starting Dramatiq worker... (proxy port not configured)")
        logger.info(
            f"📊 Broker middleware: {[type(m).__name__ for m in broker.middleware]}"
        )
        logger.info(f"📋 Available queues: {list(broker.get_declared_queues())}")
        # Extra visibility: log broker prefetch setting to confirm deployment
        logger.info(f"⚙️ Broker prefetch: {getattr(broker, 'prefetch', 'unknown')}")

        worker_status["active"] = True
        worker_status["started_at"] = time.time()

        # Start the Dramatiq worker using the Worker class directly
        # Note: dramatiq.Worker always runs as a single process by default
        # The worker_threads parameter controls the number of threads within that single process
        # This is equivalent to running: dramatiq your_module --processes 1 --threads 100
        #
        # CRITICAL: With connection pooling configured in broker.py, all 100 threads
        # share a single connection pool (max 50 connections), so Redis command usage
        # is dramatically reduced. Each thread doesn't create its own connection - they
        # all share the pool efficiently.
        worker_threads = int(os.getenv("WORKER_THREADS", 10))

        # High timeout to reduce polling frequency (ms); user accepts latency.
        worker_timeout = int(os.getenv("DRAMATIQ_WORKER_TIMEOUT", 30000))
        worker = dramatiq.Worker(
            broker,
            worker_timeout=worker_timeout,
            worker_threads=worker_threads,
        )
        _worker_instance = worker  # Store for graceful shutdown
        
        logger.info("✅ Dramatiq worker created successfully")
        logger.info(
            f"🔄 Starting worker with {worker.worker_threads} threads, "
            f"timeout={worker_timeout}ms"
        )
        worker.start()

    except Exception as e:
        logger.error(f"❌ Failed to start Dramatiq worker: {str(e)}")
        worker_status["active"] = False
        raise


def graceful_shutdown_worker(timeout_seconds: int = 60):
    """
    Gracefully shutdown the Dramatiq worker.
    
    This function:
    1. Stops the worker from consuming new jobs
    2. Waits for in-flight jobs to complete (with timeout)
    3. Ensures inflight counter is properly decremented
    
    Args:
        timeout_seconds: Maximum time to wait for jobs to finish (default: 60)
    """
    global _worker_instance, worker_status
    
    if _worker_instance is None:
        logger.info("No worker instance to shutdown")
        return
    
    logger.info("🛑 Initiating graceful worker shutdown...")
    worker_status["active"] = False
    
    try:
        # Stop the worker (stops consuming new jobs)
        logger.info("Stopping worker from consuming new jobs...")
        _worker_instance.stop()
        
        # Wait for worker to finish processing current jobs
        logger.info(f"Waiting up to {timeout_seconds}s for in-flight jobs to complete...")
        _worker_instance.join(timeout=timeout_seconds)
        
        if _worker_instance.is_alive():
            logger.warning(
                f"Worker did not finish within {timeout_seconds}s timeout. "
                "Some jobs may have been interrupted."
            )
        else:
            logger.info("✅ Worker shutdown complete - all jobs finished")
            
    except Exception as e:
        logger.error(f"Error during graceful shutdown: {e}")
    finally:
        _worker_instance = None


def signal_handler(signum, frame):
    """Handle SIGTERM/SIGINT signals for graceful shutdown."""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    _shutdown_event.set()
    
    # Get shutdown timeout from env (default 60 seconds)
    shutdown_timeout = int(os.getenv("WORKER_SHUTDOWN_TIMEOUT", "60"))
    graceful_shutdown_worker(timeout_seconds=shutdown_timeout)
    
    # Exit the process
    sys.exit(0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifespan of the FastAPI application."""
    logger.info("🔧 Starting worker server...")
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    logger.info("✅ Signal handlers registered for graceful shutdown")

    # Start Dramatiq worker in a separate thread
    worker_thread = threading.Thread(target=start_dramatiq_worker, daemon=False)
    worker_thread.start()

    # Wait a moment for worker to initialize
    await asyncio.sleep(2)

    logger.info("✅ Worker server started successfully")

    yield

    logger.info("🛑 Shutting down worker server...")
    
    # Get shutdown timeout from env (default 60 seconds)
    shutdown_timeout = int(os.getenv("WORKER_SHUTDOWN_TIMEOUT", "60"))
    graceful_shutdown_worker(timeout_seconds=shutdown_timeout)


# Create FastAPI app with lifespan management
app = FastAPI(
    title="Agency Form Worker Service",
    description="Worker service with HTTP endpoints for scale-to-zero deployment",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for the worker service."""
    return HealthResponse(
        status="healthy" if worker_status["active"] else "starting",
        message=(
            "Worker service is running"
            if worker_status["active"]
            else "Worker is starting up"
        ),
        worker_active=worker_status["active"],
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.post("/trigger")
async def trigger_worker(request: TriggerRequest):
    """
    Trigger endpoint to wake up the worker from scale-to-zero.
    This endpoint is called by the API server when tasks are enqueued.
    """
    global worker_status

    logger.info(f"🔔 Worker trigger received: {request.action}")
    worker_status["last_trigger"] = time.time()

    if request.action == "wake_up":
        # The worker is already running due to the HTTP request
        # This endpoint just confirms the worker is awake and ready
        logger.info("✅ Worker is awake and ready to process tasks")
        return {
            "status": "success",
            "message": "Worker is awake and ready to process tasks",
            "worker_active": worker_status["active"],
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        }
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {request.action}")


@app.get("/status")
async def get_worker_status():
    """Get detailed worker status information."""
    uptime = None
    if worker_status["started_at"]:
        uptime = time.time() - worker_status["started_at"]

    return {
        "worker_active": worker_status["active"],
        "started_at": worker_status["started_at"],
        "last_trigger": worker_status["last_trigger"],
        "uptime_seconds": uptime,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }


@app.get("/")
async def root():
    """Root endpoint with basic information."""
    return {
        "service": "Agency Form Worker",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {"health": "/health", "trigger": "/trigger", "status": "/status"},
    }


if __name__ == "__main__":
    import uvicorn

    # Get port from environment variable, default to 8081
    port = int(os.getenv("WORKER_PORT", "8081"))

    uvicorn.run(
        "app.worker_server:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload in production
        log_level="info",
    )
