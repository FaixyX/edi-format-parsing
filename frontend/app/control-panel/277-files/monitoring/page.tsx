"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

import { MonitoringTable } from "@/components/monitoring/MonitoringTable";
import { ViewMonitoringEntrySheet } from "@/components/monitoring/ViewMonitoringEntrySheet";
import { useAllMonitoringLight } from "@/hooks/features/monitoring/useMonitoring";
import {
    getAllMonitoringEntriesLight,
    retryMonitoringEntry,
    deleteMonitoringEntry,
    bulkDeleteMonitoringEntries,
} from "@/services/monitoringApi";
import { getAgencies } from "@/services/agencyApi";
import { MonitoringEntryLight } from "@/types/monitoring";
import { toast } from "sonner";

export default function Format2MonitoringPage() {
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

    const { data: agencies = [] } = useQuery({
        queryKey: ["agencies"],
        queryFn: getAgencies,
    });

    const {
        entries: initialEntries = [],
        isLoading: isLoadingInitial,
        error: initialError,
        refetch: refetchInitial,
    } = useAllMonitoringLight(0, 100, undefined, () => {
        setRetryDialogOpen(false);
        setEntryToRetry(null);
    });

    const {
        data: allEntries = [],
        isLoading: isLoadingAll,
        error: allError,
        refetch: refetchAll,
    } = useQuery({
        queryKey: ["allMonitoringLight", 0, 999999, undefined],
        queryFn: () => getAllMonitoringEntriesLight(0, 999999, undefined),
        enabled: shouldFetchAll,
        staleTime: 5 * 1000,
        refetchInterval: 15 * 1000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    });

    useEffect(() => {
        if (!isLoadingInitial && initialEntries.length > 0 && !shouldFetchAll) {
            setShouldFetchAll(true);
        }
    }, [isLoadingInitial, shouldFetchAll, initialEntries.length]);

    useEffect(() => {
        if (!isLoadingInitial && isManualRefresh) {
            setIsManualRefresh(false);
        }
    }, [isLoadingInitial, isManualRefresh]);

    const allFetched = allEntries.length > 0 ? allEntries : initialEntries;
    // Show only 277 tasks on this page (filter by transaction_type from decrypted params)
    const entries = allFetched.filter(
        (e) => e.edi_info?.transaction_type === "277"
    );
    const isLoading = isLoadingInitial || (shouldFetchAll && isLoadingAll);
    const error = shouldFetchAll ? allError || initialError : initialError;

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
            queryClient.invalidateQueries({
                queryKey: ["allMonitoringLight"],
            });
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
        return results[0].status === "success";
    };

    const handleViewEntry = (entry: MonitoringEntryLight) => {
        setEntryToView(entry);
        setViewSheetOpen(true);
    };

    const handleCloseViewSheet = () => {
        setViewSheetOpen(false);
        setTimeout(() => setEntryToView(null), 300);
    };

    const handleRetryFromSheet = async (taskId: string): Promise<boolean> => {
        return await handleRetryEntry(taskId);
    };

    const [isDeleting, setIsDeleting] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const handleDeleteEntry = async (taskId: string): Promise<boolean> => {
        try {
            setIsDeleting(true);
            await deleteMonitoringEntry(taskId);
            toast.success("Monitoring entry deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["allMonitoringLight"] });
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
            queryClient.invalidateQueries({ queryKey: ["allMonitoringLight"] });
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

    return (
        <div className="space-y-6">
            <MonitoringTable
                entries={entries}
                isLoading={isLoading}
                error={error}
                onRetry={handleRefresh}
                onRefresh={handleRefresh}
                isRefreshing={isManualRefresh && isLoadingInitial}
                agencies={agencies}
                onRetryEntry={handleRetryEntry}
                isRetrying={isRetrying}
                onViewEntry={handleViewEntry}
                retryDialogOpen={retryDialogOpen}
                setRetryDialogOpen={setRetryDialogOpen}
                entryToRetry={entryToRetry}
                setEntryToRetry={setEntryToRetry}
                onDeleteEntry={handleDeleteEntry}
                isDeleting={isDeleting}
                onBulkDelete={handleBulkDelete}
                isBulkDeleting={isBulkDeleting}
                variant="277"
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
