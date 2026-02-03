export interface BackgroundTask {
    id: string;
    task_id: string;
    status: string;
    retry_count: number;
    max_retries: number;
    error_message?: string;
    result_data?: Record<string, any>;
    started_at?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface BackgroundTaskCreate {
    task_id: string;
    status: string;
    retry_count: number;
    max_retries: number;
}

export interface BackgroundTaskUpdate {
    status?: string;
    error_message?: string;
    result_data?: Record<string, any>;
    started_at?: string;
    completed_at?: string;
}

export interface BackgroundTaskOption {
    value: string;
    label: string;
    status: string;
    retry_count: number;
    created_at: string;
}
