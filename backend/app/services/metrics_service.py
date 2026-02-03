"""
Service for exposing Prometheus metrics for autoscaling.

This service provides metrics that fly-autoscaler can use to determine
how many worker machines should be running:
- dramatiq_pending_jobs: Number of jobs waiting in the queue
- dramatiq_inflight_jobs: Number of jobs currently executing
- worker_threads_per_machine: Configured worker threads per machine
"""

import os
import logging
import redis
from typing import Optional
from app.utils.redis_connection import create_redis_client, get_redis_config
from app.broker import broker

logger = logging.getLogger(__name__)

# Redis key for tracking inflight jobs (must match middleware)
INFLIGHT_KEY = "workers:inflight"


def get_dramatiq_queue_depth(redis_client: Optional[redis.Redis] = None) -> int:
    """
    Get the number of pending jobs in the Dramatiq queue.
    
    Dramatiq RedisBroker stores messages in Redis lists with the queue name as the key.
    The default queue is "default", but we should check all declared queues.
    
    Args:
        redis_client: Optional Redis client. If None, creates a new one.
        
    Returns:
        Total number of pending jobs across all queues.
    """
    if redis_client is None:
        redis_client = create_redis_client()
    
    try:
        # Get all declared queues from the broker
        declared_queues = broker.get_declared_queues()
        
        total_pending = 0
        seen_queues = set()
        
        for queue_name in declared_queues:
            # Dramatiq RedisBroker uses the format: dramatiq:queue:{queue_name}
            # But we should check multiple possible formats for compatibility
            queue_keys = [
                f"dramatiq:queue:{queue_name}",  # Standard Dramatiq format
                queue_name,  # Direct queue name
                f"queue:{queue_name}",  # Alternative format
            ]
            
            for queue_key in queue_keys:
                queue_length = redis_client.llen(queue_key)
                if queue_length > 0:
                    if queue_key not in seen_queues:
                        total_pending += queue_length
                        seen_queues.add(queue_key)
                        logger.debug(f"Queue '{queue_name}' (key: {queue_key}) has {queue_length} pending jobs")
                    break  # Found the correct key format, move to next queue
        
        # Also check the default queue directly (most common case)
        # Dramatiq typically uses "dramatiq:queue:default"
        default_keys = ["dramatiq:queue:default", "default", "dramatiq:queue:default"]
        for default_key in default_keys:
            if default_key not in seen_queues:
                default_length = redis_client.llen(default_key)
                if default_length > 0:
                    total_pending += default_length
                    seen_queues.add(default_key)
                    logger.debug(f"Default queue (key: {default_key}) has {default_length} pending jobs")
                    break
        
        return total_pending
        
    except Exception as e:
        logger.error(f"Failed to get queue depth: {e}")
        return 0
    finally:
        # Don't close the client if it was passed in (might be reused)
        if redis_client and redis_client.connection_pool.connection_kwargs.get('url') is None:
            try:
                redis_client.close()
            except:
                pass


def get_inflight_jobs(redis_client: Optional[redis.Redis] = None) -> int:
    """
    Get the number of jobs currently executing (inflight).
    
    Args:
        redis_client: Optional Redis client. If None, creates a new one.
        
    Returns:
        Number of inflight jobs.
    """
    if redis_client is None:
        redis_client = create_redis_client()
    
    try:
        inflight = redis_client.get(INFLIGHT_KEY)
        if inflight is None:
            return 0
        return int(inflight)
    except Exception as e:
        logger.error(f"Failed to get inflight jobs: {e}")
        return 0
    finally:
        # Don't close the client if it was passed in
        if redis_client and redis_client.connection_pool.connection_kwargs.get('url') is None:
            try:
                redis_client.close()
            except:
                pass


def get_worker_threads_per_machine() -> int:
    """
    Get the configured worker threads per machine from environment variable.
    
    This must match the WORKER_THREADS env var used by the worker.
    
    Returns:
        Number of threads per machine (default: 10).
    """
    return int(os.getenv("WORKER_THREADS", "10"))


def collect_all_metrics() -> dict:
    """
    Collect all metrics needed for autoscaling.
    
    Returns:
        Dictionary with pending_jobs, inflight_jobs, and threads_per_machine.
    """
    redis_client = create_redis_client()
    try:
        return {
            "pending_jobs": get_dramatiq_queue_depth(redis_client),
            "inflight_jobs": get_inflight_jobs(redis_client),
            "threads_per_machine": get_worker_threads_per_machine(),
        }
    finally:
        try:
            redis_client.close()
        except:
            pass

