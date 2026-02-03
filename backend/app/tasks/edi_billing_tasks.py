import dramatiq
from app.broker import broker  # Import the configured broker with AsyncIO middleware
from app.services.playwright_bot_service import PlaywrightBotService, PlaywrightError
from app.services.background_task_service import BackgroundTaskService
from app.services.browser_manager import browser_manager
from app.services.system_configuration_service import SystemConfigurationService
from app.db.session import get_db
from sqlalchemy.orm import Session
import logging
import os
import asyncio
import atexit
from datetime import datetime, timezone, timedelta
from contextlib import contextmanager
import time
import json
import redis
from redis import ConnectionPool
from dotenv import load_dotenv
from dramatiq import Retry
import glob
import base64
import tempfile
import httpx

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)


def trigger_worker_wakeup() -> bool:
    """
    Ping the worker HTTP trigger endpoint to wake it up for queued tasks.
    Returns True on successful trigger, False otherwise.
    """
    worker_url = os.getenv("WORKER_SERVICE_URL", "http://localhost:8001")
    trigger_endpoint = f"{worker_url}/trigger"

    try:
        response = httpx.post(trigger_endpoint, json={"action": "wake_up"}, timeout=5.0)
        if response.status_code == 200:
            logger.info("Worker wake-up triggered successfully")
            return True

        logger.warning(
            "Worker wake-up request returned non-200 status: %s",
            response.status_code,
        )
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.warning(f"Failed to trigger worker wake-up: {type(e).__name__}")

    return False


def _create_fresh_session():
    """Create a fresh database session to handle connection issues"""
    from app.db.session import SessionLocal

    return SessionLocal()


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
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Database session error: {type(e).__name__}")
        raise
    finally:
        if db:
            try:
                db.close()
            except Exception as close_error:
                # Note: Only logging error type to protect ePHI that might be in error message
                logger.warning(
                    f"Error closing database session: {type(close_error).__name__}"
                )
                raise


def cleanup_browser_manager():
    """Clean up browser manager when worker process exits"""
    try:
        logger.info("Cleaning up browser manager...")
        asyncio.run(browser_manager.stop())
        logger.info("Browser manager cleaned up successfully")
    except Exception as e:
        logger.warning(f"Error cleaning up browser manager: {str(e)}")
        raise


def cleanup_temp_files():
    """Clean up any remaining temporary files on exit"""
    try:
        # Clean up temporary PDF files
        temp_patterns = [
            "/tmp/tmp*_*.pdf",
            "/tmp/tmp*_*.png",
            "/tmp/tmp*_*.jpg",
            "/tmp/tmp*_*.jpeg",
        ]

        cleaned_count = 0
        for pattern in temp_patterns:
            for file_path in glob.glob(pattern):
                try:
                    if os.path.exists(file_path):
                        os.unlink(file_path)
                        cleaned_count += 1
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {file_path}: {str(e)}")

        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} temporary files on exit")
    except Exception as e:
        logger.warning(f"Error during temporary file cleanup: {str(e)}")


# Register cleanup functions to run on process exit
atexit.register(cleanup_browser_manager)
atexit.register(cleanup_temp_files)


def enqueue_edi_billing_file_task(task_data: dict):
    """
    Enqueue an EDI billing file task with configurable delay and retries.

    Args:
        task_data: Dictionary containing all necessary data for processing
    """
    try:
        # Get current configuration from database
        with get_db_session() as db:
            max_retries = SystemConfigurationService.get_edi_billing_max_retries(db)
            delay_seconds = SystemConfigurationService.get_edi_billing_delay_seconds(db)

        # Wake up worker before enqueueing to handle scale-to-zero scenarios
        if not trigger_worker_wakeup():
            logger.warning("Worker wake-up trigger failed; proceeding to enqueue task")

        # Convert delay to milliseconds for Dramatiq
        delay_ms = delay_seconds * 1000

        # Enqueue task with configurable settings
        if delay_ms > 0:
            logger.info(
                f"Enqueueing EDI billing file task with {delay_seconds}s delay and {max_retries} max retries"
            )
            process_edi_billing_file_task.send_with_options(
                args=(task_data,), delay=delay_ms, max_retries=max_retries
            )
        else:
            logger.info(
                f"Enqueueing EDI billing file task immediately with {max_retries} max retries"
            )
            process_edi_billing_file_task.send_with_options(
                args=(task_data,), max_retries=max_retries
            )

    except Exception as e:
        logger.error(f"Failed to enqueue EDI billing file task: {str(e)}")
        raise


@dramatiq.actor
def log_failure(message_data, exception_data):
    # Dramatiq populates retries BEFORE it schedules the next try
    r = message_data.get("options", {}).get("retries", 0)
    mr = message_data.get("options", {}).get("max_retries")
    # Note: Not logging exception repr to protect ePHI that might be in exception message
    exc_type = "Unknown"
    if exception_data and isinstance(exception_data, dict):
        exc_repr = exception_data.get("repr", "")
        # Try to extract just the exception type from the repr
        if exc_repr:
            # Extract type name from repr like "ValueError('message')" -> "ValueError"
            import re

            match = re.match(r"^(\w+)", exc_repr)
            if match:
                exc_type = match.group(1)
    logger.error(
        f"[on_failure] message={message_data['message_id']} retries_so_far={r}/{mr} exc_type={exc_type}"
    )


@dramatiq.actor
def mark_task_failed(*args, **kwargs):
    """Called when retries are exhausted for the original message."""
    # Debug logging to see what parameters we actually receive
    logger.info(f"mark_task_failed called with args: {args}")
    logger.info(f"mark_task_failed called with kwargs: {kwargs}")

    # Try to extract parameters from different possible signatures
    message_data = None
    context = None
    exception_data = None

    if len(args) >= 1:
        message_data = args[0]
    if len(args) >= 2:
        context = args[1]
    if len(args) >= 3:
        exception_data = args[2]

    # Also check kwargs
    if not message_data:
        message_data = kwargs.get("message_data")
    if not context:
        context = kwargs.get("context")
    if not exception_data:
        exception_data = kwargs.get("exception_data")

    logger.info(
        f"Extracted - message_data: {type(message_data)}, context: {type(context)}, exception_data: {type(exception_data)}"
    )

    # Retrieve task_id – from args or options depending on how you send the message
    task_id = None
    try:
        # Prefer explicit argument payload
        maybe_payload = message_data.get("args") or []
        if maybe_payload and isinstance(maybe_payload[0], dict):
            task_id = maybe_payload[0].get("task_id")

        # Fallback: options if you send custom options
        task_id = task_id or message_data.get("options", {}).get("task_id")
    except Exception:
        pass

    # Guard
    if not task_id:
        task_id = message_data.get("message_id")

    retries = context.get("retries", 0) if context else 0
    max_retries = context.get("max_retries", 3) if context else 3

    # Extract the actual error message from exception_data if available
    actual_error_message = "Unknown error"
    structured_error_data = None

    if exception_data:
        # Note: Not logging exception_data content directly to protect ePHI
        logger.info("Processing exception_data for task failure")
        # Try to get the exception representation
        if isinstance(exception_data, dict):
            actual_error_message = exception_data.get("repr", "Unknown error")
        else:
            actual_error_message = str(exception_data)
    else:
        logger.info("No exception_data provided")

    # Create a more informative error message
    error_message = f"Retries exhausted ({retries}/{max_retries}). Last error: {actual_error_message}"

    from app.services.background_task_service import BackgroundTaskService

    db = _create_fresh_session()
    try:
        # Get the task to update retry_count manually since update_task_status no longer manages retry_count
        task = BackgroundTaskService.get_task_by_id(db, task_id)
        if task:
            # Check if there's already a stored error message from the task execution
            stored_error_message = task.error_message
            stored_result_data = task.result_data

            if stored_error_message and stored_error_message != "Unknown error":
                # Note: Not logging error message content to protect ePHI
                logger.info("Using stored error message from task")
                # Use the stored raw error message
                error_message = stored_error_message
                actual_error_message = stored_error_message

            # Use stored structured error data if available
            if stored_result_data and isinstance(stored_result_data, dict):
                structured_error_data = stored_result_data
                # Note: Not logging error data content to protect ePHI
                logger.info("Using stored structured error data")

            # Set retry_count to the actual number of retries attempted (including the final failed attempt)
            task.retry_count = retries
            task.status = "failed"
            task.error_message = error_message
            # Keep the structured error data if it exists
            if structured_error_data:
                task.result_data = structured_error_data
            task.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(task)
            logger.info(f"Task {task_id} marked as failed after {retries} retries.")
        else:
            logger.error(f"Task {task_id} not found when marking as failed")
    finally:
        db.close()


@dramatiq.actor(
    time_limit=600_000,  # 10 minutes
    on_failure="log_failure",  # callback for every failed attempt
    on_retry_exhausted="mark_task_failed",  # callback when retries are used up
)
async def process_edi_billing_file_task(task_data: dict):
    """
    Process EDI billing file upload and validation task.

    Args:
        task_data: Dictionary containing all necessary data for processing
            - task_id: UUID of the background task
            - agency_id: UUID of the agency
            - agency_link: Agency website URL
            - agency_username: Login username
            - agency_password: Login password
            - npi: Agency NPI extracted from EDI file
            - filename: Original EDI filename
    Note: EDI file is retrieved from database (edi_file_data field) and temporarily written to disk for Playwright
    """
    task_id = task_data.get("task_id", "unknown")
    agency_id = task_data.get("agency_id", "unknown")
    filename = task_data.get("filename", "unknown")

    # Get current retry count from Dramatiq context
    current_retries = 0
    try:
        from dramatiq.middleware import CurrentMessage

        msg = CurrentMessage.get_current_message()
        if msg:
            current_retries = msg.options.get("retries", 0)
    except Exception:
        pass

    logger.info(
        f"Starting EDI billing file processing - Task ID: {task_id}, Agency ID: {agency_id}, Filename: {filename}, Retry: {current_retries}"
    )

    start_time = time.time()

    try:
        # Phase 1: Update task status to processing and retrieve EDI file from database
        db = _create_fresh_session()
        edi_file_path = None
        temp_file_handle = None
        try:
            task = BackgroundTaskService.get_task_by_id(db, task_id)
            if not task:
                # Task doesn't exist in database - likely was deleted or never created
                # Log warning and skip processing (don't retry - it won't help)
                logger.warning(
                    f"Task {task_id} not found in database. Skipping processing. "
                    f"This may happen if the task was deleted or the database was reset. "
                    f"Agency ID: {agency_id}, Filename: {filename}, Retry: {current_retries}"
                )
                # Return early to prevent retries - task doesn't exist so processing is impossible
                return

            # Check if task is already completed or failed - skip if so
            if task.status in ["completed", "failed"]:
                logger.info(
                    f"Task {task_id} is already {task.status}. Skipping processing. "
                    f"Agency ID: {agency_id}, Filename: {filename}"
                )
                return

            task.status = "processing"
            task.retry_count = current_retries
            if not task.started_at:
                task.started_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(task)
            logger.info(f"Task {task_id} status updated to processing")

            # Retrieve EDI file from database (encrypted + base64 encoded)
            if not task.edi_file_data:
                raise Exception(
                    f"EDI file data not found in database for task {task_id}"
                )

            # Decrypt and decode EDI data
            try:
                from app.services.crypto import get_phi_encryption_service

                phi_crypto = get_phi_encryption_service()

                # Decrypt EDI file (handles both encrypted and unencrypted data)
                edi_base64 = phi_crypto.decrypt_edi_file(task.edi_file_data)
                edi_content = base64.b64decode(edi_base64)
                logger.info(
                    f"Decrypted and decoded EDI file from database for task {task_id}, size: {len(edi_content)} bytes"
                )
            except Exception as e:
                raise Exception(f"Failed to decrypt/decode EDI file data: {str(e)}")

            # Create temporary file for Playwright (it needs a file path)
            temp_file_handle = tempfile.NamedTemporaryFile(
                mode="wb", suffix=".edi", prefix=f"edi_{task_id}_", delete=False
            )
            edi_file_path = temp_file_handle.name
            temp_file_handle.write(edi_content)
            temp_file_handle.close()
            logger.info(f"Created temporary EDI file: {edi_file_path}")

            # Decrypt task params to get check_number and other data
            decrypted_params = None
            if task and task.params:
                from app.services.crypto import get_phi_encryption_service

                phi_crypto = get_phi_encryption_service()
                decrypted_params = phi_crypto.decrypt_task_params(task.params)
                logger.info(
                    f"Decrypted task params for task {task_id}. "
                    f"check_number: {decrypted_params.get('check_number')}"
                )

        finally:
            db.close()

        # Phase 2: Execute bot automation
        logger.info(f"Starting bot automation for task {task_id}")
        # check_number is in decrypted_params (encrypted in task.params), not in task_data
        check_number = (
            decrypted_params.get("check_number") if decrypted_params else None
        )
        logger.info(
            f"Using check_number from decrypted params: '{check_number}' for task {task_id}"
        )
        result = await PlaywrightBotService.process_edi_billing_file(
            agency_id=agency_id,
            agency_link=task_data["agency_link"],
            agency_username=task_data["agency_username"],
            agency_password=task_data["agency_password"],
            edi_file_path=edi_file_path,
            task_id=task_id,
            check_number=check_number,
        )

        # Phase 3: Validate result
        if result is None:
            error_message = "Bot automation returned None result"
            logger.error(f"Task {task_id}: Bot automation returned None result")
            raise Exception(error_message)

        if not isinstance(result, dict):
            error_message = f"Invalid result type: expected dict, got {type(result)}"
            logger.error(
                f"Task {task_id}: Invalid result type: expected dict, got {type(result)}"
            )
            raise Exception(error_message)

        if result.get("status") != "success":
            error_message = result.get("message", "Unknown error in bot automation")
            # Note: Not logging error message content to protect ePHI that might be in message
            logger.error(f"Task {task_id}: Bot automation failed")
            raise Exception(f"Bot automation failed: {error_message}")

        # Phase 4: Update task status to completed and sync validation results to edi_patients
        db = _create_fresh_session()
        try:
            task = BackgroundTaskService.get_task_by_id(db, task_id)
            if task and task.params:
                # Decrypt params to update edi_patients with validation results
                from app.services.crypto import get_phi_encryption_service

                phi_crypto = get_phi_encryption_service()
                decrypted_params = phi_crypto.decrypt_task_params(task.params)

                # Update edi_patients with final_claim_amount from validation results
                validation_results = result.get("validation_results", [])
                edi_patients = decrypted_params.get("edi_patients", [])

                if validation_results and edi_patients:
                    # Create a lookup map by patient number (exact match required)
                    validation_map = {}
                    for vr in validation_results:
                        patient_number = vr.get("patient_number")
                        if patient_number:
                            # Strip whitespace but keep exact match (no case conversion)
                            patient_number = str(patient_number).strip()
                            if patient_number:
                                validation_map[patient_number] = {
                                    "final_claim_amount": vr.get("final_claim_amount"),
                                    "is_valid": vr.get("is_valid"),
                                }

                    # Update edi_patients with final_claim_amount and is_valid from validation
                    updated_claim_count = 0
                    updated_valid_count = 0
                    for patient in edi_patients:
                        patient_number = patient.get("patient_number")
                        if patient_number:
                            # Strip whitespace but keep exact match (no case conversion)
                            patient_number = str(patient_number).strip()
                            if patient_number in validation_map:
                                validation_data = validation_map[patient_number]

                                # Update claim_amount
                                final_claim_amount = validation_data.get(
                                    "final_claim_amount"
                                )
                                if final_claim_amount is not None:
                                    patient["claim_amount"] = final_claim_amount
                                    updated_claim_count += 1

                                # Update is_valid
                                is_valid = validation_data.get("is_valid")
                                if is_valid is not None:
                                    patient["is_valid"] = is_valid
                                    updated_valid_count += 1

                    if updated_claim_count > 0 or updated_valid_count > 0:
                        logger.info(
                            f"Updated {updated_claim_count} patient(s) with claim_amount and {updated_valid_count} patient(s) with is_valid from validation"
                        )
                        # Re-encrypt and save updated params
                        encrypted_params = phi_crypto.encrypt_task_params(
                            decrypted_params
                        )
                        task.params = encrypted_params
                        db.commit()

            # Phase 5: Update Google Sheets if account is linked (optional, don't fail task if this fails)
            sheets_update_status = {
                "updated": False,
                "status": "not_attempted",
                "message": None,
                "details": None,
            }

            try:
                from app.services.google_sheets_service import GoogleSheetsService
                from app.services.google_account_service import GoogleAccountService
                from app.services.crypto import get_phi_encryption_service

                if GoogleAccountService.is_account_linked(db):
                    # Get decrypted params to access NPI and edi_patients
                    if task and task.params:
                        phi_crypto = get_phi_encryption_service()
                        decrypted_params = phi_crypto.decrypt_task_params(task.params)
                        npi = decrypted_params.get("npi")
                        edi_patients = decrypted_params.get("edi_patients", [])

                        if npi and edi_patients:
                            # Update patient paid amounts in Google Sheets
                            sheets_result = GoogleSheetsService.update_patient_paid_amounts_in_sheet(
                                db=db,
                                npi=npi,
                                patients=edi_patients,
                            )

                            if sheets_result.get("success"):
                                sheets_update_status = {
                                    "updated": True,
                                    "status": "success",
                                    "message": "Google Sheets updated successfully",
                                    "details": {
                                        "updated": sheets_result.get("updated", 0),
                                        "skipped": sheets_result.get("skipped", 0),
                                        "not_found": sheets_result.get("not_found", 0),
                                        "spreadsheet_id": sheets_result.get(
                                            "spreadsheet_id"
                                        ),
                                        "sheet_name": sheets_result.get("sheet_name"),
                                    },
                                }
                                logger.info(
                                    f"Updated Google Sheets for task {task_id}: "
                                    f"{sheets_result.get('updated')} updated, "
                                    f"{sheets_result.get('skipped')} skipped, "
                                    f"{sheets_result.get('not_found')} not found"
                                )
                            else:
                                sheets_update_status = {
                                    "updated": False,
                                    "status": "failed",
                                    "message": sheets_result.get(
                                        "message", "Unknown error"
                                    ),
                                    "details": {
                                        "updated": sheets_result.get("updated", 0),
                                        "skipped": sheets_result.get("skipped", 0),
                                        "not_found": sheets_result.get("not_found", 0),
                                    },
                                }
                                logger.warning(
                                    f"Failed to update Google Sheets for task {task_id}: {sheets_result.get('message')}"
                                )
                        else:
                            sheets_update_status = {
                                "updated": False,
                                "status": "skipped",
                                "message": "NPI or edi_patients not available",
                                "details": None,
                            }
                            logger.debug(
                                f"NPI or edi_patients not available for task {task_id}, skipping Sheets update"
                            )
                    else:
                        sheets_update_status = {
                            "updated": False,
                            "status": "skipped",
                            "message": "Task params not available",
                            "details": None,
                        }
                        logger.debug(
                            f"Task params not available for task {task_id}, skipping Sheets update"
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
                    f"Failed to update Google Sheets for task {task_id}: {str(sheets_error)}"
                )

            # Add Google Sheets update status to result data
            result["google_sheets_update"] = sheets_update_status

            # Phase 6: Update Admin Source of Truth spreadsheet (optional, don't fail task if this fails)
            admin_sheets_update_status = {
                "updated": False,
                "status": "not_attempted",
                "message": None,
                "details": None,
            }

            try:
                if GoogleAccountService.is_account_linked(db):
                    # Get decrypted params to access task data
                    if task and task.params:
                        phi_crypto = get_phi_encryption_service()
                        decrypted_params = phi_crypto.decrypt_task_params(task.params)

                        # Get task metadata
                        agency_name = None
                        ra_date = None
                        already_imported = result.get("already_imported", False)

                        # Try to get agency name from database
                        try:
                            from app.models.agency import Agency

                            agency = (
                                db.query(Agency).filter(Agency.id == agency_id).first()
                            )
                            if agency:
                                agency_name = agency.name
                        except Exception:
                            pass

                        # Get RA date from params or result
                        ra_date = decrypted_params.get("ra_date") or result.get(
                            "ra_date"
                        )

                        # Prepare task data for admin sheet
                        task_data_for_admin = {
                            "task_id": task_id,
                            "agency_name": agency_name or "Unknown",
                            "ra_date": ra_date,
                            "status": "completed",
                            "already_imported": already_imported,
                            "remarks": result.get("remarks") or "",
                        }

                        # Get patient data
                        edi_patients = decrypted_params.get("edi_patients", [])
                        validation_results = result.get("validation_results")

                        # Update admin source of truth
                        # Use current datetime since task.completed_at hasn't been set yet
                        # (it will be set later when update_task_status is called)
                        task_completed_at = datetime.now(timezone.utc)
                        admin_result = GoogleSheetsService.update_admin_source_of_truth(
                            db=db,
                            task_data=task_data_for_admin,
                            edi_patients=edi_patients,
                            validation_results=validation_results,
                            task_completed_at=task_completed_at,
                            google_sheets_update=result.get("google_sheets_update"),
                        )

                        if admin_result.get("success"):
                            admin_sheets_update_status = {
                                "updated": True,
                                "status": "success",
                                "message": "Admin source of truth updated successfully",
                                "details": {
                                    "rows_added": admin_result.get("rows_added", 0),
                                    "spreadsheet_id": admin_result.get(
                                        "spreadsheet_id"
                                    ),
                                    "sheet_name": admin_result.get("sheet_name"),
                                },
                            }
                            logger.info(
                                f"Updated admin source of truth for task {task_id}: "
                                f"{admin_result.get('rows_added')} row(s) added to sheet '{admin_result.get('sheet_name')}'"
                            )
                        else:
                            admin_sheets_update_status = {
                                "updated": False,
                                "status": "failed",
                                "message": admin_result.get("message", "Unknown error"),
                                "details": {
                                    "rows_added": admin_result.get("rows_added", 0),
                                },
                            }
                            logger.warning(
                                f"Failed to update admin source of truth for task {task_id}: {admin_result.get('message')}"
                            )
                    else:
                        admin_sheets_update_status = {
                            "updated": False,
                            "status": "skipped",
                            "message": "Task params not available",
                            "details": None,
                        }
                        logger.debug(
                            f"Task params not available for task {task_id}, skipping admin source of truth update"
                        )
                else:
                    admin_sheets_update_status = {
                        "updated": False,
                        "status": "skipped",
                        "message": "No Google account linked",
                        "details": None,
                    }
                    logger.debug(
                        "No Google account linked, skipping admin source of truth update"
                    )
            except Exception as admin_sheets_error:
                # Don't fail the task if admin sheets update fails
                admin_sheets_update_status = {
                    "updated": False,
                    "status": "error",
                    "message": f"Exception during admin sheets update: {str(admin_sheets_error)}",
                    "details": None,
                }
                logger.warning(
                    f"Failed to update admin source of truth for task {task_id}: {str(admin_sheets_error)}"
                )

            # Add admin sheets update status to result data
            result["admin_sheets_update"] = admin_sheets_update_status

            # Update task status with result data including Sheets update status
            BackgroundTaskService.update_task_status(
                db, task_id, "completed", result_data=result
            )
            logger.info(f"Task {task_id} completed successfully")
        finally:
            db.close()

        processing_time = time.time() - start_time
        logger.info(
            f"Successfully completed EDI processing for task {task_id} in {processing_time:.2f} seconds. Validated {result.get('patients_validated', 0)} patients."
        )

    except Exception as e:
        error_message = str(e)
        processing_time = time.time() - start_time

        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(
            f"Error processing EDI task {task_id}: (type: {type(e).__name__}, time: {processing_time:.2f}s)"
        )

        # Extract structured error data if available
        structured_error_data = None
        error_type = None

        # Debug: Log all available attributes on the exception
        logger.debug(
            f"Exception attributes for task {task_id}: {dir(e)}, hasattr error_data: {hasattr(e, 'error_data')}, hasattr error_type: {hasattr(e, 'error_type')}"
        )

        if isinstance(e, PlaywrightError):
            structured_error_data = getattr(e, "error_data", None)
            # PlaywrightError has error_type as both an attribute and in error_data
            # Try attribute first, then error_data dict
            error_type = getattr(e, "error_type", None)
            if not error_type and structured_error_data:
                error_type = structured_error_data.get("error_type")

            logger.info(
                f"Extracted error data from PlaywrightError for task {task_id}, error_type: {error_type}, error_data keys: {list(structured_error_data.keys()) if structured_error_data else None}, error_type attr: {getattr(e, 'error_type', 'NOT_FOUND')}"
            )
        elif hasattr(e, "error_data"):
            structured_error_data = e.error_data
            error_type = (
                structured_error_data.get("error_type")
                if structured_error_data
                else None
            )
            logger.info(
                f"Extracted error data from exception for task {task_id}, error_type: {error_type}"
            )
        elif hasattr(e, "error_type"):
            error_type = e.error_type
            logger.info(
                f"Extracted error_type from exception for task {task_id}, error_type: {error_type}"
            )

        # Check if this is a "missing_claim_info" error - these should not retry
        is_missing_claim_info = error_type == "missing_claim_info"
        logger.info(
            f"Task {task_id} error check: error_type={error_type}, is_missing_claim_info={is_missing_claim_info}, error_type type: {type(error_type)}"
        )

        # Store the raw error message and structured data in the task
        try:
            db = _create_fresh_session()
            try:
                task = BackgroundTaskService.get_task_by_id(db, task_id)
                if task:
                    # Store raw error message (not user-friendly)
                    task.error_message = error_message
                    if structured_error_data:
                        task.result_data = structured_error_data
                    else:
                        task.result_data = {}

                    # If this is a "missing_claim_info" error, mark as failed immediately and prevent retries
                    if is_missing_claim_info:
                        logger.info(
                            f"Task {task_id} - DETECTED missing_claim_info, marking as failed NOW"
                        )
                        task.status = "failed"
                        task.completed_at = datetime.now(timezone.utc)
                        # Get current retry count from Dramatiq context
                        try:
                            from dramatiq.middleware import CurrentMessage

                            msg = CurrentMessage.get_current_message()
                            if msg:
                                task.retry_count = msg.options.get("retries", 0)
                        except Exception:
                            pass
                        logger.info(
                            f"Task {task_id} marked as failed immediately (missing_claim_info - no retries)"
                        )

                    db.commit()
                    # Note: Not logging error message content to protect ePHI
                    logger.info(f"Stored error message in task {task_id}")

                    # Try to update admin source of truth for failed tasks (optional, don't fail if this fails)
                    try:
                        from app.services.google_sheets_service import (
                            GoogleSheetsService,
                        )
                        from app.services.google_account_service import (
                            GoogleAccountService,
                        )
                        from app.services.crypto import get_phi_encryption_service

                        if GoogleAccountService.is_account_linked(db) and task.params:
                            phi_crypto = get_phi_encryption_service()
                            decrypted_params = phi_crypto.decrypt_task_params(
                                task.params
                            )

                            # Get agency name
                            agency_name = None
                            try:
                                from app.models.agency import Agency

                                agency = (
                                    db.query(Agency)
                                    .filter(Agency.id == agency_id)
                                    .first()
                                )
                                if agency:
                                    agency_name = agency.name
                            except Exception:
                                pass

                            # Get RA date
                            ra_date = decrypted_params.get("ra_date")

                            # Check if already imported
                            already_imported = False
                            error_msg_lower = error_message.lower()
                            if (
                                "already imported" in error_msg_lower
                                or "already been imported" in error_msg_lower
                            ):
                                already_imported = True

                            # Prepare task data for admin sheet
                            task_data_for_admin = {
                                "task_id": task_id,
                                "agency_name": agency_name or "Unknown",
                                "ra_date": ra_date,
                                "status": "failed",
                                "error_message": error_message,
                                "already_imported": already_imported,
                                "remarks": (structured_error_data or {}).get("remarks") or "",
                            }

                            # Get patient data (might be empty for failed tasks)
                            edi_patients = decrypted_params.get("edi_patients", [])

                            # Update admin source of truth (will create row even if no patients)
                            admin_result = GoogleSheetsService.update_admin_source_of_truth(
                                db=db,
                                task_data=task_data_for_admin,
                                edi_patients=edi_patients,
                                validation_results=None,  # No validation results for failed tasks
                                task_completed_at=(
                                    task.completed_at
                                    if task.completed_at
                                    else datetime.now(timezone.utc)
                                ),
                                google_sheets_update=result.get("google_sheets_update"),
                            )

                            if admin_result.get("success"):
                                logger.info(
                                    f"Updated admin source of truth for failed task {task_id}: "
                                    f"{admin_result.get('rows_added')} row(s) added"
                                )
                            else:
                                logger.debug(
                                    f"Could not update admin source of truth for failed task {task_id}: {admin_result.get('message')}"
                                )
                    except Exception as admin_update_error:
                        # Don't fail the task update if admin sheet update fails
                        logger.debug(
                            f"Failed to update admin source of truth for failed task {task_id}: {str(admin_update_error)}"
                        )
            finally:
                db.close()
        except Exception as store_error:
            # Note: Only logging error type to protect ePHI
            logger.warning(
                f"Failed to store error message in task {task_id}: {type(store_error).__name__}"
            )

        # If this is a "missing_claim_info" error, prevent retries by not raising
        if is_missing_claim_info:
            logger.info(
                f"Task {task_id} failed with missing_claim_info - marked as failed, no retries needed"
            )
            # Don't raise the exception - this prevents Dramatiq from retrying
            # The task is already marked as failed in the database above
            return

        # Don't update task status to failed here - let the on_retry_exhausted callback handle it
        raise
    finally:
        # Clean up temporary file
        if edi_file_path and os.path.exists(edi_file_path):
            try:
                os.unlink(edi_file_path)
                logger.info(f"Cleaned up temporary EDI file: {edi_file_path}")
            except Exception as cleanup_error:
                logger.warning(
                    f"Failed to cleanup temporary EDI file {edi_file_path}: {str(cleanup_error)}"
                )
