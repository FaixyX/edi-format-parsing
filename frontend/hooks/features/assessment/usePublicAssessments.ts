import { useQuery } from "@tanstack/react-query";
import { getPublicAssessments } from "@/services/publicApi";
import { formatAssessmentsForTable } from "@/utils/assessment";
import { AssessmentOption } from "@/types/assessment";

export function usePublicAssessments(
    episodeId: string | undefined,
    enabled: boolean = true
) {
    console.log(
        `[usePublicAssessments] Hook called with episodeId: ${episodeId}`
    );
    console.log(`[usePublicAssessments] EpisodeId is defined: ${!!episodeId}`);

    const {
        data: assessments = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["publicAssessments", episodeId],
        queryFn: () => {
            console.log(
                `[usePublicAssessments] Query function called for episodeId: ${episodeId}`
            );
            if (!episodeId) {
                console.log(
                    `[usePublicAssessments] No episodeId provided, returning empty array`
                );
                return Promise.resolve([]);
            }
            console.log(
                `[usePublicAssessments] Calling getPublicAssessments for episodeId: ${episodeId}`
            );
            return getPublicAssessments(episodeId);
        },
        enabled: !!episodeId && enabled,
        // Optimize for expensive Playwright operations
        staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
        refetchOnWindowFocus: false, // Don't refetch on focus
        refetchOnReconnect: false, // Don't refetch on reconnect
        refetchOnMount: false, // Don't refetch on mount if data exists
    });

    console.log(
        `[usePublicAssessments] Query state - isLoading: ${isLoading}, isError: ${isError}`
    );
    console.log(
        `[usePublicAssessments] Query state - data type: ${typeof assessments}, data length: ${
            Array.isArray(assessments) ? assessments.length : "not array"
        }`
    );

    if (isError) {
        console.error(`[usePublicAssessments] Query error:`, error);
        console.error(`[usePublicAssessments] Error type:`, typeof error);
        console.error(
            `[usePublicAssessments] Error name:`,
            error instanceof Error ? error.name : "unknown"
        );
        console.error(
            `[usePublicAssessments] Error message:`,
            error instanceof Error ? error.message : "unknown"
        );
    }

    // Ensure assessments is always an array
    const safeAssessments = Array.isArray(assessments) ? assessments : [];
    console.log(
        `[usePublicAssessments] Safe assessments length: ${safeAssessments.length}`
    );

    // Transform assessments for table
    const assessmentOptions: AssessmentOption[] =
        formatAssessmentsForTable(safeAssessments);
    console.log(
        `[usePublicAssessments] Assessment options length: ${assessmentOptions.length}`
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
