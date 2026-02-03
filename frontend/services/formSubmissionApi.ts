import { Backend } from "@/lib/helper";
import { FormSubmission } from "@/types/formSubmission";

export async function getFormSubmissions(
    agencyId: string
): Promise<FormSubmission[]> {
    try {
        const { data } = await Backend.get(
            `agencies/${agencyId}/form-submissions`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching form submissions:", error);
        throw error;
    }
}

export async function getAllFormSubmissions(
    skip: number = 0,
    limit: number = 100,
    status?: string
): Promise<FormSubmission[]> {
    try {
        const params = new URLSearchParams();
        if (skip > 0) params.append("skip", skip.toString());
        if (limit !== 100) params.append("limit", limit.toString());
        if (status) params.append("status", status);

        const { data } = await Backend.get(
            `form-submissions?${params.toString()}`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching all form submissions:", error);
        throw error;
    }
}

export async function getFormSubmission(
    submissionId: string
): Promise<FormSubmission> {
    try {
        const { data } = await Backend.get(`form-submissions/${submissionId}`, {
            withCredentials: true,
            timeout: 30000,
        });

        return data;
    } catch (error) {
        console.error("Error fetching form submission:", error);
        throw error;
    }
}

export async function deleteFormSubmission(
    submissionId: string
): Promise<{ ok: boolean }> {
    try {
        const { data } = await Backend.delete(
            `form-submissions/${submissionId}`,
            {
                withCredentials: true,
                timeout: 30000,
            }
        );

        return data;
    } catch (error) {
        console.error("Error deleting form submission:", error);
        throw error;
    }
}
