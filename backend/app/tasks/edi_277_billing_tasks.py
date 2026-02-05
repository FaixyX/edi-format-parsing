"""
277 EDI Billing Tasks
Handles background processing for 277 claim status files.
This is separate from 837/835 processing to keep functionality modular.
"""

import dramatiq
from app.broker import broker
from app.services.background_task_service import BackgroundTaskService
from app.db.session import get_db
from sqlalchemy.orm import Session
import logging
from datetime import datetime, timezone
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@contextmanager
def get_db_session():
    """Context manager for database sessions to ensure proper cleanup"""
    db = None
    try:
        db = next(get_db())
        yield db
    except Exception as e:
        if db:
            db.rollback()
        logger.error(f"Database session error: {type(e).__name__}")
        raise
    finally:
        if db:
            try:
                db.close()
            except Exception:
                pass


def enqueue_277_billing_file_task(task_data: dict):
    """
    Enqueue a 277 EDI billing file task for background processing.
    
    Args:
        task_data: Dictionary with:
            - task_id: UUID of the background task
            - npi: Agency NPI
            - filename: Original filename
            - header_date: Date from 277 header
    """
    try:
        logger.info(f"Enqueueing 277 billing file task {task_data['task_id']}")
        process_277_billing_file.send(task_data)
        return True
    except Exception as e:
        logger.error(f"Failed to enqueue 277 billing file task: {type(e).__name__}")
        return False


@dramatiq.actor(
    broker=broker,
    max_retries=0,  # No automatic retries - we handle retries via task retry mechanism
    time_limit=300000,  # 5 minutes in milliseconds
    queue_name="default",
)
def process_277_billing_file(task_data: dict):
    """
    Process a 277 EDI billing file in the background.
    
    This worker:
    1. Retrieves the task and decrypts the EDI file
    2. Parses 277 patient/claim data (already done during upload)
    3. Updates Google Sheets with 277 claim status data
    4. Updates task status to completed
    
    Args:
        task_data: Dictionary with task_id, npi, filename, header_date
    """
    task_id = task_data.get("task_id")
    npi = task_data.get("npi")
    filename = task_data.get("filename", "unknown.edi")
    
    logger.info(f"Starting 277 billing file processing for task {task_id}")
    
    try:
        with get_db_session() as db:
            # Import models here to avoid circular imports
            from app.models.background_task import BackgroundTask
            
            # Get the task
            task = db.query(BackgroundTask).filter(
                BackgroundTask.task_id == task_id
            ).first()
            
            if not task:
                logger.error(f"Task {task_id} not found in database")
                return
            
            # Update task status to processing
            BackgroundTaskService.update_task_status(
                db, task_id, "processing"
            )
            
            # Phase 1: Get decrypted params (patient data already parsed during upload)
            from app.services.crypto import get_phi_encryption_service
            
            phi_crypto = get_phi_encryption_service()
            decrypted_params = phi_crypto.decrypt_task_params(task.params or {})
            
            header_date = decrypted_params.get("ra_date")  # 277 header date stored as ra_date
            edi_patients = decrypted_params.get("edi_patients", [])
            
            if not edi_patients:
                logger.warning(f"No patient data found for task {task_id}")
                result = {
                    "message": "No patient data found in 277 file",
                    "google_sheets_update": {
                        "updated": False,
                        "status": "skipped",
                        "message": "No patient data available",
                        "details": None,
                    }
                }
                BackgroundTaskService.update_task_status(
                    db, task_id, "completed", result_data=result
                )
                return
            
            logger.info(f"Found {len(edi_patients)} patients in 277 file")
            
            # Phase 2: Update Google Sheets with 277 claim status data
            sheets_update_status = {
                "updated": False,
                "status": "not_attempted",
                "message": None,
                "details": None,
            }
            
            try:
                from app.services.google_sheets_service import GoogleSheetsService
                from app.services.google_account_service import GoogleAccountService
                
                if GoogleAccountService.is_account_linked(db):
                    logger.info(f"Updating Google Sheets for 277 task {task_id}")
                    
                    # Update 277 patient data in Google Sheets
                    sheets_result = GoogleSheetsService.update_277_patient_data_in_sheet(
                        db=db,
                        npi=npi,
                        header_date=header_date,
                        patients=edi_patients,
                    )
                    
                    if sheets_result.get("success"):
                        sheets_update_status = {
                            "updated": True,
                            "status": "success",
                            "message": "Google Sheets updated successfully with 277 data",
                            "details": {
                                "updated": sheets_result.get("updated", 0),
                                "skipped": sheets_result.get("skipped", 0),
                                "not_found": sheets_result.get("not_found", 0),
                                "total": sheets_result.get("total", 0),
                                "spreadsheet_id": sheets_result.get("spreadsheet_id"),
                                "sheet_name": sheets_result.get("sheet_name"),
                            },
                        }
                        logger.info(
                            f"Updated Google Sheets for 277 task {task_id}: "
                            f"{sheets_result.get('updated')} patients added"
                        )
                    else:
                        sheets_update_status = {
                            "updated": False,
                            "status": "failed",
                            "message": sheets_result.get("message", "Unknown error"),
                            "details": {
                                "updated": sheets_result.get("updated", 0),
                                "skipped": sheets_result.get("skipped", 0),
                                "not_found": sheets_result.get("not_found", 0),
                                "total": sheets_result.get("total", 0),
                            },
                        }
                        logger.warning(
                            f"Failed to update Google Sheets for 277 task {task_id}: {sheets_result.get('message')}"
                        )
                else:
                    sheets_update_status = {
                        "updated": False,
                        "status": "skipped",
                        "message": "No Google account linked",
                        "details": None,
                    }
                    logger.debug("No Google account linked, skipping Sheets update")
                    
            except Exception as sheets_error:
                # Don't fail the task if Sheets update fails
                sheets_update_status = {
                    "updated": False,
                    "status": "error",
                    "message": f"Exception during Sheets update: {str(sheets_error)}",
                    "details": None,
                }
                logger.warning(
                    f"Failed to update Google Sheets for 277 task {task_id}: {str(sheets_error)}"
                )
            
            # Phase 3: Complete the task
            result = {
                "message": f"277 file processed successfully: {len(edi_patients)} patients",
                "patients_count": len(edi_patients),
                "google_sheets_update": sheets_update_status,
            }
            
            BackgroundTaskService.update_task_status(
                db, task_id, "completed", result_data=result
            )
            
            logger.info(f"Completed 277 billing file processing for task {task_id}")
            
    except Exception as e:
        logger.error(
            f"Fatal error processing 277 billing file for task {task_id}: {type(e).__name__} - {str(e)}"
        )
        
        try:
            with get_db_session() as db:
                # Store error in task
                error_message = f"Error processing 277 file: {str(e)}"
                
                result_data = {
                    "error": error_message,
                    "error_type": type(e).__name__,
                    "google_sheets_update": {
                        "updated": False,
                        "status": "error",
                        "message": error_message,
                        "details": None,
                    }
                }
                
                BackgroundTaskService.update_task_status(
                    db, task_id, "failed", error_message=error_message, result_data=result_data
                )
                
        except Exception as update_error:
            logger.error(
                f"Failed to update task status after error: {type(update_error).__name__}"
            )
