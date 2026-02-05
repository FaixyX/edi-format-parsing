from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


class RetryTaskInfo(BaseModel):
    """Information about retry task attempts"""

    task_id: str
    status: str
    created_at: datetime


class PatientValidationResult(BaseModel):
    """EDI patient validation result"""

    patient_name: str
    patient_number: Optional[str] = (
        None  # Patient number from website table (for matching)
    )
    final_claim_amount: float
    final_payment_amount: float
    is_valid: bool
    validation_message: str
    error: Optional[str] = None


class EDITaskInfo(BaseModel):
    """EDI task information"""

    filename: str
    npi: str
    provider_name: Optional[str] = None
    transaction_type: Optional[str] = None
    edi_file_path: Optional[str] = None


class EDIPatientData(BaseModel):
    """EDI patient data extracted from file"""

    patient_number: str
    claim_number: str
    patient_name: str
    mid: Optional[str] = (
        None  # Member ID from EDI file (NM1*QC segment, field after MI*)
    )
    # Final/expected claim amount is sourced during validation (portal), not EDI
    claim_amount: Optional[float] = None
    paid_amount: float
    adjustment_amount: Optional[float] = (
        None  # Adjustment/reversal amount (from status 22 or negative amounts)
    )
    is_valid: Optional[bool] = None  # Validation status from website (True/False/None)
    service_period_start: Optional[str] = None  # YYYY-MM-DD format
    service_period_end: Optional[str] = None  # YYYY-MM-DD format
    claim_received_date: Optional[str] = None  # YYYY-MM-DD format
    # 277-specific fields (claim status response)
    extra: Optional[dict] = None  # Contains: claim_id, status, tob, service_dates


class MonitoringEntryLight(BaseModel):
    """Lightweight monitoring entry for table display - excludes heavy fields"""

    # Task information (primary ID)
    task_id: str
    task_type: str  # "form_submission" or "edi_billing_file"

    # File information
    pdf_filename: str

    # Status (unified from both sources)
    status: str

    # Retry information
    retry_count: int
    max_retries: int

    # Timing information
    billing_file_uploaded_at: datetime  # when billing file was uploaded
    task_created_at: datetime  # when task was created
    task_started_at: Optional[datetime] = None  # when task started processing
    task_completed_at: Optional[datetime] = None  # when task completed

    # Error information - only basic error message for table
    error_message: Optional[str] = None

    # Agency information
    agency_id: Optional[str] = None
    agency_name: Optional[str] = None
    agency_npi: Optional[str] = None

    # Retry tasks information - all retry attempts for this task
    retry_tasks: Optional[List[RetryTaskInfo]] = None
    best_retry_status: Optional[str] = None  # Status of the most recent retry attempt

    # EDI-specific fields
    edi_info: Optional[EDITaskInfo] = None
    validation_results: Optional[List[PatientValidationResult]] = None
    patients_validated: Optional[int] = None
    already_imported: Optional[bool] = None  # True if EDI file was already imported
    ra_date: Optional[str] = None  # RA/Check date in YYYY-MM-DD format
    edi_patients: Optional[List[EDIPatientData]] = (
        None  # Patient data extracted from EDI file
    )
    remarks: Optional[str] = None
    # Review tracking fields
    is_checked: Optional[bool] = False
    note: Optional[str] = None
    checked_by: Optional[str] = None
    checked_at: Optional[datetime] = None
    note_by: Optional[str] = None
    note_at: Optional[datetime] = None

    # Google Sheets update status (lightweight - just the status)
    google_sheets_update_status: Optional[str] = None  # "success", "failed", "error", "skipped", "not_attempted"
    # Google Sheets update details (lightweight - for display in table)
    google_sheets_update_details: Optional[Dict[str, Any]] = None  # {"updated": int, "skipped": int, "not_found": int, "total": int}

    class Config:
        from_attributes = True


class MonitoringEntryOut(BaseModel):
    """Unified monitoring entry containing form submission and background task data"""

    # Task information (primary ID)
    task_id: str
    task_type: str  # "form_submission" or "edi_billing_file"

    # File information
    pdf_filename: str

    # Status (unified from both sources)
    status: str

    # Retry information
    retry_count: int
    max_retries: int

    # Timing information
    billing_file_uploaded_at: datetime  # when billing file was uploaded
    task_created_at: datetime  # when task was created
    task_started_at: Optional[datetime] = None  # when task started processing
    task_completed_at: Optional[datetime] = None  # when task completed

    # Error information
    error_message: Optional[str] = None

    # Additional data
    processing_result: Optional[Dict[str, Any]] = None
    result_data: Optional[Dict[str, Any]] = None

    # Agency information
    agency_id: Optional[str] = None
    agency_name: Optional[str] = None
    agency_npi: Optional[str] = None

    # EDI-specific fields
    edi_info: Optional[EDITaskInfo] = None
    validation_results: Optional[List[PatientValidationResult]] = None
    patients_validated: Optional[int] = None
    already_imported: Optional[bool] = None  # True if EDI file was already imported
    ra_date: Optional[str] = None  # RA/Check date in YYYY-MM-DD format
    edi_patients: Optional[List[EDIPatientData]] = (
        None  # Patient data extracted from EDI file
    )
    remarks: Optional[str] = None
    # Review tracking fields
    is_checked: Optional[bool] = False
    note: Optional[str] = None
    checked_by: Optional[str] = None
    checked_at: Optional[datetime] = None
    note_by: Optional[str] = None
    note_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateCheckedStatus(BaseModel):
    """Request schema for updating task checked status"""

    is_checked: bool


class UpdateCheckedStatusResponse(BaseModel):
    """Response schema for updating task checked status"""

    success: bool
    checked_by: Optional[str] = None
    checked_at: Optional[datetime] = None


class UpdateNote(BaseModel):
    """Request schema for updating task note"""

    note: str = Field(..., max_length=500, description="Note text (max 500 characters)")


class UpdateNoteResponse(BaseModel):
    """Response schema for updating task note"""

    success: bool
    note_by: Optional[str] = None
    note_at: Optional[datetime] = None


class BulkDeleteRequest(BaseModel):
    """Request schema for bulk deleting monitoring entries"""

    task_ids: List[str] = Field(..., description="List of task IDs to delete")


class BulkDeleteResponse(BaseModel):
    """Response schema for bulk deleting monitoring entries"""

    ok: bool
    deleted_count: int
    message: str
