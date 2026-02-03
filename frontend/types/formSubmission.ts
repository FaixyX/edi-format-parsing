export interface FormSubmission {
    id: string;
    agency_id: string;
    patient_episode_id: string;
    assessment_id?: string;
    new_assessment_data?: Record<string, any>;
    pdf_file_data: string;
    pdf_filename: string;
    task_id?: string;
    created_at: string;
    updated_at: string;
}

export interface FormSubmissionCreate {
    agency_id: string;
    patient_episode_id: string;
    assessment_id?: string;
    new_assessment_data?: Record<string, any>;
    pdf_file_data: string;
    pdf_filename: string;
}

export interface FormSubmissionUpdate {
    task_id?: string;
}

export interface FormSubmissionOption {
    value: string;
    label: string;
    created_at: string;
}
