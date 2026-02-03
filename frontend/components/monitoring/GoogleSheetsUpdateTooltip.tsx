"use client";

import { GoogleSheetsUpdateCard } from "./GoogleSheetsUpdateCard";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ReactNode } from "react";

interface GoogleSheetsUpdateDetails {
    updated?: number;
    skipped?: number;
    not_found?: number;
    spreadsheet_id?: string;
    sheet_name?: string;
}

interface GoogleSheetsUpdate {
    status: "success" | "failed" | "error" | string;
    message: string;
    details?: GoogleSheetsUpdateDetails;
}

interface GoogleSheetsUpdateTooltipProps {
    googleSheetsUpdate?: GoogleSheetsUpdate;
    isLoading?: boolean;
    children: ReactNode;
    delayDuration?: number;
    className?: string;
    onOpenChange?: (open: boolean) => void;
}

/**
 * Reusable tooltip component for Google Sheets update information.
 * Shows GoogleSheetsUpdateCard in a tooltip on hover.
 */
export function GoogleSheetsUpdateTooltip({
    googleSheetsUpdate,
    isLoading = false,
    children,
    delayDuration = 200,
    className,
    onOpenChange,
}: GoogleSheetsUpdateTooltipProps) {
    const buildTooltipContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center gap-2 p-4">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                    <span className="text-sm">Loading...</span>
                </div>
            );
        }

        if (googleSheetsUpdate) {
            return (
                <div className="max-w-md">
                    <GoogleSheetsUpdateCard
                        googleSheetsUpdate={googleSheetsUpdate}
                        className="border-0 shadow-none"
                    />
                </div>
            );
        }

        return (
            <div className="text-sm text-muted-foreground p-4">
                No Google Sheets update information available
            </div>
        );
    };

    return (
        <TooltipProvider>
            <Tooltip delayDuration={delayDuration} onOpenChange={onOpenChange}>
                <TooltipTrigger asChild className={className}>
                    {children}
                </TooltipTrigger>
                <TooltipContent className="max-w-md p-0">
                    {buildTooltipContent()}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
