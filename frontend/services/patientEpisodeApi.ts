import { Backend } from "@/lib/helper";
import { PatientEpisode } from "@/types/patientEpisode";

export async function getPatientEpisodes(
    agencyId: string
): Promise<PatientEpisode[]> {
    try {
        const { data } = await Backend.get(
            `agencies/${agencyId}/patient-episodes`,
            {
                withCredentials: true,
                timeout: 30000, // 30 seconds timeout for database queries
            }
        );

        return data;
    } catch (error) {
        console.error("Error fetching patient episodes:", error);
        throw error;
    }
}

export async function syncPatientEpisodes(
    agencyId: string
): Promise<{ status: string; message: string; count?: number }> {
    try {
        const { data } = await Backend.post(
            `agencies/${agencyId}/sync-patient-episodes`,
            {
                withCredentials: true,
                timeout: 300000, // 5 minutes timeout for sync operations
            }
        );

        return data;
    } catch (error) {
        console.error("Error syncing patient episodes:", error);
        throw error;
    }
}
