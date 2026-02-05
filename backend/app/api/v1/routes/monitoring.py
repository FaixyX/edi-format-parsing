from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.monitoring import (
    MonitoringEntryOut,
    MonitoringEntryLight,
    UpdateCheckedStatus,
    UpdateCheckedStatusResponse,
    UpdateNote,
    UpdateNoteResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
)
from app.services.monitoring_service import MonitoringService
from app.services.user_service import get_current_user
from app.services.agency_service import get_agency_decrypted_credentials
from app.models.background_task import BackgroundTask
from app.models.agency import Agency
from app.models.user import User
from app.services.crypto import get_phi_encryption_service
from typing import List
from datetime import datetime
import logging
import os
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/monitoring/light", response_model=List[MonitoringEntryLight])
def list_all_monitoring_entries_light(
    skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)
):
    """Get all lightweight monitoring entries with optional filtering (table display)"""
    try:
        return MonitoringService.get_all_monitoring_entries_light(
            db, skip, limit, status
        )
    except Exception as e:
        logger.error(f"Error getting all lightweight monitoring entries: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/monitoring/{task_id}/details", response_model=MonitoringEntryOut)
def get_monitoring_entry_details(task_id: str, db: Session = Depends(get_db)):
    """Get detailed monitoring entry by task_id (for sheet view)"""
    try:
        entry = MonitoringService.get_monitoring_entry_details(db, task_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Task not found")
        return entry
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitoring entry details for {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/monitoring/{task_id}/edi")
def download_edi(task_id: str, db: Session = Depends(get_db)):
    """Download EDI file for a monitoring entry"""
    try:
        # Find the background task
        background_task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not background_task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Get EDI file from database (base64 encoded)
        if not background_task.edi_file_data:
            raise HTTPException(
                status_code=404, detail="EDI file not found in database"
            )

        filename = (
            background_task.edi_filename
            or background_task.params.get("filename", "file.edi")
            if background_task.params
            else "file.edi"
        )

        # Decrypt and decode EDI data
        try:
            import base64

            phi_crypto = get_phi_encryption_service()
            # Decrypt first (handles both encrypted and unencrypted data)
            edi_base64 = phi_crypto.decrypt_edi_file(background_task.edi_file_data)
            edi_content = base64.b64decode(edi_base64).decode("utf-8")
        except Exception as e:
            logger.error(
                f"Error decrypting/decoding EDI file data for task {task_id}: {e}"
            )
            raise HTTPException(status_code=500, detail="Invalid EDI file data")

        # Return EDI file as response with attachment header for download
        return Response(
            content=edi_content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading EDI file for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/monitoring/{task_id}/edi/preview")
def preview_edi(task_id: str, db: Session = Depends(get_db)):
    """Preview EDI file for a monitoring entry (inline display)"""
    try:
        # Find the background task
        background_task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not background_task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Get EDI file from database (base64 encoded)
        if not background_task.edi_file_data:
            raise HTTPException(
                status_code=404, detail="EDI file not found in database"
            )

        filename = (
            background_task.edi_filename
            or background_task.params.get("filename", "file.edi")
            if background_task.params
            else "file.edi"
        )

        # Decrypt and decode EDI data
        try:
            import base64

            phi_crypto = get_phi_encryption_service()
            # Decrypt first (handles both encrypted and unencrypted data)
            edi_base64 = phi_crypto.decrypt_edi_file(background_task.edi_file_data)
            edi_content = base64.b64decode(edi_base64).decode("utf-8")
        except Exception as e:
            logger.error(
                f"Error decrypting/decoding EDI file data for task {task_id}: {e}"
            )
            raise HTTPException(status_code=500, detail="Invalid EDI file data")

        # Return EDI file as response with inline header for preview
        return Response(
            content=edi_content,
            media_type="text/plain",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing EDI file for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/monitoring/{task_id}/retry")
def retry_monitoring_entry(task_id: str, db: Session = Depends(get_db)):
    """
    Retry a failed monitoring entry by resetting and re-processing the same task.

    This endpoint:
    1. Retrieves the existing task
    2. Resets the task to a fresh state (status, retry_count, error fields)
    3. Preserves task data (file, params, review tracking)
    4. Re-enqueues the same task for processing
    5. Returns the same task_id
    """
    try:
        # Get the existing task
        task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Prevent retrying a task that's still processing
        if task.status == "processing":
            raise HTTPException(
                status_code=400,
                detail="Cannot retry a task that is currently processing. Please wait for it to complete or fail.",
            )

        # Get the agency
        agency = db.query(Agency).filter(Agency.id == task.agency_id).first()

        if not agency:
            raise HTTPException(status_code=404, detail="Agency not found")

        # Extract params from task
        params = task.params or {}
        filename = task.edi_filename or params.get("filename", "unknown.edi")
        npi = params.get("npi", agency.npi)

        # Verify EDI file data exists
        if not task.edi_file_data:
            raise HTTPException(
                status_code=404,
                detail="EDI file data not found in database. Cannot retry task.",
            )

        # Get the configured max retries for EDI billing tasks
        from app.services.system_configuration_service import SystemConfigurationService

        configured_max_retries = SystemConfigurationService.get_edi_billing_max_retries(
            db
        )

        # Reset task to fresh state for retry
        # Clear error and result data
        task.error_message = None
        task.result_data = None
        task.completed_at = None
        task.started_at = None
        
        # Reset status and retry count
        task.status = "pending"
        task.retry_count = 0
        task.max_retries = configured_max_retries
        
        # Note: We preserve:
        # - task_id (same task)
        # - created_at (original creation time)
        # - edi_file_data and edi_filename (file data)
        # - params (task parameters)
        # - Review tracking fields (is_checked, note, checked_by, etc.)

        db.commit()
        db.refresh(task)

        # Detect transaction type and queue appropriate worker
        transaction_type = params.get("transaction_type")
        
        if transaction_type == "277":
            # Queue 277-specific worker
            from app.tasks.edi_277_billing_tasks import enqueue_277_billing_file_task
            
            task_data = {
                "task_id": task.task_id,
                "npi": npi,
                "filename": filename,
                "header_date": params.get("ra_date"),  # 277 uses ra_date for header_date
            }
            
            enqueue_277_billing_file_task(task_data)
            logger.info(
                f"Retried 277 task {task_id} (same task, reset to pending) for agency {agency.name}"
            )
        else:
            # Queue 837/835 worker (default)
            from app.tasks.edi_billing_tasks import enqueue_edi_billing_file_task
            
            # Get decrypted agency credentials for the worker
            decrypted_creds = get_agency_decrypted_credentials(agency)
            
            task_data = {
                "task_id": task.task_id,  # Use the same task_id
                "agency_id": str(agency.id),
                "agency_link": decrypted_creds["link"],
                "agency_username": decrypted_creds["username"],
                "agency_password": decrypted_creds["password"],
                "npi": npi,
                "filename": filename,
                "bank_check": params.get("bank_check"),
            }
            
            # Enqueue task with configurable delay and retries
            enqueue_edi_billing_file_task(task_data)
            logger.info(
                f"Retried 837/835 task {task_id} (same task, reset to pending) for agency {agency.name}"
            )

        return {
            "ok": True,
            "new_task_id": task.task_id,  # Return same task_id for backward compatibility
            "message": f"Task retry initiated. Task ID: {task.task_id}",
        }

    except HTTPException:
        raise
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error retrying monitoring entry {task_id}: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.patch("/monitoring/{task_id}/check", response_model=UpdateCheckedStatusResponse)
def update_task_checked_status(
    task_id: str,
    data: UpdateCheckedStatus,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the checked status of a monitoring task.

    This endpoint allows users to mark a task as checked/reviewed or uncheck it.
    It tracks who checked the task and when.
    """
    logger.info(
        f"[PATCH /check] Request received - task_id: {task_id}, is_checked: {data.is_checked}, user: {current_user.username}"
    )

    try:
        # Find the background task
        task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not task:
            logger.warning(f"[PATCH /check] Task not found: {task_id}")
            raise HTTPException(status_code=404, detail="Task not found")

        logger.info(
            f"[PATCH /check] Task found - current is_checked: {task.is_checked}"
        )

        # Update checked status
        task.is_checked = data.is_checked
        task.checked_by = current_user.username if data.is_checked else None
        task.checked_at = datetime.utcnow() if data.is_checked else None

        logger.info(
            f"[PATCH /check] Updating to is_checked: {task.is_checked}, checked_by: {task.checked_by}"
        )

        db.commit()
        db.refresh(task)

        logger.info(
            f"[PATCH /check] SUCCESS - Task {task_id} checked status updated to {data.is_checked} by {current_user.username}"
        )

        response = UpdateCheckedStatusResponse(
            success=True, checked_by=task.checked_by, checked_at=task.checked_at
        )
        logger.info(f"[PATCH /check] Response: {response}")

        return response

    except HTTPException:
        raise
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        # Note: Not using exc_info=True to avoid logging full traceback that might contain ePHI
        logger.error(
            f"[PATCH /check] ERROR updating checked status for task {task_id}: {type(e).__name__}"
        )
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/monitoring/{task_id}/note", response_model=UpdateNoteResponse)
def update_task_note(
    task_id: str,
    data: UpdateNote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the note for a monitoring task.

    This endpoint allows users to add, edit, or remove notes on tasks.
    It tracks who added/updated the note and when.
    """
    try:
        # Find the background task
        task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Update note
        note = data.note.strip()
        task.note = note if note else None
        task.note_by = current_user.username if note else None
        task.note_at = datetime.utcnow() if note else None

        db.commit()
        db.refresh(task)

        logger.info(
            f"Task {task_id} note {'updated' if note else 'removed'} by {current_user.username}"
        )

        return UpdateNoteResponse(
            success=True, note_by=task.note_by, note_at=task.note_at
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating note for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/monitoring/{task_id}")
def delete_monitoring_entry(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a monitoring entry and all its related data.

    This endpoint:
    1. Deletes the background task record
    2. Deletes the EDI file data stored in the database
    3. Deletes all associated retry tasks (if any)
    4. Returns success confirmation

    Note: This action is permanent and cannot be undone.
    """
    try:
        # Find the background task
        task = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Store task info for logging
        task_filename = task.edi_filename or (
            task.params.get("filename") if task.params else "unknown"
        )
        agency_id = str(task.agency_id)

        # Delete the task (this will cascade delete related data if configured)
        db.delete(task)
        db.commit()

        logger.info(
            f"Task {task_id} (file: {task_filename}) deleted by {current_user.username}"
        )

        return {"ok": True, "message": f"Task {task_id} deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        # Note: Not using exc_info=True to avoid logging full traceback that might contain ePHI
        logger.error(f"Error deleting monitoring entry {task_id}: {type(e).__name__}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/monitoring/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_monitoring_entries(
    request: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete multiple monitoring entries and all their related data.

    This endpoint:
    1. Deletes all specified background task records
    2. Deletes all EDI file data stored in the database
    3. Returns success confirmation with count of deleted entries

    Note: This action is permanent and cannot be undone.
    """
    try:
        task_ids = request.task_ids
        if not task_ids or len(task_ids) == 0:
            raise HTTPException(status_code=400, detail="No task IDs provided")

        # Find all tasks
        tasks = (
            db.query(BackgroundTask).filter(BackgroundTask.task_id.in_(task_ids)).all()
        )

        if not tasks:
            raise HTTPException(status_code=404, detail="No tasks found")

        # Store task info for logging
        deleted_count = len(tasks)
        task_filenames = [
            task.edi_filename
            or (task.params.get("filename") if task.params else "unknown")
            for task in tasks
        ]

        # Delete all tasks
        for task in tasks:
            db.delete(task)

        db.commit()

        logger.info(
            f"Bulk delete: {deleted_count} task(s) deleted by {current_user.username}. "
            f"Task IDs: {', '.join([t.task_id for t in tasks])}"
        )

        return {
            "ok": True,
            "deleted_count": deleted_count,
            "message": f"Successfully deleted {deleted_count} task(s)",
        }

    except HTTPException:
        raise
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        # Note: Not using exc_info=True to avoid logging full traceback that might contain ePHI
        logger.error(f"Error bulk deleting monitoring entries: {type(e).__name__}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
