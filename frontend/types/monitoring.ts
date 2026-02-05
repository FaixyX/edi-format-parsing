export interface RetryTaskInfo {
    task_id: string;
    status: string;
    created_at: string;
}

export interface PatientValidationResult {
    patient_name: string;
    patient_number?: string | null; // Patient number from website table (for matching)
    final_claim_amount: number;
    final_payment_amount: number;
    is_valid: boolean;
    validation_message: string;
    error?: string;
}

export interface EDITaskInfo {
    filename: string;
    npi: string;
    provider_name?: string;
    transaction_type?: string;
    edi_file_path?: string;
}

export interface EDIPatientData {
    patient_number: string;
    claim_number: string;
    patient_name: string;
    mid?: string | null; // Member ID from EDI file (NM1*QC segment, field after MI*)
    // Filled during validation (portal), not available from the EDI file
    claim_amount?: number | null;
    paid_amount: number;
    adjustment_amount?: number | null; // Adjustment/reversal amount (from status 22 or negative amounts)
    is_valid?: boolean | null; // Validation status from website (True/False/None)
    service_period_start?: string; // YYYY-MM-DD format
    service_period_end?: string; // YYYY-MM-DD format
    claim_received_date?: string; // YYYY-MM-DD format
    // 277-specific fields (claim status response)
    extra?: {
        claim_id?: string; // Claim ID reference (e.g., "22535600585207CAR [01NS25337000V]")
        status?: string; // Claim status (e.g., "ACCEPTED 20251220 [A2/20/PR]")
        tob?: string; // Type of Bill (e.g., "TOB: 329")
        service_dates?: string; // Service date range (e.g., "20251005-20251028")
    };
}

export interface MonitoringEntryLight {
    task_id: string;
    pdf_filename: string;
    status: string;
    retry_count: number;
    max_retries: number;
    billing_file_uploaded_at: string;
    task_created_at: string;
    task_started_at?: string;
    task_completed_at?: string;
    error_message?: string;
    agency_id?: string;
    agency_name?: string;
    agency_npi?: string; // NEW: For display
    retry_tasks?: RetryTaskInfo[];
    best_retry_status?: string;
    // EDI-specific fields
    edi_info?: EDITaskInfo;
    validation_results?: PatientValidationResult[];
    patients_validated?: number;
    already_imported?: boolean; // True if EDI file was already imported
    ra_date?: string; // RA/Check date in YYYY-MM-DD format
    edi_patients?: EDIPatientData[]; // Patient data extracted from EDI file
    remarks?: string; // Remarks from "Remark To Adjustment" textarea
    // Review tracking fields
    is_checked?: boolean; // Whether this task has been reviewed/checked
    note?: string; // User note for this task
    checked_by?: string; // User who checked the task
    checked_at?: string; // When the task was checked
    note_by?: string; // User who added/updated the note
    note_at?: string; // When the note was added/updated
    google_sheets_update_status?: string; // "success", "failed", "error", "skipped", "not_attempted"
    google_sheets_update_details?: {
        updated?: number;
        skipped?: number;
        not_found?: number;
        total?: number;
    };
}

export interface MonitoringEntry {
    task_id: string;
    pdf_filename: string;
    status: string;
    retry_count: number;
    max_retries: number;
    billing_file_uploaded_at: string;
    task_created_at: string;
    task_started_at?: string;
    task_completed_at?: string;
    error_message?: string;
    result_data?: Record<string, any>;
    agency_id?: string;
    agency_name?: string;
    agency_npi?: string;
    // EDI-specific
    edi_info?: EDITaskInfo;
    validation_results?: PatientValidationResult[];
    patients_validated?: number;
    already_imported?: boolean; // True if EDI file was already imported
    ra_date?: string; // RA/Check date in YYYY-MM-DD format
    edi_patients?: EDIPatientData[]; // Patient data extracted from EDI file
}

export interface MonitoringEntryOption {
    value: string;
    label: string;
    status: string;
    retry_count: number;
    created_at: string;
}
