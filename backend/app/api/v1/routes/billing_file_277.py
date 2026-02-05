from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.agency_service import get_agency_decrypted_credentials
from app.services.crypto import get_phi_encryption_service
from app.utils.edi_277_extraction import (
    validate_277_file,
    fix_isa_line,
    preprocess_edi,
    parse_277_manual,
)

from typing import List
import logging
import base64
import os
import tempfile
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()

# Recommended batch size for 277 uploads (avoids timeouts and memory pressure).
# Clients should send multiple requests if they have more files.
MAX_277_FILES_PER_REQUEST = int(os.getenv("MAX_277_FILES_PER_REQUEST", "100"))


@router.post("/billing-files-277/upload")
async def upload_277_billing_files(
    files: List[UploadFile] = File(...), db: Session = Depends(get_db)
):
    """
    Upload multiple 277 EDI files.

    Mirrors the 873 upload flow:
    1. Validate EDI
    2. Extract NPI
    3. Match agency by NPI
    4. Encrypt/store file + params in BackgroundTask

    For 277, parsing is done immediately using the extraction logic.
    (No worker enqueue yet; tasks are stored as completed.)

    For large batches (e.g. 100+ files), send multiple requests with up to
    MAX_277_FILES_PER_REQUEST files each (default 50) to avoid timeouts.
    """
    if len(files) > MAX_277_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail={
                "error": f"Too many files. Maximum {MAX_277_FILES_PER_REQUEST} files per request.",
                "received": len(files),
                "max_per_request": MAX_277_FILES_PER_REQUEST,
                "suggestion": "Send multiple requests with smaller batches.",
            },
        )
    results = []
    successful_tasks = []

    # Import models here to avoid circular imports
    import app.models
    from app.models.background_task import BackgroundTask

    for file in files:
        try:
            content = await file.read()
            content_str = content.decode("utf-8")

            is_valid, validation_message = validate_277_file(content_str)
            if not is_valid:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": validation_message,
                    }
                )
                continue

            # Write to temp file(s) and run the extraction logic as-is
            with tempfile.TemporaryDirectory() as tmpdir:
                input_path = os.path.join(tmpdir, "input.edi")
                fixed_path = os.path.join(tmpdir, "fixed.edi")

                with open(input_path, "w", encoding="utf-8") as f:
                    f.write(content_str)

                # Keep extraction flow identical to extraction.py
                fix_isa_line(input_path, fixed_path)
                preprocess_edi(fixed_path, fixed_path)
                parsed_277 = parse_277_manual(fixed_path)

            npi = parsed_277.get("npi")
            header_date = parsed_277.get("header_date")
            patients = parsed_277.get("patients", []) or []

            if not npi:
                results.append(
                    {
                        "filename": file.filename,
                        "success": False,
                        "error": "Could not extract NPI from file",
                    }
                )
                continue

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

            # Base64 encode and encrypt EDI file before storage
            edi_base64 = base64.b64encode(content).decode("utf-8")
            if not edi_base64:
                raise HTTPException(
                    status_code=500,
                    detail="EDI file processing failed, please try again",
                )

            phi_crypto = get_phi_encryption_service()
            encrypted_edi = phi_crypto.encrypt_edi_file(edi_base64)

            # Map 277 patient output to the existing EDIPatientData-like shape
            edi_patients_data = []
            for p in patients:
                if not isinstance(p, dict):
                    continue
                edi_patients_data.append(
                    {
                        "patient_number": p.get("member_id") or "",
                        "claim_number": p.get("pt_claim") or "",
                        "patient_name": p.get("name") or "",
                        "mid": p.get("member_id"),
                        "claim_amount": _safe_float(p.get("amount")),
                        "paid_amount": 0.0,
                        "adjustment_amount": None,
                        "service_period_start": None,
                        "service_period_end": None,
                        "claim_received_date": None,
                        # Keep extra 277 fields nested (non-breaking)
                        "extra": {
                            "claim_id": p.get("claim_id"),
                            "status": p.get("status"),
                            "tob": p.get("tob"),
                            "service_dates": p.get("service_dates"),
                        },
                    }
                )

            encrypted_params = phi_crypto.encrypt_task_params(
                {
                    "filename": file.filename,
                    "npi": npi,
                    "provider_name": None,
                    "transaction_type": "277",
                    "file_format": "277",
                    # Reuse ra_date field for table display (header date)
                    "ra_date": header_date,
                    "bank_check": None,
                    "bank_account": None,
                    "check_number": None,
                    "edi_patients": edi_patients_data,
                }
            )

            # Get the configured max retries for EDI billing tasks
            from app.services.system_configuration_service import SystemConfigurationService
            
            configured_max_retries = (
                SystemConfigurationService.get_edi_billing_max_retries(db)
            )

            task_id = str(uuid.uuid4())
            bg_task = BackgroundTask(
                task_id=task_id,
                agency_id=agency.id,
                status="pending",  # Changed from "completed" to "pending" for worker processing
                edi_file_data=encrypted_edi,
                edi_filename=file.filename,
                max_retries=configured_max_retries,
                params=encrypted_params,
                result_data=None,
                error_message=None,
            )
            db.add(bg_task)
            db.commit()
            db.refresh(bg_task)

            logger.info(
                f"277 EDI file stored in database for task {bg_task.task_id}: {file.filename}"
            )

            # Queue 277 worker task
            from app.tasks.edi_277_billing_tasks import enqueue_277_billing_file_task

            task_data = {
                "task_id": bg_task.task_id,
                "npi": npi,
                "filename": file.filename,
                "header_date": header_date,
            }

            # Enqueue task for background processing
            enqueue_277_billing_file_task(task_data)
            logger.info(
                f"Queued 277 processing task {bg_task.task_id} for agency {agency.name}"
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
            logger.error(f"Error processing uploaded 277 file: {type(e).__name__}")
            results.append(
                {
                    "filename": file.filename,
                    "success": False,
                    "error": f"Internal error: {str(e)}",
                }
            )

    successful_count = sum(1 for r in results if r.get("success"))
    failed_count = len(results) - successful_count
    return {
        "total_files": len(results),
        "successful": successful_count,
        "failed": failed_count,
        "results": results,
        "task_ids": successful_tasks,
    }


def _safe_float(value):
    try:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        s = str(value).strip()
        if not s:
            return None
        return float(s)
    except Exception:
        return None

