"""
Dramatiq middleware to track inflight (currently running) jobs in Redis.

This middleware increments a Redis counter when a job starts and decrements it
when the job finishes (success or failure). This is critical for autoscaling
to know how many jobs are currently executing, not just queued.
"""

import logging
import redis
from dramatiq.middleware import Middleware
from app.utils.redis_connection import create_redis_client

logger = logging.getLogger(__name__)

# Redis key for tracking inflight jobs
INFLIGHT_KEY = "workers:inflight"


class InflightTrackingMiddleware(Middleware):
    """
    Middleware that tracks the number of jobs currently executing.
    
    Uses Redis counter at key 'workers:inflight':
    - INCR on job start
    - DECR on job completion (success or failure)
    """

    def __init__(self):
        super().__init__()
        self._redis_client = None

    def _get_redis_client(self):
        """Lazy initialization of Redis client."""
        if self._redis_client is None:
            self._redis_client = create_redis_client()
        return self._redis_client

    def before_process_message(self, broker, message):
        """Increment inflight counter when a job starts."""
        try:
            r = self._get_redis_client()
            r.incr(INFLIGHT_KEY)
            logger.debug(f"Incremented inflight counter for message {message.message_id}")
        except Exception as e:
            # Log but don't fail the job if counter update fails
            logger.warning(f"Failed to increment inflight counter: {e}")

    def after_process_message(self, broker, message, *, result=None, exception=None):
        """Decrement inflight counter when a job completes (success or failure)."""
        try:
            r = self._get_redis_client()
            r.decr(INFLIGHT_KEY)
            logger.debug(f"Decremented inflight counter for message {message.message_id}")
        except Exception as e:
            # Log but don't fail if counter update fails
            logger.warning(f"Failed to decrement inflight counter: {e}")

    def after_skip_message(self, broker, message):
        """Decrement inflight counter if message is skipped."""
        try:
            r = self._get_redis_client()
            r.decr(INFLIGHT_KEY)
            logger.debug(f"Decremented inflight counter for skipped message {message.message_id}")
        except Exception as e:
            logger.warning(f"Failed to decrement inflight counter for skipped message: {e}")

    def after_process_boot(self, broker):
        """Clean up Redis client on shutdown."""
        if self._redis_client:
            try:
                self._redis_client.close()
            except Exception as e:
                logger.warning(f"Error closing Redis client: {e}")
            self._redis_client = None

