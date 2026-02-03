"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

import { MonitoringTable } from "@/components/monitoring/MonitoringTable";
import { ViewMonitoringEntrySheet } from "@/components/monitoring/ViewMonitoringEntrySheet";
import { useAllMonitoringLight } from "@/hooks/features/monitoring/useMonitoring";
import {
    getAllMonitoringEntriesLight,
    retryMonitoringEntry,
    // updateTaskCheckedStatus, // TEMPORARILY DISABLED - used by checked feature
    // updateTaskNote, // TEMPORARILY DISABLED - used by note feature
    deleteMonitoringEntry,
    bulkDeleteMonitoringEntries,
} from "@/services/monitoringApi";
import { getAgencies } from "@/services/agencyApi";
import { MonitoringEntryLight } from "@/types/monitoring";
import { toast } from "sonner";

export default function MonitoringPage() {
    const [viewSheetOpen, setViewSheetOpen] = useState(false);
    const [entryToView, setEntryToView] = useState<MonitoringEntryLight | null>(
        null
    );
    const [retryDialogOpen, setRetryDialogOpen] = useState(false);
    const [entryToRetry, setEntryToRetry] =
        useState<MonitoringEntryLight | null>(null);
    const [shouldFetchAll, setShouldFetchAll] = useState(false);
    const [isManualRefresh, setIsManualRefresh] = useState(false);
    const queryClient = useQueryClient();

    // Fetch agencies for filter options
    const { data: agencies = [] } = useQuery({
        queryKey: ["agencies"],
        queryFn: getAgencies,
    });

    // Initial fetch: Get first 100 entries for fast initial render
    const {
        entries: initialEntries = [],
        isLoading: isLoadingInitial,
        error: initialError,
        refetch: refetchInitial,
    } = useAllMonitoringLight(0, 100, undefined, () => {
        setRetryDialogOpen(false);
        setEntryToRetry(null);
    });

    // Full fetch: Get all entries (no limit) - triggered after initial load
    const {
        data: allEntries = [],
        isLoading: isLoadingAll,
        error: allError,
        refetch: refetchAll,
    } = useQuery({
        queryKey: ["allMonitoringLight", 0, 999999, undefined],
        queryFn: () => getAllMonitoringEntriesLight(0, 999999, undefined),
        enabled: shouldFetchAll, // Only fetch when shouldFetchAll is true
        staleTime: 5 * 1000,
        refetchInterval: 15 * 1000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    });

    // Trigger full fetch after initial 100 entries are loaded
    useEffect(() => {
        if (!isLoadingInitial && initialEntries.length > 0 && !shouldFetchAll) {
            setShouldFetchAll(true);
        }
    }, [isLoadingInitial, shouldFetchAll, initialEntries.length]);

    // Reset manual refresh flag when initial load completes
    useEffect(() => {
        if (!isLoadingInitial && isManualRefresh) {
            setIsManualRefresh(false);
        }
    }, [isLoadingInitial, isManualRefresh]);

    // Use full dataset if available, otherwise use initial 100
    const entries = allEntries.length > 0 ? allEntries : initialEntries;
    const isLoading = isLoadingInitial || (shouldFetchAll && isLoadingAll);
    // Show error from full fetch if it's enabled, otherwise show initial error
    const error = shouldFetchAll ? allError || initialError : initialError;

    // Retry functionality
    const [isRetrying, setIsRetrying] = useState(false);
    const handleRetryEntry = async (taskId: string): Promise<boolean> => {
        try {
            setIsRetrying(true);
            const result = await retryMonitoringEntry(taskId);
            toast.success(
                `Task retry initiated successfully. New task ID: ${result.new_task_id.substring(
                    0,
                    8
                )}...`
            );

            // Invalidate and refetch both queries
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });

            // Refetch both queries
            await Promise.all([
                refetchInitial(),
                shouldFetchAll ? refetchAll() : Promise.resolve(),
            ]);

            setRetryDialogOpen(false);
            setEntryToRetry(null);
            return true;
        } catch (error: any) {
            toast.error(`Failed to retry monitoring entry: ${error.message}`);
            return false;
        } finally {
            setIsRetrying(false);
        }
    };

    const handleRefresh = async () => {
        setIsManualRefresh(true);
        const results = await Promise.all([
            refetchInitial(),
            shouldFetchAll ? refetchAll() : Promise.resolve(),
        ]);
        // Check if the first result (initial query) was successful
        // Note: isManualRefresh will be reset by useEffect when isLoadingInitial becomes false
        return results[0].status === "success";
    };

    const handleViewEntry = (entry: MonitoringEntryLight) => {
        setEntryToView(entry);
        setViewSheetOpen(true);
    };

    const handleCloseViewSheet = () => {
        setViewSheetOpen(false);
        // Delay clearing the entry data to allow the closing animation to complete
        setTimeout(() => {
            setEntryToView(null);
        }, 300);
    };

    const handleRetryFromSheet = async (taskId: string): Promise<boolean> => {
        return await handleRetryEntry(taskId);
    };

    // Delete functionality
    const [isDeleting, setIsDeleting] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const handleDeleteEntry = async (taskId: string): Promise<boolean> => {
        try {
            setIsDeleting(true);
            await deleteMonitoringEntry(taskId);
            toast.success("Monitoring entry deleted successfully");

            // Invalidate and refetch queries
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });

            await Promise.all([
                refetchInitial(),
                shouldFetchAll ? refetchAll() : Promise.resolve(),
            ]);

            return true;
        } catch (error: any) {
            toast.error(
                `Failed to delete monitoring entry: ${
                    error.message || "Unknown error"
                }`
            );
            return false;
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async (taskIds: string[]): Promise<boolean> => {
        try {
            setIsBulkDeleting(true);
            const result = await bulkDeleteMonitoringEntries(taskIds);
            toast.success(
                `Successfully deleted ${result.deleted_count} monitoring ${
                    result.deleted_count === 1 ? "entry" : "entries"
                }`
            );

            // Invalidate and refetch queries
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });

            await Promise.all([
                refetchInitial(),
                shouldFetchAll ? refetchAll() : Promise.resolve(),
            ]);

            return true;
        } catch (error: any) {
            toast.error(
                `Failed to delete monitoring entries: ${
                    error.message || "Unknown error"
                }`
            );
            return false;
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // TEMPORARILY DISABLED: Checked & Note features
    // Kept for easy re-enablement - these handlers are fully functional
    /* const [isSavingNote, setIsSavingNote] = useState(false);
    const handleToggleChecked = async (
        taskId: string,
        isChecked: boolean
    ): Promise<boolean> => {
        console.log(
            `[handleToggleChecked] Called with taskId: ${taskId}, isChecked: ${isChecked}`
        );

        // Optimistically update the UI immediately
        const updateEntries = (entries: MonitoringEntryLight[]) =>
            entries.map((entry) =>
                entry.task_id === taskId
                    ? { ...entry, is_checked: isChecked }
                    : entry
            );

        // Update both initial and all entries in query cache
        queryClient.setQueryData<MonitoringEntryLight[]>(
            ["allMonitoringLight", 0, 100, undefined],
            (old) => (old ? updateEntries(old) : old)
        );
        queryClient.setQueryData<MonitoringEntryLight[]>(
            ["allMonitoringLight", 0, 999999, undefined],
            (old) => (old ? updateEntries(old) : old)
        );

        try {
            // Make API call
            console.log(`[handleToggleChecked] Making API call...`);
            const data = await updateTaskCheckedStatus(taskId, isChecked);
            console.log(`[handleToggleChecked] API response:`, data);

            // Update with server response (includes checked_by and checked_at)
            const updateWithMetadata = (entries: MonitoringEntryLight[]) =>
                entries.map((entry) =>
                    entry.task_id === taskId
                        ? {
                              ...entry,
                              is_checked: isChecked,
                              checked_by: data.checked_by,
                              checked_at: data.checked_at,
                          }
                        : entry
                );

            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 100, undefined],
                (old) => (old ? updateWithMetadata(old) : old)
            );
            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 999999, undefined],
                (old) => (old ? updateWithMetadata(old) : old)
            );

            toast.success(
                isChecked ? "Task marked as checked" : "Task unchecked"
            );
            return true;
        } catch (error: any) {
            console.error(`[handleToggleChecked] Error:`, error);

            // Rollback on error
            const rollback = (entries: MonitoringEntryLight[]) =>
                entries.map((entry) =>
                    entry.task_id === taskId
                        ? { ...entry, is_checked: !isChecked }
                        : entry
                );

            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 100, undefined],
                (old) => (old ? rollback(old) : old)
            );
            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 999999, undefined],
                (old) => (old ? rollback(old) : old)
            );

            toast.error(
                `Failed to update task: ${error.message || "Unknown error"}`
            );
            return false;
        }
    };

    // Optimistic update for note
    const handleSaveNote = async (
        taskId: string,
        note: string
    ): Promise<boolean> => {
        setIsSavingNote(true);

        // Optimistically update the UI
        const updateEntries = (entries: MonitoringEntryLight[]) =>
            entries.map((entry) =>
                entry.task_id === taskId ? { ...entry, note } : entry
            );

        queryClient.setQueryData<MonitoringEntryLight[]>(
            ["allMonitoringLight", 0, 100, undefined],
            (old) => (old ? updateEntries(old) : old)
        );
        queryClient.setQueryData<MonitoringEntryLight[]>(
            ["allMonitoringLight", 0, 999999, undefined],
            (old) => (old ? updateEntries(old) : old)
        );

        try {
            // Make API call
            const data = await updateTaskNote(taskId, note);

            // Update with server response (includes note_by and note_at)
            const updateWithMetadata = (entries: MonitoringEntryLight[]) =>
                entries.map((entry) =>
                    entry.task_id === taskId
                        ? {
                              ...entry,
                              note: note || undefined,
                              note_by: data.note_by,
                              note_at: data.note_at,
                          }
                        : entry
                );

            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 100, undefined],
                (old) => (old ? updateWithMetadata(old) : old)
            );
            queryClient.setQueryData<MonitoringEntryLight[]>(
                ["allMonitoringLight", 0, 999999, undefined],
                (old) => (old ? updateWithMetadata(old) : old)
            );

            toast.success(note ? "Note saved successfully" : "Note removed");
            return true;
        } catch {
            toast.error("Failed to save note");
            return false;
        } finally {
            setIsSavingNote(false);
        }
    }; */

    return (
        <div className="space-y-6">
            <MonitoringTable
                entries={entries}
                isLoading={isLoading}
                error={error}
                onRetry={handleRefresh}
                onRefresh={handleRefresh}
                // Refresh indicator only shows during manual refresh, not initial load
                // Stops after initial 100 completes (fast UX)
                // Full fetch continues in background without showing refresh indicator
                isRefreshing={isManualRefresh && isLoadingInitial}
                agencies={agencies}
                onRetryEntry={handleRetryEntry}
                isRetrying={isRetrying}
                onViewEntry={handleViewEntry}
                retryDialogOpen={retryDialogOpen}
                setRetryDialogOpen={setRetryDialogOpen}
                entryToRetry={entryToRetry}
                setEntryToRetry={setEntryToRetry}
                // TEMPORARILY DISABLED: Checked & Note features (kept for future re-enablement)
                // onToggleChecked={handleToggleChecked}
                // onSaveNote={handleSaveNote}
                // isSavingNote={isSavingNote}
                onDeleteEntry={handleDeleteEntry}
                isDeleting={isDeleting}
                onBulkDelete={handleBulkDelete}
                isBulkDeleting={isBulkDeleting}
            />

            <ViewMonitoringEntrySheet
                isOpen={viewSheetOpen}
                onClose={handleCloseViewSheet}
                monitoringEntry={entryToView}
                onRetry={handleRetryFromSheet}
                isRetrying={isRetrying}
            />
        </div>
    );
}
