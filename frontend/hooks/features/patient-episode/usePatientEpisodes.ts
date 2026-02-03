import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getPatientEpisodes,
    syncPatientEpisodes,
} from "@/services/patientEpisodeApi";
import { formatPatientEpisodesForCombobox } from "@/utils/patientEpisode";
import { PatientEpisodeOption } from "@/types/patientEpisode";
import { toast } from "sonner";

export function usePatientEpisodes(agencyId: string | undefined) {
    const queryClient = useQueryClient();

    const {
        data: episodes = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["patientEpisodes", agencyId],
        queryFn: () =>
            agencyId ? getPatientEpisodes(agencyId) : Promise.resolve([]),
        enabled: !!agencyId,
    });

    // Transform episodes for combobox
    const episodeOptions: PatientEpisodeOption[] =
        formatPatientEpisodesForCombobox(episodes);

    // Mutation to sync episodes
    const syncMutation = useMutation({
        mutationFn: () =>
            agencyId
                ? syncPatientEpisodes(agencyId)
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
                queryKey: ["patientEpisodes", agencyId],
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
        episodes,
        episodeOptions,
        isLoading,
        isError,
        error,
        refetch,
        syncEpisodes: handleSyncEpisodes,
        isSyncing: syncMutation.isPending,
    };
}
