import { Backend } from "@/lib/helper";
import { Assessment } from "@/types/assessment";

export async function getAssessments(episodeId: string): Promise<Assessment[]> {
    const { data } = await Backend.get(
        `patient-episodes/${episodeId}/assessments`,
        {
            withCredentials: true,
            timeout: 600000, // 10 minutes timeout for expensive Playwright operations
        }
    );

    return data;
}
