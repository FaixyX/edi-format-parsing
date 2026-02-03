from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime
import os
from sqlalchemy.exc import OperationalError
from dotenv import load_dotenv
from app.core.auth_middleware import AuthenticationMiddleware

# Load environment variables from .env file
load_dotenv()
from app.api.v1.routes import (
    agency,
    auth,
    user,
    form_submission,
    background_task,
    monitoring,
    system_configuration,
    billing_file,
    billing_file_277,
    debug,
    google_settings,
    metrics,
    autoscaler,
)
from app.db.init_db import init_db
from app.core.logging_config import setup_logging
from app.utils.redis_connection import (
    verify_redis_connection_with_retry,
    get_redis_health_info,
)
import redis
import logging

# Setup logging configuration
setup_logging()

logger = logging.getLogger(__name__)

app = FastAPI()


# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add security headers
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
        )
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        return response


class LoginRequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Log all requests to help debug "Invalid HTTP request" warnings
        if request.url.path.startswith("/api/v1/login"):
            logger.info(
                "Login request",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "client": request.client.host if request.client else None,
                    "headers": {
                        "host": request.headers.get("host"),
                        "x-forwarded-proto": request.headers.get("x-forwarded-proto"),
                        "x-forwarded-host": request.headers.get("x-forwarded-host"),
                        "forwarded": request.headers.get("forwarded"),
                        "cf-visitor": request.headers.get("cf-visitor"),
                        "user-agent": request.headers.get("user-agent"),
                    },
                },
            )
        # Log potentially problematic requests that might cause "Invalid HTTP request" warnings
        elif request.url.path in [
            "/favicon.ico",
            "/robots.txt",
        ] or not request.url.path.startswith("/api"):
            # These are usually harmless browser requests - log at debug level
            logger.debug(
                f"Non-API request: {request.method} {request.url.path} from {request.client.host if request.client else 'unknown'}"
            )

        response = await call_next(request)

        if request.url.path.startswith("/api/v1/login"):
            logger.info(
                "Login response",
                extra={
                    "path": request.url.path,
                    "status": response.status_code,
                    "location": response.headers.get("location"),
                    "scheme": request.url.scheme,
                },
            )

        return response


# Add authentication middleware (must be before CORS)
app.add_middleware(AuthenticationMiddleware)

# Targeted request logging to debug scheme/redirect issues
app.add_middleware(LoginRequestLoggingMiddleware)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://billup-frontend.vercel.app",  # Production frontend
        "http://localhost:3000",  # Local development
        "http://localhost:3001",
        "http://127.0.0.1:3000",  # Local development alternative
    ],
    allow_credentials=True,  # Now safe with specific origins
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(OperationalError)
async def database_quota_exception_handler(request, exc):
    """Handle database quota exceeded errors gracefully"""
    if "data transfer quota" in str(exc).lower():
        return JSONResponse(
            status_code=503,
            content={
                "error": "Database quota exceeded",
                "message": "Your database plan has exceeded its data transfer quota. Please upgrade your Neon plan to continue.",
                "details": str(exc),
                "solution": "Upgrade your Neon database plan to increase limits",
            },
        )
    # For other database errors, return generic error
    return JSONResponse(
        status_code=503,
        content={
            "error": "Database connection error",
            "message": "Unable to connect to database. Please try again later.",
            "details": str(exc),
        },
    )


@app.get("/")
async def read_root():
    return {"message": "the server is running!"}


@app.get("/health")
async def health_check():
    """Health check endpoint to verify server"""
    return {
        "status": "healthy",
        "message": "Server running",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/health/background")
async def background_health_check():
    """Health check endpoint for background processing system"""
    try:
        # Get Redis health information using utility function
        redis_health = get_redis_health_info()

        if redis_health["status"] != "healthy":
            return {
                "status": "unhealthy",
                "error": "Redis connection failed",
                "details": redis_health.get("error", "Unknown Redis error"),
                "timestamp": datetime.now().isoformat(),
            }

        # Check database connection
        from app.db.session import get_db

        db = next(get_db())
        try:
            # Simple query to test database connection
            from app.models.form_submission import FormSubmission
            from app.models.background_task import BackgroundTask

            submissions_count = db.query(FormSubmission).count()
            tasks_count = db.query(BackgroundTask).count()

            # Get recent task statistics
            from datetime import datetime, timedelta

            one_hour_ago = datetime.now() - timedelta(hours=1)

            recent_tasks = (
                db.query(BackgroundTask)
                .filter(BackgroundTask.created_at >= one_hour_ago)
                .all()
            )

            task_stats = {
                "total": len(recent_tasks),
                "pending": len([t for t in recent_tasks if t.status == "pending"]),
                "processing": len(
                    [t for t in recent_tasks if t.status == "processing"]
                ),
                "completed": len([t for t in recent_tasks if t.status == "completed"]),
                "failed": len([t for t in recent_tasks if t.status == "failed"]),
            }

        finally:
            db.close()

        return {
            "status": "healthy",
            "redis": {
                "connected": True,
                "config": redis_health["config"],
                "redis_version": redis_health.get("redis_version", "Unknown"),
                "uptime_seconds": redis_health.get("uptime_seconds", 0),
                "connected_clients": redis_health.get("connected_clients", 0),
                "used_memory_human": redis_health.get("used_memory_human", "Unknown"),
                "queue_length": redis_health.get("queue_length", 0),
                "failed_queue_length": redis_health.get("failed_queue_length", 0),
            },
            "database": {
                "connected": True,
                "submissions_count": submissions_count,
                "tasks_count": tasks_count,
            },
            "background_processing": {
                "status": "operational",
                "recent_tasks": task_stats,
            },
            "timestamp": datetime.now().isoformat(),
        }

    except redis.ConnectionError as e:
        logger.error(f"Redis connection failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": "Redis connection failed",
            "details": str(e),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Background health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": "Background processing health check failed",
            "details": str(e),
            "timestamp": datetime.now().isoformat(),
        }


prefix = "/api/v1"

# Include routes
routers = [
    auth.router,
    agency.router,
    user.router,
    form_submission.router,
    background_task.router,
    monitoring.router,
    system_configuration.router,
    billing_file.router,
    billing_file_277.router,
    debug.router,
    google_settings.router,
    metrics.router,
    autoscaler.router,
]
for router in routers:
    app.include_router(router, prefix=prefix)


@app.on_event("startup")
async def startup_event():
    # # Run Alembic migrations
    # try:
    #     print("Running database migrations...")
    #     result = subprocess.run(
    #         [sys.executable, "-m", "alembic", "upgrade", "head"],
    #         capture_output=True,
    #         text=True,
    #         timeout=60,
    #     )

    #     if result.returncode == 0:
    #         print("✅ Database migrations completed successfully")
    #     else:
    #         print(f"⚠️ Database migration error: {result.stderr}")
    # except Exception as e:
    #     print(f"⚠️ Database migration error: {e}")

    # Verify Redis connection before starting services
    logger.info("🔍 Verifying Redis connection...")
    redis_connected = verify_redis_connection_with_retry(max_retries=3, retry_delay=2.0)
    if not redis_connected:
        logger.error(
            "❌ Redis connection verification failed - server cannot start without Redis"
        )
        logger.error("Please ensure Redis server is running and accessible")
        raise RuntimeError(
            "Redis connection verification failed - server cannot start without Redis"
        )
    logger.info("✅ Redis connection verified successfully")

    # Initialize database
    init_db()

    # Initialize encryption keys for HIPAA compliance
    logger.info("🔐 Initializing encryption keys...")
    try:
        from app.db.session import SessionLocal
        from app.services.crypto import ensure_encryption_keys, get_kms_mode

        db = SessionLocal()
        try:
            ensure_encryption_keys(db, tenant_id="GLOBAL")
            kms_mode = get_kms_mode()
            logger.info(f"✅ Encryption keys initialized (mode: {kms_mode})")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"⚠️ Encryption key initialization failed: {e}")
        raise RuntimeError(f"Encryption key initialization failed: {e}")

    # Start autoscaler service (if enabled)
    try:
        from app.services.autoscaler_service import autoscaler_service

        autoscaler_service.start()
    except Exception as e:
        logger.warning(f"⚠️ Failed to start autoscaler service: {e}")
        # Don't fail startup if autoscaler fails - it's optional


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down services...")

    # Stop autoscaler service
    try:
        from app.services.autoscaler_service import autoscaler_service

        autoscaler_service.stop()
    except Exception as e:
        logger.warning(f"Error stopping autoscaler service: {e}")


# uvicorn app.main:app --reload
