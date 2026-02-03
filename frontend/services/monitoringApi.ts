import { Backend } from "@/lib/helper";
import { MonitoringEntry, MonitoringEntryLight } from "@/types/monitoring";

export async function getMonitoringEntries(
    agencyId: string
): Promise<MonitoringEntry[]> {
    try {
        const { data } = await Backend.get(`agencies/${agencyId}/monitoring`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error fetching monitoring entries:", error);
        throw error;
    }
}

export async function getAllMonitoringEntries(
    skip: number = 0,
    limit: number = 100,
    status?: string
): Promise<MonitoringEntry[]> {
    try {
        const params = new URLSearchParams();
        if (skip > 0) params.append("skip", skip.toString());
        if (limit !== 100) params.append("limit", limit.toString());
        if (status) params.append("status", status);

        const { data } = await Backend.get(`monitoring?${params.toString()}`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error fetching all monitoring entries:", error);
        throw error;
    }
}

export async function getAllMonitoringEntriesLight(
    skip: number = 0,
    limit: number = 100,
    status?: string
): Promise<MonitoringEntryLight[]> {
    try {
        const params = new URLSearchParams();
        if (skip > 0) params.append("skip", skip.toString());
        if (limit !== 100) params.append("limit", limit.toString());
        if (status) params.append("status", status);

        const { data } = await Backend.get(
            `monitoring/light?${params.toString()}`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error(
            "Error fetching all lightweight monitoring entries:",
            error
        );
        throw error;
    }
}

export async function getMonitoringEntryDetails(
    taskId: string
): Promise<MonitoringEntry> {
    try {
        const { data } = await Backend.get(`monitoring/${taskId}/details`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error fetching monitoring entry details:", error);
        throw error;
    }
}

export async function retryMonitoringEntry(
    taskId: string
): Promise<{ ok: boolean; new_task_id: string }> {
    try {
        const { data } = await Backend.post(`monitoring/${taskId}/retry`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error retrying monitoring entry:", error);
        throw error;
    }
}

export async function deleteMonitoringEntry(
    taskId: string
): Promise<{ ok: boolean; message?: string }> {
    try {
        const { data } = await Backend.delete(`monitoring/${taskId}`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error deleting monitoring entry:", error);
        throw error;
    }
}

export async function bulkDeleteMonitoringEntries(
    taskIds: string[]
): Promise<{ ok: boolean; deleted_count: number; message: string }> {
    try {
        const { data } = await Backend.post(`monitoring/bulk-delete`, {
            body: { task_ids: taskIds },
            withCredentials: true,
            timeout: 60000, // Longer timeout for bulk operations
        });

        return data;
    } catch (error) {
        console.error("Error bulk deleting monitoring entries:", error);
        throw error;
    }
}

export async function updateTaskCheckedStatus(
    taskId: string,
    isChecked: boolean
): Promise<{ success: boolean; checked_by?: string; checked_at?: string }> {
    try {
        const { data } = await Backend.patch(
            `monitoring/${taskId}/check`,
            { is_checked: isChecked },
            {
                withCredentials: true,
                timeout: 10000,
            }
        );
        return data;
    } catch (error) {
        throw error;
    }
}

export async function updateTaskNote(
    taskId: string,
    note: string
): Promise<{ success: boolean; note_by?: string; note_at?: string }> {
    try {
        const { data } = await Backend.patch(
            `monitoring/${taskId}/note`,
            { note },
            {
                withCredentials: true,
                timeout: 10000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error updating task note:", error);
        throw error;
    }
}
