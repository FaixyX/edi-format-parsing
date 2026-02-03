import { Backend } from "@/lib/helper";
import {
    SystemConfiguration,
    SystemConfigurationCreate,
    SystemConfigurationUpdate,
    SyncIntervalConfig,
    SyncStatus,
    SyncConfigurationBulkUpdate,
    SyncConfigurationBulkUpdateResponse,
} from "@/types/systemConfiguration";

export async function getAllConfigurations(): Promise<SystemConfiguration[]> {
    try {
        const { data } = await Backend.get("configurations", {
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error fetching system configurations:", error);
        throw error;
    }
}

export async function getConfiguration(
    key: string
): Promise<SystemConfiguration> {
    try {
        const { data } = await Backend.get(`configurations/${key}`, {
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error(`Error fetching configuration '${key}':`, error);
        throw error;
    }
}

export async function createConfiguration(
    config: SystemConfigurationCreate
): Promise<SystemConfiguration> {
    try {
        const { data } = await Backend.post("configurations", {
            body: config,
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error creating configuration:", error);
        throw error;
    }
}

export async function updateConfiguration(
    key: string,
    config: SystemConfigurationUpdate
): Promise<SystemConfiguration> {
    try {
        const { data } = await Backend.put(`configurations/${key}`, {
            body: config,
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error(`Error updating configuration '${key}':`, error);
        throw error;
    }
}

export async function deleteConfiguration(key: string): Promise<void> {
    try {
        await Backend.delete(`configurations/${key}`, {
            withCredentials: true,
            timeout: 30000,
        });
    } catch (error) {
        console.error(`Error deleting configuration '${key}':`, error);
        throw error;
    }
}

// Specialized sync configuration endpoints
export async function getSyncConfiguration(): Promise<SyncIntervalConfig> {
    try {
        const { data } = await Backend.get("sync-configuration", {
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error fetching sync configuration:", error);
        throw error;
    }
}

export async function updateSyncInterval(
    intervalMinutes: number
): Promise<SyncIntervalConfig> {
    try {
        const { data } = await Backend.put("sync-configuration", {
            body: { sync_interval_minutes: intervalMinutes },
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error updating sync interval:", error);
        throw error;
    }
}

export async function updateSyncEnabled(enabled: boolean): Promise<{
    sync_enabled: boolean;
    status: string;
    scheduler_updated: boolean;
}> {
    try {
        const { data } = await Backend.put("sync-configuration/enabled", {
            body: { enabled },
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error updating sync enabled status:", error);
        throw error;
    }
}

export async function updateMaxRetries(
    maxRetries: number
): Promise<{ max_sync_retries: number; updated: boolean }> {
    try {
        const { data } = await Backend.put("sync-configuration/max-retries", {
            body: { max_retries: maxRetries },
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error updating max retries:", error);
        throw error;
    }
}

export async function getSyncStatus(): Promise<SyncStatus> {
    try {
        const { data } = await Backend.get("sync-configuration/status", {
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error fetching sync status:", error);
        throw error;
    }
}

// EDI Billing Configuration API functions
export interface EdiBillingConfiguration {
    edi_billing_max_retries: number;
    edi_billing_delay_seconds: number;
}

export async function getEdiBillingConfiguration(): Promise<EdiBillingConfiguration> {
    try {
        const { data } = await Backend.get("edi-billing-configuration", {
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error fetching EDI billing configuration:", error);
        throw error;
    }
}

export async function updateEdiBillingMaxRetries(
    maxRetries: number
): Promise<{ edi_billing_max_retries: number; updated: boolean }> {
    try {
        const { data } = await Backend.put(
            "edi-billing-configuration/max-retries",
            {
                body: maxRetries,
                withCredentials: true,
                timeout: 30000,
            }
        );
        return data;
    } catch (error) {
        console.error("Error updating EDI billing max retries:", error);
        throw error;
    }
}

export async function updateEdiBillingDelay(
    delaySeconds: number
): Promise<{ edi_billing_delay_seconds: number; updated: boolean }> {
    try {
        const { data } = await Backend.put("edi-billing-configuration/delay", {
            body: delaySeconds,
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error updating EDI billing delay:", error);
        throw error;
    }
}

export async function bulkUpdateEdiBillingConfiguration(
    maxRetries?: number,
    delaySeconds?: number
): Promise<{
    edi_billing_max_retries: number;
    edi_billing_delay_seconds: number;
    updated_fields: string[];
    status: string;
}> {
    try {
        const { data } = await Backend.put("edi-billing-configuration/bulk", {
            body: {
                max_retries: maxRetries,
                delay_seconds: delaySeconds,
            },
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error bulk updating EDI billing configuration:", error);
        throw error;
    }
}

export async function bulkUpdateSyncConfiguration(
    bulkUpdate: SyncConfigurationBulkUpdate
): Promise<SyncConfigurationBulkUpdateResponse> {
    try {
        const { data } = await Backend.put("sync-configuration/bulk", {
            body: bulkUpdate,
            withCredentials: true,
            timeout: 30000,
        });
        return data;
    } catch (error) {
        console.error("Error bulk updating sync configuration:", error);
        throw error;
    }
}
