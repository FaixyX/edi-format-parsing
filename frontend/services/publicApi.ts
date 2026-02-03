import { Backend } from "@/lib/helper";
import { PatientEpisode } from "@/types/patientEpisode";
import { Assessment } from "@/types/assessment";

export async function getPublicPatientEpisodes(
    agencyId: string
): Promise<PatientEpisode[]> {
    const { data } = await Backend.get(
        `public/agencies/${agencyId}/patient-episodes`,
        {
            headers: {
                "Content-Type": "application/json",
            },
            // No withCredentials needed for public endpoints
        }
    );

    return data;
}

export async function syncPublicPatientEpisodes(
    agencyId: string
): Promise<{ status: string; message: string; count?: number }> {
    const { data } = await Backend.post(
        `public/agencies/${agencyId}/sync-patient-episodes`,
        {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: 300000, // 5 minutes timeout for sync operations
            // No withCredentials needed for public endpoints
        }
    );

    return data;
}

export async function getPublicAssessments(
    episodeId: string
): Promise<Assessment[]> {
    const { data } = await Backend.get(
        `public/patient-episodes/${episodeId}/assessments`,
        {
            headers: {
                "Content-Type": "application/json",
            },
            timeout: 600000, // 10 minutes timeout for expensive Playwright operations
            // No withCredentials needed for public endpoints
        }
    );

    return data;
}
