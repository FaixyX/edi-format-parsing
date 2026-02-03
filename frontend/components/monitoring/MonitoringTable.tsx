/**
 * TEMPORARILY DISABLED FEATURES:
 * - Checked Column: Task review checkbox with metadata (checked_by, checked_at)
 * - Note Column: User notes for tasks (note, note_by, note_at)
 *
 * These features are hidden per client request but fully implemented in the backend.
 * To re-enable: Search for "TEMPORARILY DISABLED" comments in this file and uncomment the relevant blocks.
 * The imports for these features (AddNoteDialog, Checkbox, StickyNote, MessageSquare) are kept for easy restoration.
 */

import {
    MonitoringEntryLight,
    PatientValidationResult,
    EDIPatientData,
} from "@/types/monitoring";
import { Agency } from "@/types/agency";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { LoadingRow } from "@/components/ui/data-table/loading-row";
import { ErrorRow } from "@/components/ui/data-table/error-row";
import { EmptyRow } from "@/components/ui/data-table/empty-row";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { ColumnVisibility } from "@/components/ui/data-table/column-visibility";
import { DataTableFacetedFilter } from "@/components/ui/data-table/data-table-faceted-filter";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionMenu } from "@/components/ui/data-table/action-menu";
import {
    Search,
    Calendar,
    Hash,
    CheckCircle,
    Clock,
    XCircle,
    AlertCircle,
    RefreshCw,
    Building2,
    X,
    CalendarIcon,
    User,
    Download,
    FileSpreadsheet,
} from "lucide-react";
import { PatientValidationDialog } from "@/components/monitoring/PatientValidationDialog";
import {
    createFileColumn,
    createNPIColumn,
    // createValidationColumn, // TEMPORARILY DISABLED per client request
} from "@/components/monitoring/MonitoringTableColumns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as React from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    RowSelectionState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { loadTableVisibility } from "@/lib/utils";
import { Button } from "../ui/button";
import { RetryMonitoringEntryDialog } from "@/components/monitoring/RetryMonitoringEntryDialog";
import { exportMonitoringToExcel } from "@/lib/exportMonitoringToExcel";
import { toast } from "sonner";
// import { AddNoteDialog } from "@/components/monitoring/AddNoteDialog"; // Used by disabled note feature
import { Checkbox } from "@/components/ui/checkbox"; // Used for row selection
import { Trash2, MoreVertical } from "lucide-react"; // StickyNote & MessageSquare commented out (used by disabled note feature)
import { DeleteMonitoringEntryDialog } from "@/components/monitoring/DeleteMonitoringEntryDialog";
import { BulkDeleteMonitoringEntriesDialog } from "@/components/monitoring/BulkDeleteMonitoringEntriesDialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoogleSheetsUpdateCard } from "@/components/monitoring/GoogleSheetsUpdateCard";
import { GoogleSheetsUpdateTooltip } from "@/components/monitoring/GoogleSheetsUpdateTooltip";
import { useMonitoringEntryDetails } from "@/hooks/features/monitoring/useMonitoring";

interface MonitoringTableProps {
    entries: MonitoringEntryLight[];
    isLoading: boolean;
    error: Error | null;
    onRetry: () => void;
    onRefresh: () => Promise<boolean>;
    isRefreshing: boolean;
    agencies: Agency[];
    onRetryEntry?: (taskId: string) => Promise<boolean>;
    isRetrying?: boolean;
    onViewEntry?: (entry: MonitoringEntryLight) => void;
    retryDialogOpen?: boolean;
    setRetryDialogOpen?: (open: boolean) => void;
    entryToRetry?: MonitoringEntryLight | null;
    setEntryToRetry?: (entry: MonitoringEntryLight | null) => void;
    // TEMPORARILY DISABLED PROPS - kept for easy re-enablement
    // onToggleChecked?: (taskId: string, isChecked: boolean) => Promise<boolean>;
    // onSaveNote?: (taskId: string, note: string) => Promise<boolean>;
    // isSavingNote?: boolean;
    onDeleteEntry?: (taskId: string) => Promise<boolean>;
    isDeleting?: boolean;
    onBulkDelete?: (taskIds: string[]) => Promise<boolean>;
    isBulkDeleting?: boolean;
    /** When "277", hides Total Amounts, Status, RA Date, Remarks, Retries columns and Status filter */
    variant?: "837" | "277";
}

// Sheets cell component that can use hooks
function SheetsCell({ entry }: { entry: MonitoringEntryLight }) {
    const sheetsStatus = entry.google_sheets_update_status;
    let sheetsDetails = entry.google_sheets_update_details;

    // If we have status but no details, fetch detailed entry to get details
    const shouldFetchDetails = !!(
        entry.status === "completed" &&
        sheetsStatus &&
        !sheetsDetails
    );
    const { entry: detailedEntry, isLoading: isLoadingDetails } =
        useMonitoringEntryDetails(shouldFetchDetails ? entry.task_id : null);

    // Get full Google Sheets update from detailed entry (for tooltip content)
    // Also fetch on hover for tooltip if not already fetched
    // NOTE: These hooks must be called before any early returns
    const [shouldFetchForTooltip, setShouldFetchForTooltip] =
        React.useState(false);
    const { entry: detailedEntryForTooltip, isLoading: isLoadingTooltip } =
        useMonitoringEntryDetails(
            shouldFetchForTooltip && !detailedEntry ? entry.task_id : null
        );

    // Try to get details from detailed entry if not in lightweight
    if (!sheetsDetails && detailedEntry?.result_data?.google_sheets_update) {
        const googleSheetsUpdate =
            detailedEntry.result_data.google_sheets_update;
        if (
            googleSheetsUpdate.details &&
            typeof googleSheetsUpdate.details === "object"
        ) {
            sheetsDetails = {
                updated: googleSheetsUpdate.details.updated || 0,
                skipped: googleSheetsUpdate.details.skipped || 0,
                not_found: googleSheetsUpdate.details.not_found || 0,
                total:
                    googleSheetsUpdate.details.total ||
                    (googleSheetsUpdate.details.updated || 0) +
                        (googleSheetsUpdate.details.skipped || 0) +
                        (googleSheetsUpdate.details.not_found || 0),
            };
        }
    }

    // Only show for completed tasks with Google Sheets update data
    if (entry.status !== "completed" || !sheetsStatus) {
        return <span className="text-sm text-muted-foreground">-</span>;
    }

    // Still loading details
    if (!sheetsDetails && isLoadingDetails) {
        return (
            <span className="text-sm text-muted-foreground">Loading...</span>
        );
    }

    // No details available even after fetch
    if (!sheetsDetails) {
        return <span className="text-sm text-muted-foreground">-</span>;
    }

    // Calculate success count (updated + skipped are both successful)
    const successCount =
        (sheetsDetails.updated || 0) + (sheetsDetails.skipped || 0);
    const totalCount =
        sheetsDetails.total || successCount + (sheetsDetails.not_found || 0);

    // Determine if all patients were successful
    const isAllSuccessful =
        sheetsStatus === "success" &&
        (sheetsDetails.not_found || 0) === 0 &&
        successCount === totalCount;

    // Show format: X/Y where X is successful, Y is total
    const displayText = `${successCount}/${totalCount}`;

    // Use the tooltip entry if available, otherwise use the existing detailed entry
    const googleSheetsUpdate =
        detailedEntryForTooltip?.result_data?.google_sheets_update ||
        detailedEntry?.result_data?.google_sheets_update;

    return (
        <GoogleSheetsUpdateTooltip
            googleSheetsUpdate={googleSheetsUpdate}
            isLoading={
                isLoadingTooltip ||
                (shouldFetchForTooltip && !googleSheetsUpdate)
            }
            onOpenChange={(open) => {
                // Fetch details on hover if not already fetched
                if (open && !googleSheetsUpdate && !shouldFetchForTooltip) {
                    setShouldFetchForTooltip(true);
                }
            }}
        >
            <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
                <Badge
                    variant={isAllSuccessful ? "completed" : "failed"}
                    className="flex items-center gap-1"
                >
                    {displayText}
                </Badge>
            </div>
        </GoogleSheetsUpdateTooltip>
    );
}

// Status cell component that can use hooks
function StatusCell({ entry }: { entry: MonitoringEntryLight }) {
    const status = entry.status;
    const hasRetries = entry.retry_tasks && entry.retry_tasks.length > 0;
    const retryStatus = entry.best_retry_status;
    const alreadyImported = entry.already_imported || false;

    // Get lightweight details first (available immediately)
    const lightweightDetails = entry.google_sheets_update_details;
    const googleSheetsStatusFromLight = entry.google_sheets_update_status;

    // If we have status but no details, fetch detailed entry to get details (same as SheetsCell)
    const shouldFetchDetailsForCircle = !!(
        entry.status === "completed" &&
        googleSheetsStatusFromLight &&
        !lightweightDetails
    );
    const { entry: detailedEntryForCircle, isLoading: isLoadingCircleDetails } =
        useMonitoringEntryDetails(
            shouldFetchDetailsForCircle ? entry.task_id : null
        );

    // Try to get details from detailed entry if not in lightweight (same as SheetsCell)
    let sheetsDetails = lightweightDetails;
    if (
        !sheetsDetails &&
        detailedEntryForCircle?.result_data?.google_sheets_update
    ) {
        const googleSheetsUpdate =
            detailedEntryForCircle.result_data.google_sheets_update;
        if (
            googleSheetsUpdate.details &&
            typeof googleSheetsUpdate.details === "object"
        ) {
            sheetsDetails = {
                updated: googleSheetsUpdate.details.updated || 0,
                skipped: googleSheetsUpdate.details.skipped || 0,
                not_found: googleSheetsUpdate.details.not_found || 0,
                total:
                    googleSheetsUpdate.details.total ||
                    (googleSheetsUpdate.details.updated || 0) +
                        (googleSheetsUpdate.details.skipped || 0) +
                        (googleSheetsUpdate.details.not_found || 0),
            };
        }
    }

    // State to track if we should fetch detailed entry (on hover for tooltip only)
    const [shouldFetchDetails, setShouldFetchDetails] = React.useState(false);
    const { entry: detailedEntry, isLoading: isLoadingDetails } =
        useMonitoringEntryDetails(shouldFetchDetails ? entry.task_id : null);

    // Get full Google Sheets update from detailed entry (ONLY for tooltip content)
    const googleSheetsUpdate = detailedEntry?.result_data?.google_sheets_update;

    // Determine actual Google Sheets status - use EXACT same logic as SheetsCell
    // Use useMemo to ensure this calculation is stable and doesn't change unnecessarily
    const googleSheetsStatus = React.useMemo(() => {
        let status: "success" | "failed" | "error" | null = null;

        const statusFromLight = googleSheetsStatusFromLight
            ? googleSheetsStatusFromLight === "success"
                ? "success"
                : googleSheetsStatusFromLight === "failed" ||
                  googleSheetsStatusFromLight === "error"
                ? "failed"
                : null
            : null;

        // Use the same logic as SheetsCell - check details if available
        if (sheetsDetails && typeof sheetsDetails === "object") {
            const notFound = sheetsDetails.not_found || 0;
            const updated = sheetsDetails.updated || 0;
            const skipped = sheetsDetails.skipped || 0;
            const total = sheetsDetails.total || updated + skipped + notFound;

            // Calculate success count (updated + skipped are both successful)
            const successCount = updated + skipped;

            // Determine if all patients were successful - EXACT same logic as SheetsCell
            const isAllSuccessful =
                statusFromLight === "success" &&
                notFound === 0 &&
                successCount === total;

            status = isAllSuccessful ? "success" : "failed";
        }
        // Fallback to lightweight status string if no details available
        else if (statusFromLight) {
            status = statusFromLight === "success" ? "success" : "failed";
        }

        return status;
    }, [
        sheetsDetails,
        googleSheetsStatusFromLight,
        // NOTE: Including sheetsDetails which can come from lightweight OR fetched entry
        // This ensures the circle color is correct even if lightweight details aren't available
    ]);

    // Build tooltip content for error/retry info
    const buildTooltipContent = () => {
        const statusLower = status.toLowerCase();
        const hasError = statusLower === "failed" && entry.error_message;

        return (
            <div className="space-y-2">
                {hasError && (
                    <>
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="font-medium text-destructive">
                                Task Failed
                            </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                            {entry.error_message}
                        </p>
                    </>
                )}
                {hasRetries && (
                    <>
                        {hasError && <div className="border-t pt-2 mt-2" />}
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                    Retry Status: {retryStatus}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {entry.retry_tasks?.length || 0} retry
                                attempt(s)
                            </p>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const statusBadge = getStatusBadge(
        status,
        retryStatus,
        hasRetries,
        alreadyImported,
        googleSheetsStatus
    );

    // Check if we should show Google Sheets popover
    const hasGoogleSheetsStatus = !!googleSheetsStatus; // From lightweight or detailed entry
    const hasGoogleSheetsUpdate = !!googleSheetsUpdate; // Full update data from detailed entry
    const shouldShowErrorTooltip =
        (status.toLowerCase() === "failed" && entry.error_message) ||
        hasRetries;
    const isCompleted = status.toLowerCase() === "completed";

    // Google Sheets tooltip - REMOVED per client request
    // (Keeping code commented for potential future restoration)
    // For completed tasks with Google Sheets status, show tooltip on hover
    // Fetch full details to show complete card
    // if (isCompleted && hasGoogleSheetsStatus) {
    //     return (
    //         <GoogleSheetsUpdateTooltip
    //             googleSheetsUpdate={googleSheetsUpdate}
    //             isLoading={isLoadingDetails}
    //             onOpenChange={(open) => {
    //                 setShouldFetchDetails(open);
    //             }}
    //         >
    //             <div className="cursor-pointer hover:opacity-80 transition-opacity inline-block">
    //                 {statusBadge}
    //             </div>
    //         </GoogleSheetsUpdateTooltip>
    //     );
    // }

    // Show tooltip if there's error message or retry information
    if (shouldShowErrorTooltip) {
        return (
            <TooltipProvider>
                <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                        <div className="cursor-pointer hover:opacity-80 transition-opacity inline-block">
                            {statusBadge}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[400px] p-3">
                        {buildTooltipContent()}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return statusBadge;
}

const getStatusBadge = (
    status: string,
    retryStatus?: string | null,
    hasRetries?: boolean,
    alreadyImported?: boolean,
    googleSheetsStatus?: "success" | "failed" | "error" | null
) => {
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

    // Determine retry indicator - positioned like social media online status
    // Only show indicator for failed tasks
    let retryIndicator = null;
    if (statusLower === "failed" && hasRetries && retryStatus) {
        const retryStatusLower = retryStatus.toLowerCase();
        let dotColor = "bg-gray-400";

        switch (retryStatusLower) {
            case "completed":
                dotColor = "bg-green-500";
                break;
            case "processing":
                dotColor = "bg-blue-500";
                break;
            case "pending":
                dotColor = "bg-yellow-500";
                break;
            case "failed":
                dotColor = "bg-red-400";
                break;
        }

        retryIndicator = (
            <span
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColor} ring-1 ring-background`}
                aria-label={`Retry status: ${retryStatus}`}
            />
        );
    }

    // Google Sheets status indicator - REMOVED per client request
    // (Keeping code commented for potential future restoration)
    // let googleSheetsIndicator = null;
    // if (googleSheetsStatus) {
    //     const isSuccess = googleSheetsStatus === "success";
    //     const isFailed =
    //         googleSheetsStatus === "failed" || googleSheetsStatus === "error";
    //     // Green for success, red for failed/error, yellow for other statuses
    //     const dotColor = isSuccess
    //         ? "bg-green-500"
    //         : isFailed
    //         ? "bg-red-500"
    //         : "bg-yellow-500";

    //     // Position the indicator in the top-left corner
    //     googleSheetsIndicator = (
    //         <span
    //             className={`absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full ${dotColor} ring-2 ring-background`}
    //             aria-label={`Google Sheets update: ${googleSheetsStatus}`}
    //         />
    //     );
    // }

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
        <Badge
            variant={variant}
            className={`flex items-center gap-1 relative whitespace-nowrap ${
                retryIndicator ? "pr-3" : ""
            }`}
        >
            <Icon className="h-4 w-4" />
            {displayStatus}
            {retryIndicator}
        </Badge>
    );
};

export function MonitoringTable({
    entries,
    isLoading,
    error,
    onRetry,
    onRefresh,
    isRefreshing,
    agencies,
    onRetryEntry,
    isRetrying = false,
    onViewEntry,
    retryDialogOpen = false,
    setRetryDialogOpen,
    entryToRetry = null,
    setEntryToRetry,
    // onToggleChecked, // TEMPORARILY DISABLED
    // onSaveNote, // TEMPORARILY DISABLED
    // isSavingNote = false, // TEMPORARILY DISABLED
    onDeleteEntry,
    isDeleting = false,
    onBulkDelete,
    isBulkDeleting = false,
    variant = "837",
}: MonitoringTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
        undefined
    );
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
        {}
    );
    const [validationDialogOpen, setValidationDialogOpen] =
        React.useState(false);
    const [validationResults, setValidationResults] = React.useState<
        PatientValidationResult[]
    >([]);
    const [entryForValidation, setEntryForValidation] =
        React.useState<MonitoringEntryLight | null>(null);
    // const [noteDialogOpen, setNoteDialogOpen] = React.useState(false); // TEMPORARILY DISABLED
    // const [entryForNote, setEntryForNote] = React.useState<MonitoringEntryLight | null>(null); // TEMPORARILY DISABLED
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [entryToDelete, setEntryToDelete] =
        React.useState<MonitoringEntryLight | null>(null);
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] =
        React.useState(false);
    const [isDeletingAllVisible, setIsDeletingAllVisible] =
        React.useState(false);

    // Track previous filter state to detect changes
    const prevFiltersRef = React.useRef({
        columnFilters: [] as ColumnFiltersState,
        globalFilter: "",
        dateRange: undefined as DateRange | undefined,
    });

    // Define filter options
    const statusOptions = [
        { value: "pending", label: "Pending", icon: AlertCircle },
        { value: "processing", label: "Processing", icon: Clock },
        { value: "completed", label: "Posted", icon: CheckCircle },
        { value: "failed", label: "Failed", icon: XCircle },
    ];

    // Validation result filter options - TEMPORARILY DISABLED per client request
    // To re-enable: Uncomment the block below
    // const validationResultOptions = [
    //     {
    //         value: "fully_successful",
    //         label: "Fully Successful",
    //         icon: CheckCircle,
    //     },
    //     {
    //         value: "not_fully_successful",
    //         label: "Not Fully Successful",
    //         icon: XCircle,
    //     },
    // ];

    const agencyOptions = agencies.map((agency) => ({
        value: agency.id,
        label: agency.name,
        icon: Building2,
    }));

    // Initialize column visibility from localStorage (separate key per variant so 837 and 277 don't share toggles)
    const tableId =
        variant === "277" ? "monitoring-table-277" : "monitoring-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => {
            const savedVisibility = loadTableVisibility(tableId);
            // If no saved visibility, set default visibility (hiding task_id, retry_count, total_amounts, npi by default)
            if (Object.keys(savedVisibility).length === 0) {
                return {
                    task_id: false,
                    retry_count: false,
                    total_amounts: false,
                    npi: false,
                    sheets: true, // Show Sheets column by default
                };
            }
            return savedVisibility;
        });

    const handleViewValidation = (
        results: PatientValidationResult[],
        entry: MonitoringEntryLight
    ) => {
        setValidationResults(results);
        setEntryForValidation(entry);
        setValidationDialogOpen(true);
    };

    const columns: ColumnDef<MonitoringEntryLight>[] = React.useMemo(() => {
        const baseColumns: ColumnDef<MonitoringEntryLight>[] = [
            {
                id: "select",
                header: ({ table }) => {
                    const isAllSelected = table.getIsAllPageRowsSelected();
                    const isSomeSelected = table.getIsSomePageRowsSelected();
                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={
                                    isAllSelected
                                        ? true
                                        : isSomeSelected
                                        ? "indeterminate"
                                        : false
                                }
                                onCheckedChange={(value) =>
                                    table.toggleAllPageRowsSelected(!!value)
                                }
                                aria-label="Select all"
                            />
                        </div>
                    );
                },
                cell: ({ row }) => (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                            checked={row.getIsSelected()}
                            onCheckedChange={(value) =>
                                row.toggleSelected(!!value)
                            }
                            aria-label="Select row"
                        />
                    </div>
                ),
                enableSorting: false,
                enableHiding: false,
            },
            // TEMPORARILY DISABLED: Checked column - Can be re-enabled in the future if needed
            // Client requested to hide this feature but keep the implementation
            // To re-enable: Uncomment this entire block
            // {
            //     id: "checked",
            //     header: "Checked",
            //     enableHiding: false,
            //     cell: ({ row }) => {
            //         const entry = row.original;
            //         const isChecked = entry.is_checked || false;
            //         const hasMetadata = entry.checked_by || entry.checked_at;

            //         const checkboxElement = (
            //             <div onClick={(e) => e.stopPropagation()}>
            //                 <Checkbox
            //                     checked={isChecked}
            //                     onCheckedChange={(checked) => {
            //                         console.log(
            //                             `[MonitoringTable] Checkbox clicked - taskId: ${entry.task_id}, newValue: ${checked}`
            //                         );
            //                         if (onToggleChecked) {
            //                             onToggleChecked(
            //                                 entry.task_id,
            //                                 checked === true
            //                             );
            //                         } else {
            //                             console.warn(
            //                                 "[MonitoringTable] onToggleChecked is not defined!"
            //                             );
            //                         }
            //                     }}
            //                     aria-label="Mark as checked"
            //                 />
            //             </div>
            //         );

            //         return (
            //             <div className="flex items-center justify-center">
            //                 {hasMetadata ? (
            //                     <TooltipProvider>
            //                         <Tooltip delayDuration={200}>
            //                             <TooltipTrigger asChild>
            //                                 {checkboxElement}
            //                             </TooltipTrigger>
            //                             <TooltipContent>
            //                                 <div className="space-y-1">
            //                                     {entry.checked_by && (
            //                                         <p className="text-xs">
            //                                             Checked by:{" "}
            //                                             <span className="font-medium">
            //                                                 {entry.checked_by}
            //                                             </span>
            //                                         </p>
            //                                     )}
            //                                     {entry.checked_at && (
            //                                         <p className="text-xs text-muted-foreground">
            //                                             {new Date(
            //                                                 entry.checked_at
            //                                             ).toLocaleString()}
            //                                         </p>
            //                                     )}
            //                                 </div>
            //                             </TooltipContent>
            //                         </Tooltip>
            //                     </TooltipProvider>
            //                 ) : (
            //                     checkboxElement
            //                 )}
            //             </div>
            //         );
            //     },
            // },

            // TEMPORARILY DISABLED: Note column - Can be re-enabled in the future if needed
            // Client requested to hide this feature but keep the implementation
            // To re-enable: Uncomment this entire block
            // {
            //     id: "note",
            //     header: "Note",
            //     enableHiding: false,
            //     cell: ({ row }) => {
            //         const entry = row.original;
            //         const hasNote = entry.note && entry.note.trim().length > 0;

            //         return (
            //             <div className="flex items-center justify-center">
            //                 {hasNote ? (
            //                     <TooltipProvider>
            //                         <Tooltip delayDuration={200}>
            //                             <TooltipTrigger asChild>
            //                                 <Button
            //                                     variant="ghost"
            //                                     size="sm"
            //                                     className="h-8 w-8 p-0 hover:bg-accent"
            //                                     onClick={(e) => {
            //                                         e.stopPropagation();
            //                                         setEntryForNote(entry);
            //                                         setNoteDialogOpen(true);
            //                                     }}
            //                                 >
            //                                     <MessageSquare className="h-4 w-4 text-primary" />
            //                                 </Button>
            //                             </TooltipTrigger>
            //                             <TooltipContent className="max-w-xs">
            //                                 <div className="space-y-1">
            //                                     <p className="text-sm whitespace-pre-wrap">
            //                                         {entry.note}
            //                                     </p>
            //                                     {entry.note_by && (
            //                                         <p className="text-xs text-muted-foreground">
            //                                             — {entry.note_by}
            //                                             {entry.note_at &&
            //                                                 `, ${new Date(
            //                                                     entry.note_at
            //                                                 ).toLocaleDateString()}`}
            //                                         </p>
            //                                     )}
            //                                 </div>
            //                             </TooltipContent>
            //                         </Tooltip>
            //                     </TooltipProvider>
            //                 ) : (
            //                     <Button
            //                         variant="ghost"
            //                         size="sm"
            //                         className="h-8 w-8 p-0 hover:bg-accent"
            //                         onClick={(e) => {
            //                             e.stopPropagation();
            //                             setEntryForNote(entry);
            //                             setNoteDialogOpen(true);
            //                         }}
            //                     >
            //                         <StickyNote className="h-4 w-4 text-muted-foreground" />
            //                     </Button>
            //                 )}
            //             </div>
            //         );
            //     },
            // },
            {
                accessorKey: "agency_name",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Agency
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const agencyName = row.getValue("agency_name") as string;
                    const entry = row.original;
                    const agency = agencies.find(
                        (a) => a.id === entry.agency_id
                    );
                    const agencyUrl = agency?.link;

                    return (
                        <div className="flex items-center">
                            <Building2 className="mr-2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            {agencyUrl ? (
                                <TooltipProvider>
                                    <Tooltip delayDuration={200}>
                                        <TooltipTrigger asChild>
                                            <a
                                                href={agencyUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="text-sm line-clamp-2 break-words text-primary hover:underline"
                                            >
                                                {agencyName || "N/A"}
                                            </a>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-sm">
                                                {agencyUrl}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <span className="text-sm line-clamp-2 break-words">
                                    {agencyName || "N/A"}
                                </span>
                            )}
                        </div>
                    );
                },
                filterFn: (row, id, value) => {
                    const agencyId = row.original.agency_id;
                    return value.includes(agencyId);
                },
            },
            {
                accessorKey: "task_id",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Task ID
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center">
                        <Hash className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                            {(row.getValue("task_id") as string).substring(
                                0,
                                8
                            )}
                            ...
                        </span>
                    </div>
                ),
            },
            createFileColumn(),
            createNPIColumn(),
            // VALIDATION COLUMN - TEMPORARILY DISABLED per client request
            // To re-enable: Uncomment the line below
            // createValidationColumn(handleViewValidation),
            {
                accessorKey: "ra_date",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        RA Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    const raDate = entry.ra_date;

                    if (!raDate) {
                        return (
                            <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    N/A
                                </span>
                            </div>
                        );
                    }

                    // Format date from YYYY-MM-DD to readable format
                    const date = new Date(raDate + "T00:00:00");
                    const formattedDate = date.toLocaleDateString();

                    return (
                        <div className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formattedDate}</span>
                        </div>
                    );
                },
            },
            {
                id: "patient_count",
                header: "Patients",
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    const ediPatients = entry.edi_patients;

                    if (!ediPatients || ediPatients.length === 0) {
                        return (
                            <div className="flex items-center">
                                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    -
                                </span>
                            </div>
                        );
                    }

                    return (
                        <TooltipProvider>
                            <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center cursor-pointer">
                                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">
                                            {ediPatients.length}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs p-3">
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">
                                            {ediPatients.length} patient
                                            {ediPatients.length !== 1
                                                ? "s"
                                                : ""}{" "}
                                            in file
                                        </p>
                                        <ScrollArea className="h-48 w-full rounded-md border">
                                            <div className="p-2 space-y-1">
                                                {ediPatients.map(
                                                    (patient, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="text-xs text-muted-foreground py-1"
                                                        >
                                                            {patient.patient_name ||
                                                                `Patient ${
                                                                    idx + 1
                                                                }`}
                                                            {patient.claim_number &&
                                                                ` (${patient.claim_number})`}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                },
            },
            {
                id: "total_amounts",
                header: "Total Amounts",
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    const ediPatients = entry.edi_patients;
                    const validationResults = entry.validation_results;

                    if (!ediPatients || ediPatients.length === 0) {
                        return (
                            <span className="text-sm text-muted-foreground">
                                -
                            </span>
                        );
                    }

                    // Use the same logic as Excel export: prioritize validation_results
                    const hasValidationResultsData =
                        validationResults && validationResults.length > 0;

                    let totalClaimAmount = 0;
                    let totalPaidAmount = 0;
                    let totalAdjustmentAmount = 0;
                    let hasAnyClaimAmount = false;

                    if (hasValidationResultsData && validationResults) {
                        // Iterate over validation_results (same as Excel export)
                        for (let i = 0; i < validationResults.length; i++) {
                            const validation = validationResults[i];

                            // Find matching EDI patient by patient number (exact match required)
                            const validationPatientNumber =
                                validation.patient_number
                                    ? String(validation.patient_number).trim()
                                    : null;

                            let ediPatient: EDIPatientData | undefined =
                                undefined;
                            if (validationPatientNumber) {
                                ediPatient = ediPatients.find((p) => {
                                    const pPatientNumber = p.patient_number
                                        ? String(p.patient_number).trim()
                                        : null;
                                    return (
                                        pPatientNumber ===
                                        validationPatientNumber
                                    );
                                });
                            }

                            // No fallback matching - only use validation data when patient numbers exactly match

                            // Use final_claim_amount from validation (same as Excel)
                            const claimAmount =
                                validation.final_claim_amount ?? null;
                            if (claimAmount != null && claimAmount !== 0) {
                                totalClaimAmount += claimAmount;
                                hasAnyClaimAmount = true;
                            }

                            // Use final_payment_amount from validation
                            totalPaidAmount +=
                                validation.final_payment_amount || 0;

                            // Use adjustment_amount from ediPatient if available
                            if (ediPatient?.adjustment_amount) {
                                totalAdjustmentAmount +=
                                    ediPatient.adjustment_amount;
                            }
                        }
                    } else {
                        // Fallback to edi_patients if no validation_results
                        totalClaimAmount = ediPatients.reduce((sum, p) => {
                            const claimAmount = p.claim_amount;
                            if (claimAmount != null && claimAmount !== 0) {
                                hasAnyClaimAmount = true;
                                return sum + claimAmount;
                            }
                            return sum;
                        }, 0);
                        totalPaidAmount = ediPatients.reduce(
                            (sum, p) => sum + (p.paid_amount || 0),
                            0
                        );
                        totalAdjustmentAmount = ediPatients.reduce(
                            (sum, p) => sum + (p.adjustment_amount || 0),
                            0
                        );
                    }
                    const hasAnyAdjustment = totalAdjustmentAmount !== 0;

                    // Check if we should show validation dialog on click
                    const shouldShowValidationDialog =
                        hasValidationResultsData &&
                        entry.status === "completed";

                    const handleClick = (e: React.MouseEvent) => {
                        if (shouldShowValidationDialog) {
                            e.stopPropagation();
                            handleViewValidation(
                                validationResults || [],
                                entry
                            );
                        }
                    };

                    return (
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={`text-sm ${
                                            shouldShowValidationDialog
                                                ? "cursor-pointer hover:opacity-80"
                                                : ""
                                        }`}
                                        onClick={handleClick}
                                    >
                                        <span className="font-medium">
                                            {hasAnyClaimAmount
                                                ? `$${totalClaimAmount.toFixed(
                                                      2
                                                  )}`
                                                : "—"}
                                            / ${totalPaidAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="space-y-1">
                                        <div>
                                            <span className="text-muted-foreground">
                                                Total Claim Amount:
                                            </span>{" "}
                                            <span className="font-medium">
                                                {hasAnyClaimAmount
                                                    ? `$${totalClaimAmount.toFixed(
                                                          2
                                                      )}`
                                                    : "N/A"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">
                                                Total Paid Amount:
                                            </span>{" "}
                                            <span className="font-medium">
                                                ${totalPaidAmount.toFixed(2)}
                                            </span>
                                        </div>
                                        {hasAnyAdjustment && (
                                            <div>
                                                <span className="text-muted-foreground">
                                                    Total Adjustment:
                                                </span>{" "}
                                                <span className="font-medium text-orange-600">
                                                    $
                                                    {totalAdjustmentAmount.toFixed(
                                                        2
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground">
                                                Difference:
                                            </span>{" "}
                                            <span
                                                className={`font-medium ${
                                                    hasAnyClaimAmount
                                                        ? totalPaidAmount >=
                                                          totalClaimAmount
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                {hasAnyClaimAmount
                                                    ? `$${(
                                                          totalPaidAmount -
                                                          totalClaimAmount
                                                      ).toFixed(2)}`
                                                    : "N/A"}
                                            </span>
                                        </div>
                                        {shouldShowValidationDialog && (
                                            <div className="pt-1 mt-1 border-t text-xs text-muted-foreground">
                                                Click to view claim details
                                            </div>
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                },
            },
            {
                id: "sheets",
                header: "Sheets",
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    return <SheetsCell entry={entry} />;
                },
            },
            {
                accessorKey: "status",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Status
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    return <StatusCell entry={entry} />;
                },
                filterFn: (row, id, value) => {
                    return value.includes(row.getValue(id));
                },
            },
            {
                accessorKey: "remarks",
                header: "Remarks",
                cell: ({ row }) => {
                    const entry = row.original as MonitoringEntryLight;
                    const remarks = entry.remarks;

                    if (!remarks || remarks.trim().length === 0) {
                        return (
                            <span className="text-sm text-muted-foreground">
                                -
                            </span>
                        );
                    }

                    // Truncate long remarks for display
                    const maxLength = 50;
                    const truncated =
                        remarks.length > maxLength
                            ? remarks.substring(0, maxLength) + "..."
                            : remarks;

                    return (
                        <TooltipProvider>
                            <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                    <div className="max-w-[200px]">
                                        <p className="text-sm truncate">
                                            {truncated}
                                        </p>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[400px]">
                                    <p className="text-sm whitespace-pre-wrap">
                                        {remarks}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                },
            },
            {
                accessorKey: "retry_count",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Retries
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => (
                    <div className="flex items-center">
                        <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" />
                        {row.getValue("retry_count") as number} /{" "}
                        {(row.original as MonitoringEntryLight).max_retries}
                    </div>
                ),
            },
            {
                accessorKey: "billing_file_uploaded_at",
                header: ({ column }) => (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Uploaded
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                ),
                cell: ({ row }) => {
                    const billingFileUploadedAt = row.getValue(
                        "billing_file_uploaded_at"
                    ) as string;
                    if (!billingFileUploadedAt) {
                        return (
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">N/A</span>
                            </div>
                        );
                    }
                    const date = new Date(billingFileUploadedAt + "Z");
                    return (
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                            {date.toLocaleDateString()}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>
                                        {date.toLocaleString(undefined, {
                                            timeZone:
                                                Intl.DateTimeFormat().resolvedOptions()
                                                    .timeZone,
                                        })}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                },
            },
        ];

        // For 277 dashboard: hide Total Amounts, Status, RA Date, Remarks, Retries (837 shows all)
        const hidden277ColumnKeys = [
            "ra_date",
            "total_amounts",
            "status",
            "remarks",
            "retry_count",
        ];
        const dataColumns =
            variant === "277"
                ? baseColumns.filter((col) => {
                      const c = col as { accessorKey?: string; id?: string };
                      const key = c.accessorKey ?? c.id;
                      return (
                          key == null ||
                          !hidden277ColumnKeys.includes(String(key))
                      );
                  })
                : baseColumns;

        // Add actions column
        dataColumns.push({
            id: "actions",
            header: "Actions",
            enableHiding: false,
            cell: ({ row }) => {
                const entry = row.original;
                return (
                    <div className="flex items-center gap-1">
                        <ActionMenu
                            onRetry={
                                onRetryEntry
                                    ? (e: React.MouseEvent<HTMLDivElement>) => {
                                          e.stopPropagation();
                                          if (
                                              setEntryToRetry &&
                                              setRetryDialogOpen
                                          ) {
                                              setEntryToRetry(entry);
                                              setRetryDialogOpen(true);
                                          }
                                      }
                                    : undefined
                            }
                            onDelete={
                                onDeleteEntry
                                    ? (e: React.MouseEvent<HTMLDivElement>) => {
                                          e.stopPropagation();
                                          setEntryToDelete(entry);
                                          setDeleteDialogOpen(true);
                                      }
                                    : undefined
                            }
                            retryLabel="Retry task"
                            deleteLabel="Delete task"
                            showRetry={!!onRetryEntry}
                            showDelete={!!onDeleteEntry}
                        />
                    </div>
                );
            },
        });

        return dataColumns;
    }, [
        variant,
        agencies,
        onRetryEntry,
        setRetryDialogOpen,
        setEntryToRetry,
        // onToggleChecked, // TEMPORARILY DISABLED
        onDeleteEntry,
    ]);

    // Filter data based on date range
    const filteredData = React.useMemo(() => {
        if (!dateRange?.from) return entries;

        return entries.filter((entry) => {
            if (!entry.billing_file_uploaded_at || !dateRange.from)
                return false;

            const uploadedDate = new Date(entry.billing_file_uploaded_at + "Z");
            const from = startOfDay(dateRange.from);
            const to = dateRange.to
                ? endOfDay(dateRange.to)
                : endOfDay(dateRange.from);

            return isWithinInterval(uploadedDate, { start: from, end: to });
        });
    }, [entries, dateRange]);

    const table = useReactTable({
        data: filteredData,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        enableRowSelection: true,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        globalFilterFn: (row, columnId, value) => {
            const searchValue = value.toLowerCase();
            const entry = row.original as MonitoringEntryLight;

            // Search in PDF/EDI filename
            const filename = entry.pdf_filename?.toLowerCase() || "";
            if (filename.includes(searchValue)) {
                return true;
            }

            // Search in Task ID
            const taskId = entry.task_id?.toLowerCase() || "";
            if (taskId.includes(searchValue)) {
                return true;
            }

            // Search in NPI (for EDI tasks)
            const npi = entry.edi_info?.npi?.toLowerCase() || "";
            if (npi.includes(searchValue)) {
                return true;
            }

            // Search in Agency NPI
            const agencyNpi = entry.agency_npi?.toLowerCase() || "";
            if (agencyNpi.includes(searchValue)) {
                return true;
            }

            // Search in Agency name
            const agencyName = entry.agency_name?.toLowerCase() || "";
            if (agencyName.includes(searchValue)) {
                return true;
            }

            return false;
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: 7,
            },
        },
        autoResetPageIndex: false,
    });

    // Initialize ref on mount to prevent reset on first render
    React.useEffect(() => {
        prevFiltersRef.current = {
            columnFilters,
            globalFilter,
            dateRange,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset page index when filters change
    React.useEffect(() => {
        const prevFilters = prevFiltersRef.current;
        const filtersChanged =
            JSON.stringify(prevFilters.columnFilters) !==
                JSON.stringify(columnFilters) ||
            prevFilters.globalFilter !== globalFilter ||
            prevFilters.dateRange?.from?.getTime() !==
                dateRange?.from?.getTime() ||
            prevFilters.dateRange?.to?.getTime() !== dateRange?.to?.getTime();

        if (filtersChanged) {
            // Reset to first page when filters change
            table.setPageIndex(0);
            // Update ref for next comparison
            prevFiltersRef.current = {
                columnFilters,
                globalFilter,
                dateRange,
            };
        }
    }, [columnFilters, globalFilter, dateRange, table]);

    const handleRetry = async () => {
        if (
            entryToRetry &&
            onRetryEntry &&
            setRetryDialogOpen &&
            setEntryToRetry
        ) {
            const success = await onRetryEntry(entryToRetry.task_id);
            if (success) {
                setRetryDialogOpen(false);
                setEntryToRetry(null);
            }
        }
    };

    const handleDelete = async () => {
        if (
            entryToDelete &&
            onDeleteEntry &&
            setDeleteDialogOpen &&
            setEntryToDelete
        ) {
            const success = await onDeleteEntry(entryToDelete.task_id);
            if (success) {
                setDeleteDialogOpen(false);
                setEntryToDelete(null);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (onBulkDelete && setBulkDeleteDialogOpen) {
            let rowsToDelete;

            if (isDeletingAllVisible) {
                // Delete all visible (filtered) rows
                rowsToDelete = table.getFilteredRowModel().rows;
            } else {
                // Delete only selected rows
                rowsToDelete = table
                    .getFilteredRowModel()
                    .rows.filter((row) => row.getIsSelected());
            }

            const taskIds = rowsToDelete.map((row) => row.original.task_id);

            if (taskIds.length === 0) {
                toast.error(
                    isDeletingAllVisible
                        ? "No entries to delete"
                        : "No entries selected"
                );
                return;
            }

            const success = await onBulkDelete(taskIds);
            if (success) {
                setBulkDeleteDialogOpen(false);
                setIsDeletingAllVisible(false);
                setRowSelection({}); // Clear selection after successful deletion
            }
        }
    };

    const isFiltered =
        table.getState().columnFilters.length > 0 ||
        globalFilter ||
        dateRange?.from;

    return (
        <div className="space-y-4 w-full">
            <div className="flex w-full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    <div className="relative flex-1 min-w-[240px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search files, NPI, agency, or task ID..."
                            value={globalFilter ?? ""}
                            onChange={(event) =>
                                setGlobalFilter(event.target.value)
                            }
                            className="pl-10 pr-4 py-2 border-muted"
                        />
                    </div>

                    <div className="flex-shrink-0">
                        <ColumnVisibility table={table} tableId={tableId} />
                    </div>

                    <div className="flex-shrink-0">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`justify-start text-left font-normal ${
                                        !dateRange?.from &&
                                        "text-muted-foreground"
                                    }`}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(
                                                    dateRange.from,
                                                    "MMM dd, yyyy"
                                                )}{" "}
                                                -{" "}
                                                {format(
                                                    dateRange.to,
                                                    "MMM dd, yyyy"
                                                )}
                                            </>
                                        ) : (
                                            format(
                                                dateRange.from,
                                                "MMM dd, yyyy"
                                            )
                                        )
                                    ) : (
                                        <span>Filter by date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-auto p-0"
                                align="start"
                            >
                                <CalendarComponent
                                    mode="range"
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Validation filter - HIDDEN per client request */}
                    {/* {table.getColumn("validation") && (
                        <div className="flex-shrink-0">
                            <DataTableFacetedFilter
                                column={table.getColumn("validation")}
                                title="Validation"
                                options={validationResultOptions}
                            />
                        </div>
                    )} */}

                    {variant !== "277" && table.getColumn("status") && (
                        <div className="flex-shrink-0">
                            <DataTableFacetedFilter
                                column={table.getColumn("status")}
                                title="Status"
                                options={statusOptions}
                            />
                        </div>
                    )}

                    {table.getColumn("agency_name") && (
                        <div className="flex-shrink-0">
                            <DataTableFacetedFilter
                                column={table.getColumn("agency_name")}
                                title="Agency"
                                options={agencyOptions}
                            />
                        </div>
                    )}

                    {isFiltered && (
                        <div className="flex-shrink-0">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    table.resetColumnFilters();
                                    setGlobalFilter("");
                                    setDateRange(undefined);
                                }}
                                className="h-10 px-3"
                            >
                                Reset
                                <X className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    <RefreshButton
                        onRefresh={onRefresh}
                        tooltipText="Refresh monitoring data"
                        successMessage="Monitoring data refreshed successfully"
                        errorMessage="Failed to refresh monitoring data"
                        disabled={isRefreshing}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="ring-1 ring-muted"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={async () => {
                                    try {
                                        const filteredRows =
                                            table.getFilteredRowModel().rows;
                                        const filteredEntries =
                                            filteredRows.map(
                                                (row) => row.original
                                            );

                                        const exportableEntries =
                                            filteredEntries.filter(
                                                (entry) =>
                                                    entry.status ===
                                                        "completed" ||
                                                    entry.status === "failed"
                                            );

                                        if (exportableEntries.length === 0) {
                                            toast.error(
                                                "No data to export. Only completed or failed tasks are exported."
                                            );
                                            return;
                                        }

                                        await exportMonitoringToExcel(
                                            exportableEntries
                                        );
                                        toast.success(
                                            `Exported ${exportableEntries.length} task(s) to Excel`
                                        );
                                    } catch (error) {
                                        console.error("Export error:", error);
                                        toast.error(
                                            "Failed to export data to Excel"
                                        );
                                    }
                                }}
                                disabled={
                                    table.getFilteredRowModel().rows.length ===
                                    0
                                }
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Export to Excel
                            </DropdownMenuItem>
                            {onBulkDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => {
                                            const filteredRows =
                                                table.getFilteredRowModel()
                                                    .rows;
                                            const count = filteredRows.length;

                                            if (count === 0) {
                                                toast.error(
                                                    "No entries to delete"
                                                );
                                                return;
                                            }

                                            setIsDeletingAllVisible(true);
                                            setBulkDeleteDialogOpen(true);
                                        }}
                                        disabled={
                                            isBulkDeleting ||
                                            table.getFilteredRowModel().rows
                                                .length === 0
                                        }
                                        className="text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-500/10 dark:focus:bg-red-500/20"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete All Visible
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Floating toolbar for selected rows */}
            {onBulkDelete &&
                table
                    .getFilteredRowModel()
                    .rows.some((row) => row.getIsSelected()) && (
                    <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                                {
                                    table
                                        .getFilteredRowModel()
                                        .rows.filter((row) =>
                                            row.getIsSelected()
                                        ).length
                                }{" "}
                                row
                                {table
                                    .getFilteredRowModel()
                                    .rows.filter((row) => row.getIsSelected())
                                    .length !== 1
                                    ? "s"
                                    : ""}{" "}
                                selected
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRowSelection({})}
                                className="h-7 text-xs"
                            >
                                Clear selection
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    const selectedRows = table
                                        .getFilteredRowModel()
                                        .rows.filter((row) =>
                                            row.getIsSelected()
                                        );
                                    const count = selectedRows.length;

                                    if (count === 0) {
                                        toast.error("No entries selected");
                                        return;
                                    }

                                    setIsDeletingAllVisible(false);
                                    setBulkDeleteDialogOpen(true);
                                }}
                                disabled={isBulkDeleting}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef
                                                      .header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <LoadingRow colSpan={columns.length} />
                        ) : error ? (
                            <ErrorRow
                                colSpan={columns.length}
                                message={error.message}
                                onRetry={onRetry}
                            />
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={
                                        onViewEntry
                                            ? "cursor-pointer hover:bg-muted/50"
                                            : ""
                                    }
                                    onClick={() => onViewEntry?.(row.original)}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <EmptyRow
                                colSpan={columns.length}
                                message="No monitoring data found"
                            />
                        )}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination table={table} />

            {entryToRetry && setRetryDialogOpen && setEntryToRetry && (
                <RetryMonitoringEntryDialog
                    isOpen={retryDialogOpen}
                    onClose={() => {
                        setRetryDialogOpen(false);
                        setEntryToRetry(null);
                    }}
                    onConfirm={handleRetry}
                    taskId={entryToRetry.task_id}
                    pdfFilename={entryToRetry.pdf_filename}
                    isLoading={isRetrying}
                />
            )}

            <PatientValidationDialog
                isOpen={validationDialogOpen}
                onClose={() => setValidationDialogOpen(false)}
                results={validationResults}
                ediPatients={entryForValidation?.edi_patients}
                raDate={entryForValidation?.ra_date}
            />

            {/* TEMPORARILY DISABLED: Note dialog - Can be re-enabled when note column is re-enabled */}
            {/* {entryForNote && onSaveNote && (
                <AddNoteDialog
                    isOpen={noteDialogOpen}
                    onClose={() => {
                        setNoteDialogOpen(false);
                        setEntryForNote(null);
                    }}
                    onSave={async (note) => {
                        const success = await onSaveNote(
                            entryForNote.task_id,
                            note
                        );
                        return success;
                    }}
                    currentNote={entryForNote.note || ""}
                    taskId={entryForNote.task_id}
                    pdfFilename={entryForNote.pdf_filename}
                    isLoading={isSavingNote}
                />
            )} */}

            {entryToDelete && onDeleteEntry && (
                <DeleteMonitoringEntryDialog
                    isOpen={deleteDialogOpen}
                    onClose={() => {
                        setDeleteDialogOpen(false);
                        setEntryToDelete(null);
                    }}
                    onConfirm={handleDelete}
                    taskId={entryToDelete.task_id}
                    pdfFilename={entryToDelete.pdf_filename}
                    isLoading={isDeleting}
                />
            )}

            {onBulkDelete && (
                <BulkDeleteMonitoringEntriesDialog
                    isOpen={bulkDeleteDialogOpen}
                    onClose={() => {
                        setBulkDeleteDialogOpen(false);
                        setIsDeletingAllVisible(false);
                    }}
                    onConfirm={handleBulkDelete}
                    count={
                        isDeletingAllVisible
                            ? table.getFilteredRowModel().rows.length
                            : table
                                  .getFilteredRowModel()
                                  .rows.filter((row) => row.getIsSelected())
                                  .length
                    }
                    isLoading={isBulkDeleting}
                />
            )}
        </div>
    );
}
