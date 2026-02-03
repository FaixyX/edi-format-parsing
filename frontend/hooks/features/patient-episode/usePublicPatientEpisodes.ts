import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getPublicPatientEpisodes,
    syncPublicPatientEpisodes,
} from "@/services/publicApi";
import { formatPatientEpisodesForCombobox } from "@/utils/patientEpisode";
import { PatientEpisodeOption } from "@/types/patientEpisode";
import { toast } from "sonner";

export function usePublicPatientEpisodes(agencyId: string | undefined) {
    console.log(
        `[usePublicPatientEpisodes] Hook called with agencyId: ${agencyId}`
    );
    console.log(
        `[usePublicPatientEpisodes] AgencyId is defined: ${!!agencyId}`
    );

    const queryClient = useQueryClient();

    const {
        data: episodes = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["publicPatientEpisodes", agencyId],
        queryFn: () => {
            console.log(
                `[usePublicPatientEpisodes] Query function called for agencyId: ${agencyId}`
            );
            if (!agencyId) {
                console.log(
                    `[usePublicPatientEpisodes] No agencyId provided, returning empty array`
                );
                return Promise.resolve([]);
            }
            console.log(
                `[usePublicPatientEpisodes] Calling getPublicPatientEpisodes for agencyId: ${agencyId}`
            );
            return getPublicPatientEpisodes(agencyId);
        },
        enabled: !!agencyId,
        // Optimize for database queries
        staleTime: 2 * 60 * 1000, // 2 minutes - data stays fresh longer
        refetchOnWindowFocus: false, // Don't refetch on focus
        refetchOnReconnect: false, // Don't refetch on reconnect
        refetchOnMount: false, // Don't refetch on mount if data exists
    });

    console.log(
        `[usePublicPatientEpisodes] Query state - isLoading: ${isLoading}, isError: ${isError}`
    );
    console.log(
        `[usePublicPatientEpisodes] Query state - data type: ${typeof episodes}, data length: ${
            Array.isArray(episodes) ? episodes.length : "not array"
        }`
    );

    if (isError) {
        console.error(`[usePublicPatientEpisodes] Query error:`, error);
        console.error(`[usePublicPatientEpisodes] Error type:`, typeof error);
        console.error(
            `[usePublicPatientEpisodes] Error name:`,
            error instanceof Error ? error.name : "unknown"
        );
        console.error(
            `[usePublicPatientEpisodes] Error message:`,
            error instanceof Error ? error.message : "unknown"
        );
    }

    // Ensure episodes is always an array
    const safeEpisodes = Array.isArray(episodes) ? episodes : [];
    console.log(
        `[usePublicPatientEpisodes] Safe episodes length: ${safeEpisodes.length}`
    );

    // Transform episodes for combobox
    const episodeOptions: PatientEpisodeOption[] =
        formatPatientEpisodesForCombobox(safeEpisodes);
    console.log(
        `[usePublicPatientEpisodes] Episode options length: ${episodeOptions.length}`
    );

    // Mutation to sync episodes
    const syncMutation = useMutation({
        mutationFn: () =>
            agencyId
                ? syncPublicPatientEpisodes(agencyId)
                : Promise.resolve({
                      status: "error",
                      message: "No agency ID provided",
                      count: undefined,
                  }),
        onSuccess: (data) => {
            // Show success message with the count of synced episodes
            const message =
                data.count !== undefined
                    ? `Successfully synced ${data.count} patient episodes`
                    : data.message || "Patient episodes synced successfully";
            toast.success(message);
            // Immediately invalidate the episodes query to refresh the list
            queryClient.invalidateQueries({
                queryKey: ["publicPatientEpisodes", agencyId],
            });
        },
        onError: (error: Error) => {
            toast.error(`Failed to sync patient episodes: ${error.message}`);
        },
    });

    const handleSyncEpisodes = async (): Promise<boolean> => {
        if (agencyId) {
            try {
                await syncMutation.mutateAsync();
                return true;
            } catch (error) {
                return false;
            }
        } else {
            toast.error("No agency selected");
            return false;
        }
    };

    return {
        episodes: safeEpisodes,
        episodeOptions,
        isLoading,
        isError,
        error,
        refetch,
        syncEpisodes: handleSyncEpisodes,
        isSyncing: syncMutation.isPending,
    };
}
