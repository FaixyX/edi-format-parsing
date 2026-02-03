from sqlalchemy.orm import Session
from app.models.background_task import BackgroundTask
from app.models.agency import Agency
from app.schemas.monitoring import (
    MonitoringEntryOut,
    MonitoringEntryLight,
)
from app.services.background_task_service import decrypt_result_data
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


def _get_phi_service():
    """Get PHI encryption service (lazy import to avoid circular imports)."""
    from app.services.crypto import get_phi_encryption_service

    return get_phi_encryption_service()


def _decrypt_task_params(params: dict) -> dict:
    """Decrypt sensitive fields in task params for display."""
    if not params:
        return params

    phi_crypto = _get_phi_service()
    return phi_crypto.decrypt_task_params(params)


class MonitoringService:
    """Service for monitoring EDI billing file processing tasks"""

    @staticmethod
    def get_all_monitoring_entries_light(
        db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None
    ) -> List[MonitoringEntryLight]:
        """Get all lightweight monitoring entries with optional filtering (table display)"""
        try:
            # Get all background tasks (EDI billing file tasks only)
            task_query = (
                db.query(
                    BackgroundTask.task_id,
                    BackgroundTask.status,
                    BackgroundTask.retry_count,
                    BackgroundTask.max_retries,
                    BackgroundTask.error_message,
                    BackgroundTask.created_at.label("task_created_at"),
                    BackgroundTask.started_at,
                    BackgroundTask.completed_at,
                    BackgroundTask.agency_id,
                    BackgroundTask.params,
                    BackgroundTask.result_data,
                    Agency.name.label("agency_name"),
                    Agency.npi.label("agency_npi"),
                    # Review tracking fields
                    BackgroundTask.is_checked,
                    BackgroundTask.note,
                    BackgroundTask.checked_by,
                    BackgroundTask.checked_at,
                    BackgroundTask.note_by,
                    BackgroundTask.note_at,
                )
                .join(Agency, BackgroundTask.agency_id == Agency.id)
                .order_by(BackgroundTask.created_at.desc())
            )

            # Apply status filter if provided
            if status:
                task_query = task_query.filter(BackgroundTask.status == status)

            task_results = task_query.offset(skip).limit(limit).all()

            monitoring_entries = []
            for row in task_results:
                # Decrypt sensitive fields in params (edi_patients contains PHI)
                params = _decrypt_task_params(row.params or {})

                # All tasks are EDI billing file tasks
                entry_dict = {
                    "task_id": row.task_id,
                    "task_type": "edi_billing_file",
                    "status": row.status,
                    "retry_count": row.retry_count,
                    "max_retries": row.max_retries,
                    "task_created_at": row.task_created_at,
                    "task_started_at": row.started_at,
                    "task_completed_at": row.completed_at,
                    "error_message": row.error_message,
                    "agency_id": str(row.agency_id),
                    "agency_name": row.agency_name,
                    "agency_npi": row.agency_npi,
                    "pdf_filename": params.get("filename", "N/A"),
                    "billing_file_uploaded_at": row.task_created_at,
                    # Review tracking fields
                    "is_checked": row.is_checked,
                    "note": row.note,
                    "checked_by": row.checked_by,
                    "checked_at": row.checked_at,
                    "note_by": row.note_by,
                    "note_at": row.note_at,
                }

                # Extract EDI info from params
                # Note: edi_file_path is no longer stored in params - file is stored in database
                entry_dict["edi_info"] = {
                    "filename": params.get("filename", ""),
                    "npi": params.get("npi", ""),
                    "provider_name": params.get("provider_name"),
                    "transaction_type": params.get("transaction_type"),
                }

                # Extract RA date and patient data from params (parsed from EDI file)
                entry_dict["ra_date"] = params.get("ra_date")

                # Extract EDI patient data
                edi_patients_raw = params.get("edi_patients", [])
                if edi_patients_raw and isinstance(edi_patients_raw, list):
                    from app.schemas.monitoring import EDIPatientData

                    edi_patients = []
                    for patient_data in edi_patients_raw:
                        if isinstance(patient_data, dict):
                            try:
                                edi_patients.append(EDIPatientData(**patient_data))
                            except Exception as e:
                                logger.warning(
                                    f"Error parsing EDI patient data: {str(e)}"
                                )
                    entry_dict["edi_patients"] = edi_patients if edi_patients else None
                else:
                    entry_dict["edi_patients"] = None

                # Extract validation results from result_data if task completed
                if row.result_data and isinstance(row.result_data, dict):
                    # Decrypt PHI in result_data (validation_results contains patient_name)
                    decrypted_result_data = decrypt_result_data(row.result_data)

                    # Check if file was already imported
                    entry_dict["already_imported"] = decrypted_result_data.get(
                        "already_imported", False
                    )

                    # Extract remarks
                    entry_dict["remarks"] = decrypted_result_data.get("remarks")

                    validation_results = decrypted_result_data.get(
                        "validation_results", []
                    )
                    # Ensure validation_results is a list (handle edge case where it might be a dict)
                    if isinstance(validation_results, dict):
                        # Convert single dict to list
                        validation_results = [validation_results]
                    elif not isinstance(validation_results, list):
                        # If it's not a list or dict, set to empty list
                        validation_results = []

                    # Ensure all validation results have proper types
                    normalized_results = []
                    for result in validation_results:
                        if isinstance(result, dict):
                            normalized_result = {
                                "patient_name": str(
                                    result.get("patient_name", "Unknown")
                                ),
                                "final_claim_amount": float(
                                    result.get("final_claim_amount", 0.0)
                                ),
                                "final_payment_amount": float(
                                    result.get("final_payment_amount", 0.0)
                                ),
                                "is_valid": bool(result.get("is_valid", False)),
                                "validation_message": str(
                                    result.get("validation_message", "")
                                ),
                            }
                            # Add error field if present
                            if "error" in result:
                                normalized_result["error"] = str(result.get("error"))
                            normalized_results.append(normalized_result)

                    entry_dict["validation_results"] = normalized_results
                    entry_dict["patients_validated"] = len(normalized_results)

                    # Extract Google Sheets update status and details (lightweight)
                    google_sheets_update = decrypted_result_data.get(
                        "google_sheets_update"
                    )
                    if google_sheets_update and isinstance(google_sheets_update, dict):
                        entry_dict["google_sheets_update_status"] = google_sheets_update.get(
                            "status"
                        )
                        # Extract details for display (updated, skipped, not_found, total)
                        details = google_sheets_update.get("details")
                        if details and isinstance(details, dict):
                            entry_dict["google_sheets_update_details"] = {
                                "updated": details.get("updated", 0),
                                "skipped": details.get("skipped", 0),
                                "not_found": details.get("not_found", 0),
                                "total": details.get("total") or (
                                    details.get("updated", 0) +
                                    details.get("skipped", 0) +
                                    details.get("not_found", 0)
                                ),
                            }
                        else:
                            entry_dict["google_sheets_update_details"] = None
                    else:
                        entry_dict["google_sheets_update_status"] = None
                        entry_dict["google_sheets_update_details"] = None
                else:
                    # No result_data, so no Google Sheets update status
                    entry_dict["google_sheets_update_status"] = None

                entry = MonitoringEntryLight(**entry_dict)
                monitoring_entries.append(entry)

            return monitoring_entries

        except Exception as e:
            logger.error(f"Error getting all lightweight monitoring entries: {e}")
            raise

    @staticmethod
    def get_monitoring_entry_details(
        db: Session, task_id: str
    ) -> Optional[MonitoringEntryOut]:
        """Get detailed monitoring entry for a specific task (for modal/detail view)"""
        try:
            # Get the background task
            task_result = (
                db.query(
                    BackgroundTask.task_id,
                    BackgroundTask.status,
                    BackgroundTask.retry_count,
                    BackgroundTask.max_retries,
                    BackgroundTask.error_message,
                    BackgroundTask.created_at.label("task_created_at"),
                    BackgroundTask.started_at,
                    BackgroundTask.completed_at,
                    BackgroundTask.agency_id,
                    BackgroundTask.params,
                    BackgroundTask.result_data,
                    Agency.name.label("agency_name"),
                    Agency.npi.label("agency_npi"),
                    # Review tracking fields
                    BackgroundTask.is_checked,
                    BackgroundTask.note,
                    BackgroundTask.checked_by,
                    BackgroundTask.checked_at,
                    BackgroundTask.note_by,
                    BackgroundTask.note_at,
                )
                .join(Agency, BackgroundTask.agency_id == Agency.id)
                .filter(BackgroundTask.task_id == task_id)
                .first()
            )

            if not task_result:
                return None

            # Decrypt sensitive fields in params (edi_patients contains PHI)
            params = _decrypt_task_params(task_result.params or {})

            # All tasks are EDI billing file tasks
            entry_dict = {
                "task_id": task_result.task_id,
                "task_type": "edi_billing_file",
                "status": task_result.status,
                "retry_count": task_result.retry_count,
                "max_retries": task_result.max_retries,
                "task_created_at": task_result.task_created_at,
                "task_started_at": task_result.started_at,
                "task_completed_at": task_result.completed_at,
                "error_message": task_result.error_message,
                "agency_id": str(task_result.agency_id),
                "agency_name": task_result.agency_name,
                "agency_npi": task_result.agency_npi,
                "pdf_filename": params.get("filename", "N/A"),
                "billing_file_uploaded_at": task_result.task_created_at,
                # Review tracking fields
                "is_checked": task_result.is_checked,
                "note": task_result.note,
                "checked_by": task_result.checked_by,
                "checked_at": task_result.checked_at,
                "note_by": task_result.note_by,
                "note_at": task_result.note_at,
            }

            # Extract EDI info from params
            # Note: edi_file_path is no longer stored in params - file is stored in database
            entry_dict["edi_info"] = {
                "filename": params.get("filename", ""),
                "npi": params.get("npi", ""),
                "provider_name": params.get("provider_name"),
                "transaction_type": params.get("transaction_type"),
            }

            # Extract RA date and patient data from params (parsed from EDI file)
            entry_dict["ra_date"] = params.get("ra_date")

            # Extract EDI patient data
            edi_patients_raw = params.get("edi_patients", [])
            if edi_patients_raw and isinstance(edi_patients_raw, list):
                from app.schemas.monitoring import EDIPatientData

                edi_patients = []
                for patient_data in edi_patients_raw:
                    if isinstance(patient_data, dict):
                        try:
                            edi_patients.append(EDIPatientData(**patient_data))
                        except Exception as e:
                            # Note: Only logging error type to protect potential ePHI
                            logger.warning(
                                f"Error parsing EDI patient data: {type(e).__name__}"
                            )
                entry_dict["edi_patients"] = edi_patients if edi_patients else None
            else:
                entry_dict["edi_patients"] = None

            # Extract validation results from result_data if task completed
            if task_result.result_data and isinstance(task_result.result_data, dict):
                # Decrypt PHI in result_data (validation_results contains patient_name)
                decrypted_result_data = decrypt_result_data(task_result.result_data)

                # Include the full decrypted result_data for error details
                entry_dict["result_data"] = decrypted_result_data

                # Check if file was already imported
                entry_dict["already_imported"] = decrypted_result_data.get(
                    "already_imported", False
                )

                # Extract remarks
                entry_dict["remarks"] = decrypted_result_data.get("remarks")

                validation_results = decrypted_result_data.get("validation_results", [])
                # Ensure validation_results is a list (handle edge case where it might be a dict)
                if isinstance(validation_results, dict):
                    # Convert single dict to list
                    validation_results = [validation_results]
                elif not isinstance(validation_results, list):
                    # If it's not a list or dict, set to empty list
                    validation_results = []

                # Ensure all validation results have proper types
                from app.schemas.monitoring import PatientValidationResult

                normalized_results = []
                for result in validation_results:
                    if isinstance(result, dict):
                        # Get patient_number - preserve None or convert to string
                        # This field is critical for matching, so ensure it's always included
                        patient_number_value = result.get("patient_number")
                        patient_number_normalized = None
                        if patient_number_value is not None:
                            # Convert to string and strip whitespace
                            patient_number_str = str(patient_number_value).strip()
                            # Only set if not empty after stripping
                            if patient_number_str:
                                patient_number_normalized = patient_number_str

                        # Create PatientValidationResult object to ensure schema compliance
                        normalized_result = PatientValidationResult(
                            patient_name=str(result.get("patient_name", "Unknown")),
                            patient_number=patient_number_normalized,  # Always include, even if None
                            final_claim_amount=float(
                                result.get("final_claim_amount", 0.0)
                            ),
                            final_payment_amount=float(
                                result.get("final_payment_amount", 0.0)
                            ),
                            is_valid=bool(result.get("is_valid", False)),
                            validation_message=str(
                                result.get("validation_message", "")
                            ),
                            error=(
                                str(result.get("error")) if "error" in result else None
                            ),
                        )
                        normalized_results.append(normalized_result)

                entry_dict["validation_results"] = normalized_results
                entry_dict["patients_validated"] = len(normalized_results)
            else:
                # Set result_data to None if not available
                entry_dict["result_data"] = None

            entry = MonitoringEntryOut(**entry_dict)
            return entry

        except Exception as e:
            logger.error(f"Error getting monitoring entry details: {e}")
            raise
