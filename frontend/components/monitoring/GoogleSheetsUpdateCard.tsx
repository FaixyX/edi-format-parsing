"use client";

import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoogleSheetsUpdateDetails {
    updated?: number;
    skipped?: number;
    not_found?: number;
    total?: number;
    spreadsheet_id?: string;
    sheet_name?: string;
}

interface GoogleSheetsUpdate {
    status: "success" | "failed" | "error" | string;
    message: string;
    details?: GoogleSheetsUpdateDetails;
}

interface GoogleSheetsUpdateCardProps {
    googleSheetsUpdate: GoogleSheetsUpdate;
    className?: string;
}

export function GoogleSheetsUpdateCard({
    googleSheetsUpdate,
    className,
}: GoogleSheetsUpdateCardProps) {
    // Determine actual success status - check if all patients were found
    // Even if status is "success", if there are not_found patients, it should be considered failed
    const statusString = googleSheetsUpdate.status;
    const details = googleSheetsUpdate.details;
    
    let isSuccess = false;
    let isFailed = false;
    
    if (statusString === "failed" || statusString === "error") {
        isFailed = true;
    } else if (statusString === "success") {
        // Check details to see if all patients were successfully updated
        if (details && typeof details === "object") {
            const notFound = details.not_found || 0;
            const updated = details.updated || 0;
            const skipped = details.skipped || 0;
            const total = details.total || (updated + skipped + notFound);
            
            // If all patients were successfully updated or skipped, it's success
            // Otherwise, if any were not found, it's failed
            if (notFound > 0 || (updated + skipped) < total) {
                isFailed = true;
            } else {
                isSuccess = true;
            }
        } else {
            // No details available, assume success if status is "success"
            isSuccess = true;
        }
    }

    return (
        <div
            className={cn(
                "p-4 rounded-lg border",
                isSuccess
                    ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    : isFailed
                    ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                    : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
                className
            )}
        >
            <div className="flex items-start gap-2">
                <FileSpreadsheet
                    className={cn(
                        "h-5 w-5 mt-0.5 flex-shrink-0",
                        isSuccess
                            ? "text-green-600 dark:text-green-400"
                            : isFailed
                            ? "text-red-600 dark:text-red-400"
                            : "text-yellow-600 dark:text-yellow-400"
                    )}
                />
                <div className="flex-1 min-w-0">
                    <h5
                        className={cn(
                            "font-semibold mb-1",
                            isSuccess
                                ? "text-green-900 dark:text-green-100"
                                : isFailed
                                ? "text-red-900 dark:text-red-100"
                                : "text-yellow-900 dark:text-yellow-100"
                        )}
                    >
                        Google Sheets Update
                    </h5>
                    <p
                        className={cn(
                            "text-sm mb-2",
                            isSuccess
                                ? "text-green-800 dark:text-green-200"
                                : isFailed
                                ? "text-red-800 dark:text-red-200"
                                : "text-yellow-800 dark:text-yellow-200"
                        )}
                    >
                        {googleSheetsUpdate.message}
                    </p>
                    {googleSheetsUpdate.details && (
                        <div className="text-xs space-y-1 mt-2">
                            {googleSheetsUpdate.details.updated !==
                                undefined && (
                                <div>
                                    Updated:{" "}
                                    {googleSheetsUpdate.details.updated}{" "}
                                    patient(s)
                                </div>
                            )}
                            {googleSheetsUpdate.details.skipped !==
                                undefined &&
                                googleSheetsUpdate.details.skipped > 0 && (
                                <div>
                                    Skipped:{" "}
                                    {googleSheetsUpdate.details.skipped}{" "}
                                    patient(s)
                                </div>
                            )}
                            {googleSheetsUpdate.details.not_found !==
                                undefined &&
                                googleSheetsUpdate.details.not_found > 0 && (
                                <div>
                                    Not Found:{" "}
                                    {googleSheetsUpdate.details.not_found}{" "}
                                    patient(s)
                                </div>
                            )}
                            {googleSheetsUpdate.details.spreadsheet_id && (
                                <div className="text-muted-foreground">
                                    Spreadsheet ID:{" "}
                                    {googleSheetsUpdate.details.spreadsheet_id}
                                </div>
                            )}
                            {googleSheetsUpdate.details.sheet_name && (
                                <div className="text-muted-foreground">
                                    Sheet:{" "}
                                    {googleSheetsUpdate.details.sheet_name}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
