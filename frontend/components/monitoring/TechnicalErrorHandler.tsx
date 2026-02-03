"use client";

import { MonitoringEntry, MonitoringEntryLight } from "@/types/monitoring";
import { TechnicalErrorDialog } from "./TechnicalErrorDialog";
import { useState } from "react";
import { useMonitoringEntryDetails } from "@/hooks/features/monitoring/useMonitoring";

interface TechnicalErrorHandlerProps {
    monitoringEntry: MonitoringEntry | MonitoringEntryLight;
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export function TechnicalErrorHandler({
    monitoringEntry,
    children,
    className = "",
    title = "Hover: View error • Ctrl+Click: Show technical details",
}: TechnicalErrorHandlerProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Check if monitoringEntry has result_data (MonitoringEntry) or not (MonitoringEntryLight)
    const hasResultData = monitoringEntry && "result_data" in monitoringEntry && monitoringEntry.result_data !== undefined;

    // Fetch detailed data when dialog opens (only if we don't already have result_data)
    const { entry: detailedEntry, isLoading: isLoadingDetails } = useMonitoringEntryDetails(
        isDialogOpen && !hasResultData
            ? monitoringEntry.task_id
            : null
    );

    const handleErrorClick = (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            e.preventDefault();
            setIsDialogOpen(true);
        }
    };

    // Get technical details - prioritize error_data, then full result_data
    // Use existing data if available, otherwise use detailed entry
    const getTechnicalDetails = () => {
        // First, try to get from the passed monitoringEntry (if it's a MonitoringEntry with result_data)
        if (hasResultData && "result_data" in monitoringEntry && monitoringEntry.result_data) {
            const resultData = monitoringEntry.result_data as Record<string, any>;
            return resultData.error_data || resultData;
        }
        
        // If not available, try from the fetched detailedEntry
        if (detailedEntry?.result_data) {
            return detailedEntry.result_data.error_data || detailedEntry.result_data;
        }
        
        // If still not available, return null (will show message in dialog)
        return null;
    };

    const technicalDetails = getTechnicalDetails();

    return (
        <>
            <div
                onClick={handleErrorClick}
                className={`cursor-pointer transition-all duration-200 ${className}`}
                title={title}
            >
                {children}
            </div>

            <TechnicalErrorDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                technicalDetails={technicalDetails}
                isLoading={isDialogOpen && !hasResultData && isLoadingDetails}
            />
        </>
    );
}
