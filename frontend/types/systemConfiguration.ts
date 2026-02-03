export interface SystemConfiguration {
    id: string;
    key: string;
    value: string;
    description?: string;
    data_type: "string" | "integer" | "boolean" | "float";
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SystemConfigurationCreate {
    key: string;
    value: string;
    description?: string;
    data_type: "string" | "integer" | "boolean" | "float";
    is_active?: boolean;
}

export interface SystemConfigurationUpdate {
    value?: string;
    description?: string;
    is_active?: boolean;
}

export interface SyncIntervalConfig {
    sync_interval_minutes: number;
    description?: string;
    last_updated: string;
}

export interface SyncStatus {
    sync_interval_minutes: number;
    sync_enabled: boolean;
    max_sync_retries: number;
    status: "active" | "disabled";
}

export interface SyncConfigurationBulkUpdate {
    sync_interval_minutes?: number;
    sync_enabled?: boolean;
    max_retries?: number;
}

export interface SyncConfigurationBulkUpdateResponse {
    sync_interval_minutes: number;
    sync_enabled: boolean;
    max_retries: number;
    scheduler_updated: boolean;
    updated_fields: string[];
    status: string;
}
