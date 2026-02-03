from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.agency_service import get_agency, get_agency_decrypted_credentials
from app.services.background_task_service import BackgroundTaskService
from app.utils.edi_parser import (
    parse_edi_file,
    validate_edi_file,
    parse_edi_file_complete,
)
from app.services.crypto import get_phi_encryption_service

from typing import List
import logging
import os
import base64

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/billing-files/upload")
async def upload_billing_files(
    files: List[UploadFile] = File(...), db: Session = Depends(get_db)
):
    """
    Upload multiple EDI billing files.

    Each file will be:
    1. Validated as a proper X12 EDI file
    2. NPI extracted from the file
    3. Matched to an agency by NPI
    4. Queued as a separate background task

    Returns summary of uploads with any errors.
    """
    results = []
    successful_tasks = []

    for file in files:
        try:
            # Read file content
            content = await file.read()
            content_str = content.decode("utf-8")

            # Validate file
            is_valid, validation_message = validate_edi_file(content_str)
            if not is_valid:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": validation_message,
                    }
                )
                continue

            # Parse EDI file to extract NPI and patient data
            parsed_data = parse_edi_file_complete(content_str)
            npi = parsed_data.get("npi")

            # Extract patient data for storage
            edi_patients = parsed_data.get("patients", [])
            ra_date = parsed_data.get("ra_date")
            bank_check = parsed_data.get("bank_check")
            bank_account = parsed_data.get("bank_account")
            check_number = parsed_data.get("check_number")

            if not npi:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": "Could not extract NPI from file",
                    }
                )
                continue

            # Find agency by NPI
            agencies = (
                db.query(app.models.Agency).filter(app.models.Agency.npi == npi).all()
            )

            if not agencies:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": f"No agency found with NPI: {npi}",
                        "npi": npi,
                    }
                )
                continue

            if len(agencies) > 1:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": f"Multiple agencies found with NPI: {npi}",
                        "npi": npi,
                    }
                )
                continue

            agency = agencies[0]

            # Encode EDI file content to base64 (similar to PDF storage)
            try:
                edi_base64 = base64.b64encode(content).decode("utf-8")
                logger.info(
                    f"EDI file base64 encoded successfully: {file.filename}, encoded size: {len(edi_base64)} characters"
                )
            except Exception as e:
                logger.error(
                    f"Failed to encode EDI to base64: {file.filename}, error: {str(e)}"
                )
                raise HTTPException(
                    status_code=500, detail="Failed to process EDI file"
                )

            # Validate that base64 data is not empty
            if not edi_base64 or len(edi_base64) == 0:
                # Do not log filenames (may contain patient identifiers)
                logger.error("EDI base64 data is empty for uploaded file")
                raise HTTPException(
                    status_code=500,
                    detail="EDI file processing failed, please try again",
                )

            # Encrypt EDI file for HIPAA compliance before storage
            phi_crypto = get_phi_encryption_service()
            encrypted_edi = phi_crypto.encrypt_edi_file(edi_base64)

            # Create background task with EDI file stored in database
            from app.models.background_task import BackgroundTask
            from app.services.system_configuration_service import (
                SystemConfigurationService,
            )
            import uuid

            # Get the configured max retries for EDI billing tasks
            configured_max_retries = (
                SystemConfigurationService.get_edi_billing_max_retries(db)
            )

            # Prepare patient data for storage (convert to dict format)
            edi_patients_data = []
            for patient in edi_patients:
                edi_patients_data.append(
                    {
                        "patient_number": patient.get("patient_number", ""),
                        "claim_number": patient.get("claim_number", ""),
                        "patient_name": patient.get("patient_name", ""),
                        "mid": patient.get("mid"),  # Member ID from EDI file
                        # Final claim/expected amount is captured later during validation
                        "claim_amount": patient.get("claim_amount"),
                        "paid_amount": patient.get("paid_amount", 0.0),
                        "adjustment_amount": patient.get("adjustment_amount"),
                        "service_period_start": patient.get("service_period_start"),
                        "service_period_end": patient.get("service_period_end"),
                        "claim_received_date": patient.get("claim_received_date"),
                    }
                )

            # Encrypt patient data in params for HIPAA compliance
            encrypted_params = phi_crypto.encrypt_task_params(
                {
                    "filename": file.filename,
                    "npi": npi,
                    "provider_name": parsed_data.get("provider_name"),
                    "transaction_type": parsed_data.get("transaction_type"),
                    "ra_date": ra_date,
                    "bank_check": bank_check,
                    "bank_account": bank_account,
                    "check_number": check_number,
                    "edi_patients": edi_patients_data,
                }
            )

            bg_task = BackgroundTask(
                task_id=str(uuid.uuid4()),
                agency_id=agency.id,
                status="pending",
                edi_file_data=encrypted_edi,  # Encrypted EDI file
                edi_filename=file.filename,
                max_retries=configured_max_retries,
                params=encrypted_params,  # Encrypted patient data
            )
            db.add(bg_task)
            db.commit()
            db.refresh(bg_task)

            logger.info(
                f"EDI file stored in database for task {bg_task.task_id}: {file.filename}"
            )

            # Queue Dramatiq task
            from app.tasks.edi_billing_tasks import enqueue_edi_billing_file_task

            # Get decrypted agency credentials for the worker
            decrypted_creds = get_agency_decrypted_credentials(agency)

            task_data = {
                "task_id": bg_task.task_id,
                "agency_id": str(agency.id),
                "agency_link": decrypted_creds["link"],
                "agency_username": decrypted_creds["username"],
                "agency_password": decrypted_creds["password"],
                "npi": npi,
                "filename": file.filename,
                "bank_check": bank_check,
                "bank_account": bank_account,
            }

            # Enqueue task with configurable delay and retries
            enqueue_edi_billing_file_task(task_data)
            logger.info(
                f"Queued EDI processing task {bg_task.task_id} for agency {agency.name}"
            )

            results.append(
                {
                    "filename": file.filename,
                    "success": True,
                    "task_id": bg_task.task_id,
                    "agency_name": agency.name,
                    "npi": npi,
                }
            )
            successful_tasks.append(bg_task.task_id)

        except Exception as e:
            # Note: Only logging error type to protect ePHI that might be in error message
            # Do not log filenames (may contain patient identifiers)
            logger.error(f"Error processing uploaded file: {type(e).__name__}")
            results.append(
                {
                    "filename": file.filename,
                    "success": False,
                    "error": f"Internal error: {str(e)}",
                }
            )

    # Summary
    successful_count = sum(1 for r in results if r.get("success"))
    failed_count = len(results) - successful_count

    return {
        "total_files": len(results),
        "successful": successful_count,
        "failed": failed_count,
        "results": results,
        "task_ids": successful_tasks,
    }


# Import models here to avoid circular imports
import app.models
