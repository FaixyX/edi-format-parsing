"use client";

import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
    SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MonitoringEntryLight } from "@/types/monitoring";
import { useMonitoringEntryDetails } from "@/hooks/features/monitoring/useMonitoring";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/ui/data-table/copy-button";
import { CopyableText } from "@/components/ui/data-table/copyable-text";
import { Eye, Download } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useState, useEffect } from "react";
import {
    Hash,
    FileText,
    File,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    RefreshCw,
    Building2,
    Calendar,
    RotateCw,
    Info,
} from "lucide-react";
import { format } from "date-fns";
import { myFetch } from "@/lib/api";
import { SuccessMessage } from "./SuccessMessage";
import { FormFillingResults } from "./FormFillingResults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PatientDataList } from "./PatientDataCard";
import { GoogleSheetsUpdateCard } from "./GoogleSheetsUpdateCard";
interface InfoFieldProps {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    value: string;
    copyable?: boolean;
    copyText?: string;
    copyTooltip?: string;
    downloadable?: boolean;
    taskId?: string;
    filename?: string;
    downloadTooltip?: string;
    previewable?: boolean;
    previewTooltip?: string;
    className?: string;
    isEdiFile?: boolean;
}

const InfoField: React.FC<InfoFieldProps> = ({
    title,
    icon: Icon,
    value,
    copyable = false,
    copyText,
    copyTooltip,
    downloadable = false,
    taskId,
    filename,
    downloadTooltip,
    previewable = false,
    previewTooltip,
    className = "",
    isEdiFile = false,
}) => {
    const handlePreview = async () => {
        if (!taskId) return;

        try {
            const endpoint = isEdiFile
                ? `monitoring/${taskId}/edi/preview`
                : `monitoring/${taskId}/pdf/preview`;

            const response = await myFetch("GET", endpoint, {
                withCredentials: true,
            });

            if (!response.ok) {
                throw new Error(`Preview failed: ${response.statusText}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, "_blank");

            // Cleanup after a delay to allow the window to load
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
            console.error("Preview error:", error);
            const fileType = isEdiFile ? "EDI" : "PDF";
            alert(`Failed to preview ${fileType} file. Please try again.`);
        }
    };

    const handleDownload = async () => {
        if (!taskId || !filename) return;

        try {
            const endpoint = isEdiFile
                ? `monitoring/${taskId}/edi`
                : `monitoring/${taskId}/pdf`;

            const response = await myFetch("GET", endpoint, {
                withCredentials: true,
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
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
            const fileType = isEdiFile ? "EDI" : "PDF";
            alert(`Failed to download ${fileType} file. Please try again.`);
        }
    };

    return (
        <div className={className}>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <Icon className="h-4 w-4" />
                {title}
            </h4>
            <div className="bg-muted p-3 rounded-md">
                <div className="flex justify-between gap-1 items-center">
                    <span className="text-sm truncate">{value}</span>
                    <div className="flex gap-2">
                        {previewable && taskId && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handlePreview}
                                className="ring-0 h-4 w-4 p-0"
                                title={
                                    previewTooltip ||
                                    `Preview ${title.toLowerCase()}`
                                }
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                        )}
                        {downloadable && taskId && filename && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleDownload}
                                className="ring-0 h-4 w-4 p-0"
                                title={
                                    downloadTooltip ||
                                    `Download ${title.toLowerCase()}`
                                }
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                        )}
                        {copyable && copyText && (
                            <CopyButton
                                text={copyText}
                                tooltipText={
                                    copyTooltip || `Copy ${title.toLowerCase()}`
                                }
                                className="ring-0 h-4 w-4"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ViewMonitoringEntrySheetProps {
    isOpen: boolean;
    onClose: () => void;
    monitoringEntry: MonitoringEntryLight | null;
    onRetry?: (taskId: string) => Promise<boolean>;
    isRetrying?: boolean;
}

const getStatusBadge = (status: string, alreadyImported?: boolean) => {
    const statusLower = status.toLowerCase();
    let variant:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "secondary" = "pending";
    let Icon = AlertCircle;

    // If already imported, use secondary (grey) variant
    if (alreadyImported) {
        variant = "secondary";
        Icon = CheckCircle;
    } else {
        switch (statusLower) {
            case "completed":
                variant = "completed";
                Icon = CheckCircle;
                break;
            case "processing":
                variant = "processing";
                Icon = Clock;
                break;
            case "failed":
                variant = "failed";
                Icon = XCircle;
                break;
            default:
                variant = "pending";
                Icon = AlertCircle;
                break;
        }
    }

    // Display "Already Imported" if already imported, otherwise "Posted" for completed
    let displayStatus: string;
    if (alreadyImported) {
        displayStatus = "Already Imported";
    } else if (statusLower === "completed") {
        displayStatus = "Posted";
    } else {
        displayStatus = status;
    }

    return (
        <Badge variant={variant} className="flex items-center gap-1">
            <Icon className="h-4 w-4" />
            {displayStatus}
        </Badge>
    );
};

const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr + "Z");
    return format(date, "MMM dd, yyyy HH:mm:ss");
};

export function ViewMonitoringEntrySheet({
    isOpen,
    onClose,
    monitoringEntry,
    onRetry,
    isRetrying = false,
}: ViewMonitoringEntrySheetProps) {
    // Fetch detailed data when sheet opens
    const { entry: detailedEntry, isLoading: isLoadingDetails } =
        useMonitoringEntryDetails(monitoringEntry?.task_id || null);

    // Collapsible state for each section - must be called before any early returns
    const [basicInfoOpen, setBasicInfoOpen] = useState(true);
    const [resultInfoOpen, setResultInfoOpen] = useState(
        !!(detailedEntry?.result_data || monitoringEntry?.error_message)
    );
    const [ediPatientsOpen, setEdiPatientsOpen] = useState(false);

    // Ensure Validation Results section is expanded by default when shown
    // Also ensure it's open if there's result data or error message
    // This must be called before any early returns to maintain hook order
    useEffect(() => {
        if (!monitoringEntry) return;

        const displayEntry = detailedEntry || monitoringEntry;
        const isEDITask = !!displayEntry?.edi_info;
        const shouldShowValidationResults =
            isEDITask &&
            displayEntry?.status === "completed" &&
            (displayEntry?.already_imported ||
                (displayEntry?.validation_results &&
                    displayEntry.validation_results.length > 0));

        const shouldBeOpen =
            shouldShowValidationResults ||
            !!(detailedEntry?.result_data || displayEntry?.error_message);
        if (shouldBeOpen) {
            setResultInfoOpen(true);
        }
    }, [monitoringEntry, detailedEntry]);

    // Early return after all hooks have been called
    if (!monitoringEntry) {
        return null;
    }

    // Use detailed entry if available, otherwise fall back to lightweight entry
    const displayEntry = detailedEntry || monitoringEntry;

    // Determine if this is an EDI task (has edi_info)
    const isEDITask = !!displayEntry.edi_info;

    // For completed tasks, prioritize showing validation results over error messages
    // (error_message might be from a previous failed attempt)
    // Show error message if status is failed, processing, or pending and there's an error
    const shouldShowError =
        (displayEntry.status === "failed" ||
            displayEntry.status === "processing" ||
            displayEntry.status === "pending") &&
        displayEntry.error_message &&
        !(
            isEDITask &&
            displayEntry.validation_results &&
            displayEntry.validation_results.length > 0
        );

    const shouldShowValidationResults =
        isEDITask &&
        displayEntry.status === "completed" &&
        (displayEntry.already_imported ||
            (displayEntry.validation_results &&
                displayEntry.validation_results.length > 0));

    const handleRetry = async () => {
        if (onRetry) {
            const success = await onRetry(monitoringEntry.task_id);
            if (success) {
                onClose();
            }
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[900px] sm:w-[1000px] max-w-full">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SheetTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                {displayEntry.agency_name || "N/A"}
                            </SheetTitle>
                            {getStatusBadge(
                                displayEntry.status,
                                displayEntry.already_imported
                            )}
                        </div>
                    </div>
                </SheetHeader>

                {/* Loading state for detailed data */}
                {isLoadingDetails && (
                    <div className="mt-4 p-4 bg-muted rounded-md">
                        <div className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                            <span className="text-sm text-muted-foreground">
                                Loading detailed information...
                            </span>
                        </div>
                    </div>
                )}

                {/* Basic Information */}
                <div className="mt-4">
                    <CollapsibleSection
                        title="Basic Information"
                        isOpen={basicInfoOpen}
                        onOpenChange={setBasicInfoOpen}
                    >
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoField
                                    title="Task ID"
                                    icon={Hash}
                                    value={displayEntry.task_id}
                                    copyable={true}
                                    copyText={displayEntry.task_id}
                                    copyTooltip="Copy task ID"
                                />
                                <InfoField
                                    title={isEDITask ? "EDI File" : "PDF File"}
                                    icon={isEDITask ? File : FileText}
                                    value={
                                        isEDITask
                                            ? displayEntry.edi_info?.filename ||
                                              "N/A"
                                            : displayEntry.pdf_filename
                                    }
                                    previewable={true}
                                    taskId={displayEntry.task_id}
                                    previewTooltip={
                                        isEDITask
                                            ? "Preview EDI file"
                                            : "Preview PDF file"
                                    }
                                    downloadable={true}
                                    filename={
                                        isEDITask
                                            ? displayEntry.edi_info?.filename ||
                                              ""
                                            : displayEntry.pdf_filename
                                    }
                                    downloadTooltip={
                                        isEDITask
                                            ? "Download EDI file"
                                            : "Download PDF file"
                                    }
                                    isEdiFile={isEDITask}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InfoField
                                    title="Retry Count"
                                    icon={RefreshCw}
                                    value={`${displayEntry.retry_count} / ${displayEntry.max_retries}`}
                                />
                                {displayEntry.ra_date && (
                                    <InfoField
                                        title="RA Date"
                                        icon={Calendar}
                                        value={new Date(
                                            displayEntry.ra_date + "T00:00:00"
                                        ).toLocaleDateString()}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <InfoField
                                    title="Uploaded"
                                    icon={Calendar}
                                    value={formatDateTime(
                                        displayEntry.billing_file_uploaded_at
                                    )}
                                />
                                <InfoField
                                    title="Created"
                                    icon={Calendar}
                                    value={formatDateTime(
                                        displayEntry.task_created_at
                                    )}
                                />
                                <InfoField
                                    title="Started"
                                    icon={Clock}
                                    value={formatDateTime(
                                        displayEntry.task_started_at
                                    )}
                                />
                                <InfoField
                                    title="Completed"
                                    icon={CheckCircle}
                                    value={formatDateTime(
                                        displayEntry.task_completed_at
                                    )}
                                />
                            </div>
                        </div>
                    </CollapsibleSection>
                </div>

                {/* EDI Patient Data - Unified patient data and validation section */}
                {isEDITask &&
                    displayEntry.edi_patients &&
                    displayEntry.edi_patients.length > 0 && (
                        <>
                            <Separator className="my-6" />
                            <div className="mt-4">
                                <CollapsibleSection
                                    title="Patient Data & Validation"
                                    isOpen={ediPatientsOpen}
                                    onOpenChange={setEdiPatientsOpen}
                                >
                                    <PatientDataList
                                        patients={displayEntry.edi_patients}
                                        raDate={displayEntry.ra_date}
                                        showSummary={true}
                                    />
                                </CollapsibleSection>
                            </div>
                        </>
                    )}

                {/* Processing Results - Merged section for both success and error */}
                {(detailedEntry?.result_data ||
                    displayEntry.error_message ||
                    shouldShowValidationResults) && (
                    <>
                        <Separator className="my-6" />
                        <div className="mt-4">
                            <CollapsibleSection
                                title={
                                    shouldShowError
                                        ? "Error Information"
                                        : shouldShowValidationResults
                                        ? "Validation Results"
                                        : "Processing Results"
                                }
                                isOpen={resultInfoOpen}
                                onOpenChange={setResultInfoOpen}
                            >
                                <div className="space-y-4">
                                    {shouldShowError ? (
                                        /* Error case: Show error message and checkpoint progress */
                                        <>
                                            <Alert variant="destructive">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertTitle>
                                                    Error Message
                                                </AlertTitle>
                                                <AlertDescription>
                                                    {displayEntry.error_message}
                                                </AlertDescription>
                                            </Alert>
                                        </>
                                    ) : shouldShowValidationResults ? (
                                        /* EDI Validation Results - Just show the message and "already imported" info */
                                        <div className="space-y-4">
                                            {detailedEntry?.result_data
                                                ?.message && (
                                                <SuccessMessage
                                                    message={
                                                        detailedEntry!
                                                            .result_data!
                                                            .message
                                                    }
                                                />
                                            )}

                                            {/* Show "already imported" message if applicable */}
                                            {displayEntry.already_imported && (
                                                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                                                    <div className="flex items-start gap-2">
                                                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                                                        <div>
                                                            <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                                                File Already
                                                                Imported
                                                            </h5>
                                                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                                                This EDI file
                                                                has already been
                                                                imported to the
                                                                agency system.
                                                                No validation
                                                                was performed.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Note: Patient validation details are shown in the "Patient Data & Validation" section above */}
                                            {!displayEntry.already_imported && (
                                                <p className="text-sm text-muted-foreground">
                                                    {displayEntry.patients_validated ||
                                                        0}{" "}
                                                    patient(s) validated. See
                                                    &quot;Patient Data &amp;
                                                    Validation&quot; section
                                                    above for details.
                                                </p>
                                            )}

                                            {/* Google Sheets Update Status */}
                                            {detailedEntry?.result_data
                                                ?.google_sheets_update && (
                                                <GoogleSheetsUpdateCard
                                                    googleSheetsUpdate={
                                                        detailedEntry
                                                            .result_data
                                                            .google_sheets_update
                                                    }
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        /* Success case: Show structured success data (form submissions only) */
                                        detailedEntry?.result_data && (
                                            <div className="space-y-4">
                                                {/* Success Message */}
                                                {detailedEntry?.result_data
                                                    ?.message && (
                                                    <SuccessMessage
                                                        message={
                                                            detailedEntry!
                                                                .result_data!
                                                                .message
                                                        }
                                                    />
                                                )}

                                                {/* Form Filling Results */}
                                                {detailedEntry?.result_data
                                                    ?.form_filling_result && (
                                                    <FormFillingResults
                                                        formFillingResult={
                                                            detailedEntry!
                                                                .result_data!
                                                                .form_filling_result
                                                        }
                                                    />
                                                )}
                                            </div>
                                        )
                                    )}
                                </div>
                            </CollapsibleSection>
                        </div>
                    </>
                )}

                <SheetFooter className="mt-4 gap-2">
                    {onRetry && (
                        <Button
                            variant="default"
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <RotateCw
                                className={cn(
                                    "h-4 w-4",
                                    isRetrying && "animate-spin"
                                )}
                            />
                            {isRetrying ? "Retrying ..." : "Retry Task"}
                        </Button>
                    )}
                    <SheetClose asChild>
                        <Button variant="outline">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
