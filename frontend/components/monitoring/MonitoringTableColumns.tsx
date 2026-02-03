// Due to the large size of MonitoringTable.tsx, I'll create helper functions here
// These will be imported into the main component

import { ColumnDef } from "@tanstack/react-table";
import {
    MonitoringEntryLight,
    PatientValidationResult,
} from "@/types/monitoring";
import { myFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyableText } from "@/components/ui/data-table/copyable-text";
import {
    ArrowUpDown,
    FileText,
    File,
    CheckCircle,
    XCircle,
    FileDigit,
    Info,
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const createFileColumn = (): ColumnDef<MonitoringEntryLight> => ({
    accessorKey: "pdf_filename",
    header: ({ column }) => (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
        >
            File
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => {
        const entry = row.original;
        const taskId = entry.task_id;

        // EDI Task
        if (entry.edi_info) {
            const filename = entry.edi_info.filename;

            const handleEdiClick = async (e: React.MouseEvent) => {
                e.stopPropagation();

                if (e.ctrlKey || e.metaKey) {
                    // Ctrl+click for download
                    try {
                        const response = await myFetch(
                            "GET",
                            `monitoring/${taskId}/edi`,
                            {
                                withCredentials: true,
                            }
                        );

                        if (!response.ok) {
                            throw new Error(
                                `Download failed: ${response.statusText}`
                            );
                        }

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = filename;
                        a.style.display = "none";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                    } catch (error) {
                        console.error("Download error:", error);
                        alert("Failed to download EDI file. Please try again.");
                    }
                } else {
                    // Regular click for preview
                    try {
                        const response = await myFetch(
                            "GET",
                            `monitoring/${taskId}/edi/preview`,
                            {
                                withCredentials: true,
                            }
                        );

                        if (!response.ok) {
                            throw new Error(
                                `Preview failed: ${response.statusText}`
                            );
                        }

                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, "_blank");

                        // Cleanup after a delay to allow the window to load
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                    } catch (error) {
                        console.error("Preview error:", error);
                        alert("Failed to preview EDI file. Please try again.");
                    }
                }
            };

            return (
                <div className="flex items-center">
                    <File className="mr-2 h-4 w-4 text-blue-500" />
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <span
                                    className="truncate max-w-[100px] cursor-pointer hover:text-primary hover:underline"
                                    onClick={handleEdiClick}
                                    title={`${filename}\n\nClick: Preview\nCtrl+Click: Download`}
                                >
                                    {filename}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-center">
                                    <p className="font-medium">{filename}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Click: Preview • Ctrl+Click: Download
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            );
        }

        // Form Submission Task (PDF)
        const filename = entry.pdf_filename;
        const handlePdfClick = async (e: React.MouseEvent) => {
            e.stopPropagation();

            if (e.ctrlKey || e.metaKey) {
                // Ctrl+click for download
                try {
                    const response = await myFetch(
                        "GET",
                        `monitoring/${taskId}/pdf`,
                        {
                            withCredentials: true,
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Download failed: ${response.statusText}`
                        );
                    }

                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = filename;
                    a.style.display = "none";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                } catch (error) {
                    console.error("Download error:", error);
                    alert("Failed to download PDF file. Please try again.");
                }
            } else {
                // Regular click for preview
                try {
                    const response = await myFetch(
                        "GET",
                        `monitoring/${taskId}/pdf/preview`,
                        {
                            withCredentials: true,
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Preview failed: ${response.statusText}`
                        );
                    }

                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    window.open(blobUrl, "_blank");

                    // Cleanup after a delay to allow the window to load
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                } catch (error) {
                    console.error("Preview error:", error);
                    alert("Failed to preview PDF file. Please try again.");
                }
            }
        };

        return (
            <div className="flex items-center">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <TooltipProvider>
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            <span
                                className="truncate max-w-[100px] cursor-pointer hover:text-primary hover:underline"
                                onClick={handlePdfClick}
                                title={`${filename}\n\nClick: Preview\nCtrl+Click: Download`}
                            >
                                {filename}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-center">
                                <p className="font-medium">{filename}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Click: Preview • Ctrl+Click: Download
                                </p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    },
});

export const createNPIColumn = (): ColumnDef<MonitoringEntryLight> => ({
    id: "npi",
    accessorKey: "edi_info.npi",
    header: ({ column }) => (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="p-0 hover:bg-transparent"
        >
            NPI
            <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
    ),
    cell: ({ row }) => {
        const entry = row.original;

        if (entry.edi_info) {
            return (
                <div className="flex items-center">
                    <FileDigit className="mr-2 h-4 w-4 text-muted-foreground" />
                    <CopyableText
                        text={entry.edi_info.npi}
                        displayText={entry.edi_info.npi}
                        className="font-mono text-sm"
                    />
                </div>
            );
        }

        return <span className="text-xs text-muted-foreground">N/A</span>;
    },
});

export const createValidationColumn = (
    onViewValidation?: (
        results: PatientValidationResult[],
        entry: MonitoringEntryLight
    ) => void
): ColumnDef<MonitoringEntryLight> => ({
    id: "validation",
    header: "Validation",
    accessorFn: (row) => {
        // Return a value for faceting
        // Include already_imported tasks if they have validation_results
        if (
            !row.edi_info ||
            !row.validation_results ||
            row.status !== "completed"
        ) {
            return null;
        }
        const results = row.validation_results;
        if (!Array.isArray(results) || results.length === 0) {
            return null;
        }
        const invalidCount = results.filter((r) => !r.is_valid).length;
        return invalidCount === 0 ? "fully_successful" : "not_fully_successful";
    },
    cell: ({ row }) => {
        const entry = row.original;

        // Only show for EDI tasks
        if (!entry.edi_info) {
            return <span className="text-xs text-muted-foreground">N/A</span>;
        }

        // Check if file was already imported
        if (entry.already_imported) {
            // If validation was performed (validation_results exist), show actual validation status
            if (
                entry.validation_results &&
                Array.isArray(entry.validation_results) &&
                entry.validation_results.length > 0
            ) {
                const results = entry.validation_results;
                const validCount = results.filter((r) => r.is_valid).length;
                const invalidCount = results.length - validCount;

                const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onViewValidation) {
                        // Pass actual validation results for already imported files
                        onViewValidation(results, entry);
                    }
                };

                // Show actual validation status (green if all valid, red if any invalid)
                return (
                    <TooltipProvider>
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <div
                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                                    onClick={handleClick}
                                >
                                    <Badge
                                        variant={
                                            invalidCount === 0
                                                ? "completed"
                                                : "failed"
                                        }
                                        className="flex items-center gap-1"
                                    >
                                        {invalidCount === 0 ? (
                                            <CheckCircle className="h-3 w-3" />
                                        ) : (
                                            <XCircle className="h-3 w-3" />
                                        )}
                                        {validCount}/{results.length}
                                    </Badge>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {validCount} passed, {invalidCount}{" "}
                                        failed (already imported)
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        This file was already imported.
                                        Validation was performed to extract
                                        claim and paid amounts. Click to view
                                        details.
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }

            // Fallback: no validation results available (shouldn't happen, but handle gracefully)
            const totalCount =
                entry.edi_patients?.length || entry.patients_validated || 0;

            if (totalCount > 0) {
                const handleClick = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (onViewValidation) {
                        // No validation results, pass empty array
                        onViewValidation([], entry);
                    }
                };

                return (
                    <TooltipProvider>
                        <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                                <div
                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                                    onClick={handleClick}
                                >
                                    <Badge
                                        variant="secondary"
                                        className="flex items-center gap-1"
                                    >
                                        <Info className="h-3 w-3" />
                                        {totalCount} (imported)
                                    </Badge>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="space-y-1">
                                    <p className="font-medium">
                                        {totalCount} patients (already imported)
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        This file was already imported. No
                                        validation data available. Click to view
                                        details.
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }

            // Fallback if no count available
            return (
                <TooltipProvider>
                    <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                            <Badge
                                variant="secondary"
                                className="flex items-center gap-1"
                            >
                                <Info className="h-3 w-3" />
                                Already Imported
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="text-sm">
                                This EDI file has already been imported to the
                                agency system
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        // Task not completed yet
        if (entry.status !== "completed" || !entry.validation_results) {
            return <span className="text-xs text-muted-foreground">-</span>;
        }

        const results = entry.validation_results;
        // Ensure validation_results is an array
        if (!Array.isArray(results) || results.length === 0) {
            return <span className="text-xs text-muted-foreground">-</span>;
        }

        const validCount = results.filter((r) => r.is_valid).length;
        const invalidCount = results.length - validCount;

        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (onViewValidation) {
                onViewValidation(results, entry);
            }
        };

        return (
            <TooltipProvider>
                <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                        <div
                            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                            onClick={handleClick}
                        >
                            <Badge
                                variant={
                                    invalidCount === 0 ? "completed" : "failed"
                                }
                                className="flex items-center gap-1"
                            >
                                {invalidCount === 0 ? (
                                    <CheckCircle className="h-3 w-3" />
                                ) : (
                                    <XCircle className="h-3 w-3" />
                                )}
                                {validCount}/{results.length}
                            </Badge>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="space-y-1">
                            <p className="font-medium">
                                {validCount} passed, {invalidCount} failed
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Click to view details
                            </p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    },
    filterFn: (row, id, value) => {
        const entry = row.original;

        // Only filter EDI tasks with validation results
        // Include already_imported tasks if they have validation_results
        if (
            !entry.edi_info ||
            !entry.validation_results ||
            entry.status !== "completed"
        ) {
            // Exclude tasks without validation data from filter results
            return false;
        }

        // Ensure validation_results is an array and has items
        const results = entry.validation_results;
        if (!Array.isArray(results) || results.length === 0) {
            return false;
        }

        const invalidCount = results.filter((r) => !r.is_valid).length;
        const isFullySuccessful = invalidCount === 0;

        // Filter based on selected values (value is an array of selected filter values)
        const selectedValues = Array.isArray(value) ? value : [value];

        // Check if this entry matches any of the selected filter options
        // This works for both regular tasks and already_imported tasks with validation results
        if (selectedValues.includes("fully_successful") && isFullySuccessful) {
            return true;
        }
        if (
            selectedValues.includes("not_fully_successful") &&
            !isFullySuccessful
        ) {
            return true;
        }

        return false;
    },
});
