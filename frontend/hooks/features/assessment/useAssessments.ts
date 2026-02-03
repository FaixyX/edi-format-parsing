import { useQuery } from "@tanstack/react-query";
import { getAssessments } from "@/services/assessmentApi";
import { formatAssessmentsForTable } from "@/utils/assessment";
import { AssessmentOption } from "@/types/assessment";

export function useAssessments(
    episodeId: string | undefined,
    enabled: boolean = true
) {
    console.log(`[useAssessments] Hook called with episodeId: ${episodeId}`);
    console.log(`[useAssessments] EpisodeId is defined: ${!!episodeId}`);

    const {
        data: assessments = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["assessments", episodeId],
        queryFn: () => {
            console.log(
                `[useAssessments] Query function called for episodeId: ${episodeId}`
            );
            if (!episodeId) {
                console.log(
                    `[useAssessments] No episodeId provided, returning empty array`
                );
                return Promise.resolve([]);
            }
            console.log(
                `[useAssessments] Calling getAssessments for episodeId: ${episodeId}`
            );
            return getAssessments(episodeId);
        },
        enabled: !!episodeId && enabled,
        // Optimize for expensive Playwright operations
        staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
        refetchOnWindowFocus: false, // Don't refetch on focus
        refetchOnReconnect: false, // Don't refetch on reconnect
        refetchOnMount: false, // Don't refetch on mount if data exists
    });

    console.log(
        `[useAssessments] Query state - isLoading: ${isLoading}, isError: ${isError}`
    );
    console.log(
        `[useAssessments] Query state - data type: ${typeof assessments}, data length: ${
            Array.isArray(assessments) ? assessments.length : "not array"
        }`
    );

    if (isError) {
        console.error(`[useAssessments] Query error:`, error);
        console.error(`[useAssessments] Error type:`, typeof error);
        console.error(
            `[useAssessments] Error name:`,
            error instanceof Error ? error.name : "unknown"
        );
        console.error(
            `[useAssessments] Error message:`,
            error instanceof Error ? error.message : "unknown"
        );
    }

    // Ensure assessments is always an array
    const safeAssessments = Array.isArray(assessments) ? assessments : [];
    console.log(
        `[useAssessments] Safe assessments length: ${safeAssessments.length}`
    );

    // Transform assessments for table
    const assessmentOptions: AssessmentOption[] =
        formatAssessmentsForTable(safeAssessments);
    console.log(
        `[useAssessments] Assessment options length: ${assessmentOptions.length}`
    );

    return {
        assessments: safeAssessments,
        assessmentOptions,
        isLoading,
        isError,
        error,
        refetch,
    };
}
