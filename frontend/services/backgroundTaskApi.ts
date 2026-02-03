import { Backend } from "@/lib/helper";
import { BackgroundTask } from "@/types/backgroundTask";

export async function getBackgroundTasks(
    agencyId: string
): Promise<BackgroundTask[]> {
    try {
        const { data } = await Backend.get(
            `agencies/${agencyId}/background-tasks`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching background tasks:", error);
        throw error;
    }
}

export async function getAllBackgroundTasks(
    skip: number = 0,
    limit: number = 100,
    status?: string
): Promise<BackgroundTask[]> {
    try {
        const params = new URLSearchParams();
        if (skip > 0) params.append("skip", skip.toString());
        if (limit !== 100) params.append("limit", limit.toString());
        if (status) params.append("status", status);

        const { data } = await Backend.get(
            `background-tasks?${params.toString()}`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching all background tasks:", error);
        throw error;
    }
}

export async function getBackgroundTask(
    taskId: string
): Promise<BackgroundTask> {
    try {
        const { data } = await Backend.get(`background-tasks/${taskId}`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error fetching background task:", error);
        throw error;
    }
}

export async function getTasksBySubmission(
    submissionId: string
): Promise<BackgroundTask[]> {
    try {
        const { data } = await Backend.get(
            `form-submissions/${submissionId}/background-tasks`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching tasks by submission:", error);
        throw error;
    }
}

export async function deleteBackgroundTask(
    taskId: string
): Promise<{ ok: boolean }> {
    try {
        const { data } = await Backend.delete(`background-tasks/${taskId}`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error deleting background task:", error);
        throw error;
    }
}
