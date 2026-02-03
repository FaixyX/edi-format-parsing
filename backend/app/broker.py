import os
from dotenv import load_dotenv
import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import AsyncIO, Retries, CurrentMessage, Callbacks
import logging
import redis
from redis import ConnectionPool
from app.utils.redis_connection import (
    get_redis_config,
    verify_redis_connection_with_retry,
)

# Disable Prometheus middleware to avoid AttributeError in Dramatiq 1.18.0
# This is a known issue where inprogress_messages attribute is not properly initialized
os.environ.setdefault("DRAMATIQ_PROMETHEUS", "false")

# Ensure environment variables from .env are loaded for worker processes too
load_dotenv()

logger = logging.getLogger(__name__)

# Configure Redis with environment variables for production readiness
redis_config = get_redis_config()
redis_url = redis_config.get("url")
redis_host = redis_config["host"]
redis_port = redis_config["port"]
redis_db = redis_config["db"]
redis_password = redis_config.get("password")
redis_ssl = redis_config.get("ssl", False)

connection_target = f"{redis_host}:{redis_port}/db{redis_db}" + (
    " (via REDIS_URL)" if redis_config.get("source") == "REDIS_URL" else ""
)

logger.info(f"Configuring Redis broker: {connection_target}")

# Verify Redis connection before creating broker
logger.info("🔍 Verifying Redis connection for worker...")
redis_connected = verify_redis_connection_with_retry(max_retries=3, retry_delay=2.0)
if not redis_connected:
    logger.error(
        "❌ Redis connection verification failed - worker cannot start without Redis"
    )
    logger.error("Please ensure Redis server is running and accessible")
    raise RuntimeError(
        "Redis connection verification failed - worker cannot start without Redis"
    )
logger.info("✅ Redis connection verified successfully for worker")

# Create Redis broker with proper error handling and timeouts
# Dramatiq's RedisBroker already uses connection pooling via redis-py.
try:
    # Create broker with connection parameters
    broker_kwargs = {
        "ssl": redis_ssl,
        # Cut background maintenance chatter
        "maintenance_chance": 0,
        # Less frequent heartbeat churn (ms)
        "heartbeat_timeout": 60000,
    }
    if redis_url:
        broker_kwargs["url"] = redis_url
    else:
        broker_kwargs.update(
            {
                "host": redis_host,
                "port": redis_port,
                "db": redis_db,
                "password": redis_password,
            }
        )

    broker = RedisBroker(**broker_kwargs)

    logger.info(
        "✅ Redis broker configured successfully (maintenance_chance=0, heartbeat_timeout=60000ms)"
    )

    # Add AsyncIO middleware to manage event loop for async actors
    broker.add_middleware(AsyncIO())

    # Note: Retries and Callbacks middleware are added automatically by Dramatiq
    # when max_retries > 0 and callbacks are used, so we don't add them manually

    # Optional: lets you inspect the current message/options from within the actor
    broker.add_middleware(CurrentMessage())

    # Add inflight tracking middleware for autoscaling
    from app.middleware.inflight_tracking import InflightTrackingMiddleware

    broker.add_middleware(InflightTrackingMiddleware())
    logger.info("✅ Inflight tracking middleware added for autoscaling")

    # Explicitly disable Prometheus middleware to avoid AttributeError in Dramatiq 1.18.0
    # The Prometheus middleware has a bug where inprogress_messages attribute is not initialized
    try:
        from dramatiq.middleware.prometheus import Prometheus

        # Remove Prometheus middleware if it was automatically added
        broker.middleware = [
            m for m in broker.middleware if not isinstance(m, Prometheus)
        ]
        logger.info("✅ Prometheus middleware disabled to avoid AttributeError")
    except ImportError:
        # Prometheus middleware not available, which is fine
        pass

    # Test the broker connection and declare required queues
    broker.declare_queue("test_connection")
    broker.declare_queue("default")  # CRITICAL: Declare the default queue for tasks
    logger.info(f"✅ Redis broker configured successfully: {connection_target}")
    logger.info("✅ Default queue declared for task processing")

    # Log what middleware is active at startup
    logger.info(
        "Dramatiq middleware enabled: %s", [type(m).__name__ for m in broker.middleware]
    )

except Exception as e:
    logger.error(f"❌ Failed to configure Redis broker: {str(e)}")
    logger.error("Redis connection failed. Please check your Redis configuration.")
    logger.error("Make sure Redis is running and accessible.")
    raise

# Set the global broker before importing actors so decorators bind correctly
dramatiq.set_broker(broker)

# Enable DEBUG logging for retries during rollout
logging.getLogger("dramatiq.middleware.retries").setLevel(logging.DEBUG)
logging.getLogger("dramatiq.middleware.callbacks").setLevel(logging.DEBUG)
