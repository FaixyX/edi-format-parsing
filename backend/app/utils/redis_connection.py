"""
Redis connection utility functions for verifying connectivity and health checks.
"""

import os
import redis
import logging
import time
from typing import Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Cache for Redis health info to reduce command usage
_redis_health_cache: Optional[Dict[str, Any]] = None
_redis_health_cache_time: float = 0
_REDIS_HEALTH_CACHE_TTL: float = 10.0  # Cache for 10 seconds


def _parse_redis_url(redis_url: str) -> Dict[str, Any]:
    """Parse REDIS_URL style connection strings."""
    parsed = urlparse(redis_url)
    if parsed.scheme not in ("redis", "rediss"):
        raise ValueError(f"Unsupported REDIS_URL scheme: {parsed.scheme}")

    # Default DB is 0; strip leading slash from path to get DB number if present
    db = 0
    if parsed.path and parsed.path != "/":
        try:
            db = int(parsed.path.lstrip("/"))
        except ValueError:
            db = 0

    return {
        "url": redis_url,
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 6379,
        "db": db,
        "password": parsed.password,
        "ssl": parsed.scheme == "rediss",
        "source": "REDIS_URL",
    }


def _mask_password(config: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of config with password masked for safe logging."""
    safe_config = dict(config)
    if safe_config.get("password"):
        safe_config["password"] = "***"
    return safe_config


def get_redis_config() -> Dict[str, Any]:
    """Get Redis configuration from environment variables with REDIS_URL support."""
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            return _parse_redis_url(redis_url)
        except Exception as e:
            logger.warning(
                f"Invalid REDIS_URL provided, falling back to host/port: {e}"
            )

    return {
        "host": os.getenv("REDIS_HOST", "localhost"),
        "port": int(os.getenv("REDIS_PORT", "6379")),
        "db": int(os.getenv("REDIS_DB", "0")),
        "password": os.getenv("REDIS_PASSWORD", None),
        "ssl": os.getenv("REDIS_SSL", "false").lower() == "true",
        "source": "individual env vars",
    }


def create_redis_client() -> redis.Redis:
    """Create a Redis client with proper configuration."""
    config = get_redis_config()

    client_kwargs = {
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
        "retry_on_timeout": True,
        "health_check_interval": 30,
    }

    redis_url = config.get("url")
    if redis_url:
        client = redis.from_url(redis_url, **client_kwargs)
    else:
        client = redis.Redis(
            host=config["host"],
            port=config["port"],
            db=config["db"],
            password=config["password"],
            ssl=config.get("ssl", False),
            **client_kwargs,
        )

    return client


def verify_redis_connection() -> bool:
    """
    Verify Redis connection is working.

    Returns:
        bool: True if Redis is accessible, False otherwise
    """
    try:
        config = get_redis_config()
        connection_target = f"{config['host']}:{config['port']}/db{config['db']}" + (
            " (via REDIS_URL)" if config.get("source") == "REDIS_URL" else ""
        )
        logger.info(f"Verifying Redis connection to {connection_target}")

        client = create_redis_client()

        # Test connection with ping
        response = client.ping()
        if response:
            logger.info("✅ Redis connection verified successfully")
            return True
        else:
            logger.error("❌ Redis ping failed - no response")
            return False

    except redis.ConnectionError as e:
        logger.error(f"❌ Redis connection failed: {str(e)}")
        logger.error("Please ensure Redis server is running and accessible")
        return False
    except redis.TimeoutError as e:
        logger.error(f"❌ Redis connection timeout: {str(e)}")
        logger.error("Redis server may be overloaded or network issues present")
        return False
    except Exception as e:
        logger.error(f"❌ Unexpected Redis error: {str(e)}")
        return False
    finally:
        try:
            client.close()
        except:
            pass


def verify_redis_connection_with_retry(
    max_retries: int = 3, retry_delay: float = 1.0
) -> bool:
    """
    Verify Redis connection with retry logic.

    Args:
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds

    Returns:
        bool: True if Redis is accessible, False otherwise
    """
    import time

    for attempt in range(max_retries):
        if verify_redis_connection():
            return True

        if attempt < max_retries - 1:
            logger.warning(
                f"Redis connection attempt {attempt + 1} failed, retrying in {retry_delay}s..."
            )
            time.sleep(retry_delay)

    logger.error(f"❌ Redis connection failed after {max_retries} attempts")
    return False


def get_redis_health_info() -> Dict[str, Any]:
    """
    Get comprehensive Redis health information.

    This function is cached for 10 seconds to reduce Redis command usage.
    The cache significantly reduces the number of commands sent to Redis,
    especially when health checks are called frequently.

    Returns:
        Dict containing Redis health status and metrics
    """
    global _redis_health_cache, _redis_health_cache_time

    # Return cached result if still valid
    current_time = time.time()
    if (
        _redis_health_cache is not None
        and (current_time - _redis_health_cache_time) < _REDIS_HEALTH_CACHE_TTL
    ):
        return _redis_health_cache

    try:
        config = get_redis_config()
        client = create_redis_client()

        # Test basic connectivity
        ping_response = client.ping()

        # CRITICAL FIX: Use specific info section instead of all sections
        # client.info() without arguments returns ALL info sections which can
        # trigger hundreds of internal commands. Using "server" section only
        # returns essential server info with minimal command overhead.
        info = client.info("server")

        # Get queue lengths
        queue_length = client.llen("default")
        failed_queue_length = client.llen("failed")

        result = {
            "status": "healthy" if ping_response else "unhealthy",
            "config": _mask_password(config),
            "source": config.get("source", "unknown"),
            "ping": ping_response,
            "redis_version": info.get("redis_version", "Unknown"),
            "uptime_seconds": info.get("uptime_in_seconds", 0),
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_human": info.get("used_memory_human", "Unknown"),
            "queue_length": queue_length,
            "failed_queue_length": failed_queue_length,
        }

        # Cache the result
        _redis_health_cache = result
        _redis_health_cache_time = current_time

        return result

    except Exception as e:
        result = {
            "status": "unhealthy",
            "error": str(e),
            "config": _mask_password(get_redis_config()),
        }
        # Cache error result too (but with shorter TTL behavior)
        _redis_health_cache = result
        _redis_health_cache_time = current_time
        return result
    finally:
        try:
            client.close()
        except:
            pass
