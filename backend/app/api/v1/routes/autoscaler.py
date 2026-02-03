"""
Autoscaler status and control endpoints.
"""

import logging
from fastapi import APIRouter, HTTPException
from app.services.autoscaler_service import autoscaler_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/autoscaler/status")
async def get_autoscaler_status():
    """
    Get autoscaler status and configuration.

    Returns information about:
    - Whether autoscaler is enabled and running
    - Configuration (interval, min/max machines)
    - Last scaling action
    """
    try:
        status = autoscaler_service.get_status()
        return status
    except Exception as e:
        logger.error(f"Error getting autoscaler status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/autoscaler/scale-now")
async def trigger_autoscaler():
    """
    Manually trigger an autoscaling check and action.

    This endpoint allows manual triggering of the autoscaler
    without waiting for the next scheduled check.
    """
    try:
        if not autoscaler_service.is_enabled():
            raise HTTPException(
                status_code=400,
                detail="Autoscaler is not enabled. Set AUTOSCALER_ENABLED=true to enable.",
            )

        success = autoscaler_service.scale_workers()
        return {
            "success": success,
            "message": "Autoscaling check completed",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering autoscaler: {e}")
        raise HTTPException(status_code=500, detail=str(e))
