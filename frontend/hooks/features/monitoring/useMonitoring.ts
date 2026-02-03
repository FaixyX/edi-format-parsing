import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
    getMonitoringEntries,
    getAllMonitoringEntries,
    getAllMonitoringEntriesLight,
    getMonitoringEntryDetails,
    deleteMonitoringEntry,
    retryMonitoringEntry,
} from "@/services/monitoringApi";
import { MonitoringEntry, MonitoringEntryLight } from "@/types/monitoring";
import { toast } from "sonner";

export function useMonitoring(agencyId: string | undefined) {
    const queryClient = useQueryClient();

    const {
        data: entries = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["monitoring", agencyId],
        queryFn: () =>
            agencyId ? getMonitoringEntries(agencyId) : Promise.resolve([]),
        enabled: !!agencyId,
        // Rapid refresh configuration for bot monitoring
        staleTime: 5 * 1000, // 5 seconds - data becomes stale quickly
        refetchInterval: 10 * 1000, // 10 seconds - auto-refresh every 10 seconds
        refetchOnWindowFocus: true, // Refetch when user returns to tab
        refetchOnMount: true, // Always refetch on component mount
    });

    // Mutation to delete entry
    const deleteMutation = useMutation({
        mutationFn: deleteMonitoringEntry,
        onSuccess: () => {
            toast.success("Monitoring entry deleted successfully");
            queryClient.invalidateQueries({
                queryKey: ["monitoring", agencyId],
            });
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete monitoring entry: ${error.message}`);
        },
    });

    // Mutation to retry entry
    const retryMutation = useMutation({
        mutationFn: retryMonitoringEntry,
        onSuccess: (data) => {
            toast.success(
                `Task retry initiated successfully. New task ID: ${data.new_task_id.substring(
                    0,
                    8
                )}...`
            );
            queryClient.invalidateQueries({
                queryKey: ["monitoring", agencyId],
            });
        },
        onError: (error: Error) => {
            toast.error(`Failed to retry monitoring entry: ${error.message}`);
        },
    });

    // Mutation to refresh entries
    const refreshMutation = useMutation({
        mutationFn: () =>
            agencyId ? getMonitoringEntries(agencyId) : Promise.resolve([]),
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: ["monitoring", agencyId],
            });
        },
        onError: (error: Error) => {
            // Error handling is done by the RefreshButton component
        },
    });

    const handleDeleteEntry = async (taskId: string): Promise<boolean> => {
        try {
            await deleteMutation.mutateAsync(taskId);
            return true;
        } catch (error) {
            return false;
        }
    };

    const handleRetryEntry = (taskId: string) => {
        retryMutation.mutate(taskId);
    };

    const handleRefreshEntries = async (): Promise<boolean> => {
        if (agencyId) {
            try {
                await refreshMutation.mutateAsync();
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
        entries,
        isLoading,
        isError,
        error,
        refetch,
        deleteEntry: handleDeleteEntry,
        isDeleting: deleteMutation.isPending,
        retryEntry: handleRetryEntry,
        isRetrying: retryMutation.isPending,
        refreshEntries: handleRefreshEntries,
        isRefreshing: refreshMutation.isPending,
    };
}


export function useAllMonitoringLight(
    skip: number = 0,
    limit: number = 100,
    status?: string,
    onRetrySuccess?: () => void
) {
    const queryClient = useQueryClient();

    const {
        data: entries = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["allMonitoringLight", skip, limit, status],
        queryFn: () => getAllMonitoringEntriesLight(skip, limit, status),
        // Rapid refresh configuration for bot monitoring
        staleTime: 5 * 1000, // 5 seconds - data becomes stale quickly
        refetchInterval: 15 * 1000, // 15 seconds - auto-refresh every 15 seconds
        refetchIntervalInBackground: true, // Keep polling even when tab is not active
        refetchOnWindowFocus: true, // Refetch when user returns to tab
        refetchOnMount: true, // Always refetch on component mount
    });

    // Mutation to delete entry
    const deleteMutation = useMutation({
        mutationFn: deleteMonitoringEntry,
        onSuccess: () => {
            toast.success("Monitoring entry deleted successfully");
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });
        },
        onError: (error: Error) => {
            toast.error(`Failed to delete monitoring entry: ${error.message}`);
        },
    });

    // Mutation to retry entry
    const retryMutation = useMutation({
        mutationFn: retryMonitoringEntry,
        onSuccess: (data) => {
            toast.success(
                `Task retry initiated successfully. New task ID: ${data.new_task_id.substring(
                    0,
                    8
                )}...`
            );
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });
            // Close dialog on success
            if (onRetrySuccess) {
                onRetrySuccess();
            }
        },
        onError: (error: Error) => {
            toast.error(`Failed to retry monitoring entry: ${error.message}`);
        },
    });

    const handleDeleteEntry = async (taskId: string): Promise<boolean> => {
        try {
            await deleteMutation.mutateAsync(taskId);
            return true;
        } catch (error) {
            return false;
        }
    };

    const handleRetryEntry = async (taskId: string): Promise<boolean> => {
        try {
            await retryMutation.mutateAsync(taskId);
            return true;
        } catch (error) {
            return false;
        }
    };

    return {
        entries,
        isLoading,
        isError,
        error,
        refetch,
        deleteEntry: handleDeleteEntry,
        isDeleting: deleteMutation.isPending,
        retryEntry: handleRetryEntry,
        isRetrying: retryMutation.isPending,
    };
}

export function useMonitoringEntryDetails(taskId: string | null) {
    const {
        data: entry,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ["monitoringEntryDetails", taskId],
        queryFn: () => getMonitoringEntryDetails(taskId!),
        enabled: !!taskId,
        staleTime: 30 * 1000, // 30 seconds - detailed data doesn't change as frequently
    });

    return {
        entry,
        isLoading,
        isError,
        error,
    };
}

export function useBackgroundPrefetch(entries: MonitoringEntryLight[]) {
    const queryClient = useQueryClient();

    // Prefetch detailed data for entries in the background with smart batching
    React.useEffect(() => {
        if (entries.length > 0) {
            // Only prefetch for the first 20 entries to avoid overwhelming the server
            // Users typically interact with recent entries first
            const entriesToPrefetch = entries.slice(0, 20);

            // Prefetch with staggered delays and batch processing
            const prefetchInBatches = async () => {
                const batchSize = 5; // Process 5 entries at a time

                for (let i = 0; i < entriesToPrefetch.length; i += batchSize) {
                    const batch = entriesToPrefetch.slice(i, i + batchSize);

                    // Process batch with individual delays
                    const batchPromises = batch.map((entry, batchIndex) => {
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                queryClient.prefetchQuery({
                                    queryKey: [
                                        "monitoringEntryDetails",
                                        entry.task_id,
                                    ],
                                    queryFn: () =>
                                        getMonitoringEntryDetails(
                                            entry.task_id
                                        ),
                                    staleTime: 30 * 1000, // 30 seconds
                                });
                                resolve(undefined);
                            }, batchIndex * 200); // 200ms delay between entries in batch
                        });
                    });

                    await Promise.all(batchPromises);

                    // Wait between batches to be gentle on the server
                    if (i + batchSize < entriesToPrefetch.length) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000)
                        ); // 1s between batches
                    }
                }
            };

            prefetchInBatches().catch((error) => {
                console.warn("Background prefetch failed:", error);
            });
        }
    }, [entries, queryClient]);
}
