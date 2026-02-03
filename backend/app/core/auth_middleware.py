"""
Authentication middleware that automatically protects all API routes except public ones.
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.dependencies import is_public_endpoint
from app.db.session import get_db
from app.models.user import User
from app.services.jwt_service import decode_token
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware that automatically applies authentication to all API routes
    except those marked as public.
    """

    async def dispatch(self, request: Request, call_next):
        # Skip authentication for non-API routes
        path = request.url.path
        method = request.method

        if not path.startswith("/api/v1/"):
            return await call_next(request)

        # Check if this is a public endpoint - try both with and without trailing slash
        is_public = is_public_endpoint(method, path)
        if not is_public:
            # Try without trailing slash
            path_no_slash = path.rstrip("/")
            if path_no_slash != path:
                is_public = is_public_endpoint(method, path_no_slash)

        if not is_public and not path.endswith("/"):
            # Try with trailing slash
            is_public = is_public_endpoint(method, path + "/")

        logger.info(f"Auth middleware check: {method} {path} -> is_public: {is_public}")

        if is_public:
            logger.info(f"✅ Allowing public endpoint: {method} {path}")
            return await call_next(request)

        logger.info(f"🔒 Validating authentication for: {method} {path}")

        # For all other API routes, require authentication
        try:
            # Get the Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": "Authentication required. Please provide a valid Bearer token.",
                        "error": "missing_authorization_header",
                    },
                )

            # Extract the token
            token = auth_header.split(" ")[1]

            # Validate the JWT token
            payload = decode_token(token)
            if payload is None:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "detail": "Invalid authentication token",
                        "error": "invalid_token",
                    },
                )

            # Get user from database
            db = next(get_db())
            try:
                username = payload.get("sub")
                if not username:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Invalid token payload",
                            "error": "invalid_token_payload",
                        },
                    )

                user = db.query(User).filter(User.username == username).first()
                if not user or not user.enabled:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "User not found or inactive",
                            "error": "user_inactive",
                        },
                    )

                # Check token version to invalidate old tokens
                # Backward compatibility: old tokens without token_version are valid if user's token_version is 0
                user_token_version = user.token_version or 0
                token_version = payload.get("token_version")
                
                # If token doesn't have token_version (old token), only allow if user is still at version 0
                if token_version is None:
                    if user_token_version > 0:
                        return JSONResponse(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            content={
                                "detail": "Token has been invalidated. Please log in again.",
                                "error": "token_invalidated",
                            },
                        )
                # If token has token_version, it must match user's version
                elif token_version != user_token_version:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Token has been invalidated. Please log in again.",
                            "error": "token_invalidated",
                        },
                    )

                # Add user to request state for use in route handlers
                request.state.current_user = user

            finally:
                db.close()

            # Continue to the route handler
            response = await call_next(request)
            return response

        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail, "error": "authentication_failed"},
            )
        except Exception as e:
            logger.error(f"Authentication middleware error: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Internal authentication error",
                    "error": "authentication_middleware_error",
                },
            )
