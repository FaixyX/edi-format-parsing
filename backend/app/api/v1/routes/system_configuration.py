from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.system_configuration import (
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    SystemConfigurationOut,
    SyncIntervalConfigOut,
    SyncIntervalConfigUpdate,
    SyncEnabledUpdate,
    MaxRetriesUpdate,
    SyncConfigurationBulkUpdate,
    SyncConfigurationBulkUpdateResponse,
    EdiBillingConfigurationBulkUpdate,
    EdiBillingConfigurationBulkUpdateResponse,
)
from app.services.system_configuration_service import SystemConfigurationService
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/configurations", response_model=List[SystemConfigurationOut])
def get_all_configurations(db: Session = Depends(get_db)):
    """Get all active system configurations"""
    try:
        configurations = SystemConfigurationService.get_all_configurations(db)
        return configurations
    except Exception as e:
        logger.error(f"Error fetching configurations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch configurations",
        )


@router.get("/configurations/{key}", response_model=SystemConfigurationOut)
def get_configuration(key: str, db: Session = Depends(get_db)):
    """Get a specific configuration by key"""
    try:
        configuration = SystemConfigurationService.get_configuration(db, key)
        if not configuration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration '{key}' not found",
            )
        return configuration
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching configuration '{key}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch configuration",
        )


@router.post(
    "/configurations",
    response_model=SystemConfigurationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_configuration(
    configuration: SystemConfigurationCreate, db: Session = Depends(get_db)
):
    """Create a new system configuration"""
    try:
        return SystemConfigurationService.create_configuration(db, configuration)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create configuration",
        )


@router.put("/configurations/{key}", response_model=SystemConfigurationOut)
def update_configuration(
    key: str,
    configuration_update: SystemConfigurationUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing system configuration"""
    try:
        updated_config = SystemConfigurationService.update_configuration(
            db, key, configuration_update
        )
        if not updated_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration '{key}' not found",
            )
        return updated_config
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating configuration '{key}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration",
        )


@router.delete("/configurations/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_configuration(key: str, db: Session = Depends(get_db)):
    """Delete a system configuration (soft delete)"""
    try:
        success = SystemConfigurationService.delete_configuration(db, key)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Configuration '{key}' not found",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting configuration '{key}': {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete configuration",
        )


# Specialized endpoints for sync configuration
@router.get("/sync-configuration", response_model=SyncIntervalConfigOut)
def get_sync_configuration(db: Session = Depends(get_db)):
    """Get sync interval configuration"""
    try:
        sync_config = SystemConfigurationService.get_sync_configuration(db)
        sync_interval_config = SystemConfigurationService.get_configuration(
            db, "sync_interval_minutes"
        )

        return SyncIntervalConfigOut(
            sync_interval_minutes=sync_config["sync_interval_minutes"],
            description=(
                sync_interval_config.description
                if sync_interval_config
                else "Sync interval in minutes"
            ),
            last_updated=(
                sync_interval_config.updated_at if sync_interval_config else None
            ),
        )
    except Exception as e:
        logger.error(f"Error fetching sync configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sync configuration",
        )


@router.put("/sync-configuration", response_model=SyncIntervalConfigOut)
def update_sync_configuration(
    sync_update: SyncIntervalConfigUpdate, db: Session = Depends(get_db)
):
    """Update sync interval configuration"""
    try:
        # Update the sync interval
        updated_config = SystemConfigurationService.set_sync_interval_minutes(
            db, sync_update.sync_interval_minutes
        )

        # Return the updated configuration
        return SyncIntervalConfigOut(
            sync_interval_minutes=sync_update.sync_interval_minutes,
            description=updated_config.description,
            last_updated=updated_config.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating sync configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sync configuration",
        )


@router.put("/sync-configuration/enabled", response_model=Dict[str, Any])
def update_sync_enabled(
    enabled_update: SyncEnabledUpdate, db: Session = Depends(get_db)
):
    """Update sync enabled/disabled status"""
    try:
        # Update the sync enabled status
        SystemConfigurationService.set_sync_enabled(db, enabled_update.enabled)

        return {
            "sync_enabled": enabled_update.enabled,
            "status": "active" if enabled_update.enabled else "disabled",
        }
    except Exception as e:
        logger.error(f"Error updating sync enabled status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update sync enabled status",
        )


@router.put("/sync-configuration/max-retries", response_model=Dict[str, Any])
def update_max_retries(
    max_retries_update: MaxRetriesUpdate, db: Session = Depends(get_db)
):
    """Update maximum retry attempts"""
    try:
        # Update the max retries (validation is handled in the service method)
        SystemConfigurationService.set_max_sync_retries(
            db, max_retries_update.max_retries
        )

        return {"max_sync_retries": max_retries_update.max_retries, "updated": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating max retries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update max retries",
        )


@router.get("/sync-configuration/status", response_model=Dict[str, Any])
def get_sync_status(db: Session = Depends(get_db)):
    """Get comprehensive sync configuration status"""
    try:
        sync_config = SystemConfigurationService.get_sync_configuration(db)
        return {
            "sync_interval_minutes": sync_config["sync_interval_minutes"],
            "sync_enabled": sync_config["sync_enabled"],
            "max_sync_retries": sync_config["max_sync_retries"],
            "status": "active" if sync_config["sync_enabled"] else "disabled",
        }
    except Exception as e:
        logger.error(f"Error fetching sync status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch sync status",
        )


@router.put(
    "/sync-configuration/bulk", response_model=SyncConfigurationBulkUpdateResponse
)
def bulk_update_sync_configuration(
    bulk_update: SyncConfigurationBulkUpdate, db: Session = Depends(get_db)
):
    """Bulk update all sync configuration settings in a single request"""
    try:
        # Validate that at least one field is provided
        if not any(
            [
                bulk_update.sync_interval_minutes is not None,
                bulk_update.sync_enabled is not None,
                bulk_update.max_retries is not None,
            ]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one configuration field must be provided",
            )

        # Perform bulk update
        update_result = SystemConfigurationService.bulk_update_sync_configuration(
            db,
            sync_interval_minutes=bulk_update.sync_interval_minutes,
            sync_enabled=bulk_update.sync_enabled,
            max_retries=bulk_update.max_retries,
        )

        return SyncConfigurationBulkUpdateResponse(
            sync_interval_minutes=update_result["sync_interval_minutes"],
            sync_enabled=update_result["sync_enabled"],
            max_retries=update_result["max_retries"],
            updated_fields=update_result["updated_fields"],
            status=update_result["status"],
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error bulk updating sync configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update sync configuration",
        )


# EDI Billing Configuration endpoints
@router.get("/edi-billing-configuration", response_model=Dict[str, Any])
def get_edi_billing_configuration(db: Session = Depends(get_db)):
    """Get EDI billing configuration settings"""
    try:
        edi_billing_config = SystemConfigurationService.get_edi_billing_configuration(
            db
        )
        return edi_billing_config
    except Exception as e:
        logger.error(f"Error fetching EDI billing configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch EDI billing configuration",
        )


@router.put("/edi-billing-configuration/max-retries", response_model=Dict[str, Any])
def update_edi_billing_max_retries(max_retries: int, db: Session = Depends(get_db)):
    """Update EDI billing maximum retry attempts"""
    try:
        SystemConfigurationService.set_edi_billing_max_retries(db, max_retries)
        return {"edi_billing_max_retries": max_retries, "updated": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating EDI billing max retries: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update EDI billing max retries",
        )


@router.put("/edi-billing-configuration/delay", response_model=Dict[str, Any])
def update_edi_billing_delay(delay_seconds: int, db: Session = Depends(get_db)):
    """Update EDI billing processing delay in seconds"""
    try:
        SystemConfigurationService.set_edi_billing_delay_seconds(db, delay_seconds)
        return {"edi_billing_delay_seconds": delay_seconds, "updated": True}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating EDI billing delay: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update EDI billing delay",
        )


@router.put(
    "/edi-billing-configuration/bulk",
    response_model=EdiBillingConfigurationBulkUpdateResponse,
)
def bulk_update_edi_billing_configuration(
    bulk_update: EdiBillingConfigurationBulkUpdate, db: Session = Depends(get_db)
):
    """Bulk update EDI billing configuration settings"""
    try:
        # Validate that at least one field is provided
        if not any(
            [
                bulk_update.max_retries is not None,
                bulk_update.delay_seconds is not None,
            ]
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one configuration field must be provided",
            )

        # Perform bulk update
        update_result = (
            SystemConfigurationService.bulk_update_edi_billing_configuration(
                db,
                max_retries=bulk_update.max_retries,
                delay_seconds=bulk_update.delay_seconds,
            )
        )

        return EdiBillingConfigurationBulkUpdateResponse(
            edi_billing_max_retries=update_result["edi_billing_max_retries"],
            edi_billing_delay_seconds=update_result["edi_billing_delay_seconds"],
            updated_fields=update_result["updated_fields"],
            status=update_result["status"],
        )

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error bulk updating EDI billing configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk update EDI billing configuration",
        )


