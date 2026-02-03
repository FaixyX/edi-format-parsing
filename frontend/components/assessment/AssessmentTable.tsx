"use client";

import { Assessment } from "@/types/assessment";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import * as React from "react";
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    RowSelectionState,
} from "@tanstack/react-table";
import {
    ArrowUpDown,
    Lock,
    FileX,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssessmentTableProps {
    assessments: Assessment[];
    isLoading: boolean;
    error: Error | null;
    onRetry: () => void;
    selectedAssessmentId: string | null;
    onSelectAssessment: (assessmentId: string | null) => void;
    disabled?: boolean;
    onRefresh?: () => Promise<any>;
}

// Helper functions to determine assessment status
const isAssessmentExported = (oasisStatus: string): boolean => {
    return oasisStatus.toLowerCase().includes("exported");
};

const isAssessmentAccepted = (oasisStatus: string): boolean => {
    return oasisStatus.toLowerCase().includes("accepted");
};

const isAssessmentLocked = (oasisStatus: string): boolean => {
    return oasisStatus.toLowerCase().includes("locked");
};

const isAssessmentDisabled = (assessment: Assessment): boolean => {
    const isExported = isAssessmentExported(assessment.oasis);
    const isAccepted = isAssessmentAccepted(assessment.oasis);
    const isDisabledType =
        assessment.status_description === "Transfer" ||
        assessment.status_description === "Discharge";
    return isExported || isAccepted || isDisabledType;
};

export function AssessmentTable({
    assessments,
    isLoading,
    error,
    onRetry,
    selectedAssessmentId,
    onSelectAssessment,
    disabled = false,
    onRefresh,
}: AssessmentTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
        {}
    );
    const [lockedAssessmentDialog, setLockedAssessmentDialog] = React.useState<{
        isOpen: boolean;
        assessment: Assessment | null;
    }>({ isOpen: false, assessment: null });

    // Update row selection when selectedAssessmentId changes
    React.useEffect(() => {
        if (selectedAssessmentId) {
            setRowSelection({ [selectedAssessmentId]: true });
        } else {
            setRowSelection({});
        }
    }, [selectedAssessmentId]);

    // Update selectedAssessmentId when row selection changes
    React.useEffect(() => {
        const selectedRows = Object.keys(rowSelection);
        if (selectedRows.length > 0) {
            // Only take the first selected row (single select)
            onSelectAssessment(selectedRows[0]);
        } else {
            onSelectAssessment(null);
        }
    }, [rowSelection, onSelectAssessment]);

    // Handle locked assessment confirmation
    const handleLockedAssessmentConfirm = () => {
        if (lockedAssessmentDialog.assessment) {
            // Find the row for this assessment and select it
            const row = table
                .getRowModel()
                .rows.find(
                    (row) =>
                        row.original.id ===
                        lockedAssessmentDialog.assessment?.id
                );
            if (row) {
                // Clear all other selections first (single select)
                setRowSelection({});
                // Then select this row
                row.toggleSelected(true);
            }
        }
        setLockedAssessmentDialog({ isOpen: false, assessment: null });
    };

    const handleLockedAssessmentCancel = () => {
        setLockedAssessmentDialog({ isOpen: false, assessment: null });
    };

    const columns: ColumnDef<Assessment>[] = React.useMemo(
        () => [
            {
                id: "select",
                header: () => <div className="w-4"></div>, // Empty header for spacing
                cell: ({ row }) => {
                    const assessment = row.original;
                    const isLocked = isAssessmentLocked(assessment.oasis);
                    const isDisabled =
                        disabled || isAssessmentDisabled(assessment);

                    return (
                        <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={row.getIsSelected()}
                                onCheckedChange={(value) => {
                                    if (isDisabled) return;

                                    if (isLocked && !row.getIsSelected()) {
                                        // For locked assessments, show confirmation dialog only when selecting (not deselecting)
                                        setLockedAssessmentDialog({
                                            isOpen: true,
                                            assessment,
                                        });
                                        return;
                                    }

                                    // Clear all other selections first (single select)
                                    setRowSelection({});
                                    // Then select this row if checked
                                    if (value) {
                                        row.toggleSelected(true);
                                    }
                                }}
                                aria-label="Select row"
                                disabled={isDisabled}
                            />
                        </div>
                    );
                },
                enableSorting: false,
                enableHiding: false,
            },
            {
                accessorKey: "status_description",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                            className="p-0 hover:bg-transparent"
                        >
                            Type
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const type = row.getValue("status_description") as string;
                    return (
                        <Badge
                            variant={
                                type as
                                    | "SOC (further visits)"
                                    | "Follow-up/Recert"
                                    | "ROC"
                                    | "Discharge"
                                    | "Transfer"
                                    | "Other follow-up"
                            }
                            className="capitalize"
                        >
                            {type}
                        </Badge>
                    );
                },
            },
            {
                accessorKey: "status",
                header: ({ column }) => {
                    return (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                column.toggleSorting(
                                    column.getIsSorted() === "asc"
                                )
                            }
                            className="p-0 hover:bg-transparent"
                        >
                            Date
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => (
                    <div className="font-medium">{row.getValue("status")}</div>
                ),
            },
            {
                accessorKey: "effective_dates",
                header: "Effective Dates",
                cell: ({ row }) => <div>{row.getValue("effective_dates")}</div>,
            },
            {
                accessorKey: "oasis",
                header: "OASIS",
                cell: ({ row }) => {
                    const oasisStatus = row.getValue("oasis") as string;
                    const isExported = isAssessmentExported(oasisStatus);
                    const isAccepted = isAssessmentAccepted(oasisStatus);
                    const isLocked = isAssessmentLocked(oasisStatus);

                    return (
                        <div className="flex items-start gap-2">
                            <div className="mt-[2px]">
                                {isExported && <FileX className="h-4 w-4 " />}
                                {isAccepted && <FileX className="h-4 w-4 " />}
                                {isLocked && (
                                    <Lock className="h-4 w-4 text-amber-600" />
                                )}
                                {!isExported && !isAccepted && !isLocked && (
                                    <div className="w-2 h-2 m-1 rounded-full bg-green-500"></div>
                                )}
                            </div>
                            <span
                                className={cn(
                                    (isExported || isAccepted) &&
                                        // "text-muted-foreground line-through",
                                        isLocked &&
                                        "text-amber-600 font-medium",
                                    !isExported &&
                                        !isAccepted &&
                                        !isLocked &&
                                        "text-green-700 dark:text-green-400 font-medium"
                                )}
                            >
                                {oasisStatus}
                            </span>
                        </div>
                    );
                },
            },
        ],
        [disabled]
    );

    const table = useReactTable({
        data: assessments,
        columns,
        getRowId: (row) => row.id, // Use the assessment's natural key as row ID
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
        autoResetPageIndex: false,
        enableMultiRowSelection: false, // Disable multi-row selection
    });

    return (
        <TooltipProvider>
            <div className="space-y-4 w-full">
                <div className="flex w-full flex-wrap items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                        <div className="relative flex-1 min-w-[240px] max-w-lg">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search assessments..."
                                value={
                                    (table
                                        .getColumn("status_description")
                                        ?.getFilterValue() as string) ?? ""
                                }
                                onChange={(event) =>
                                    table
                                        .getColumn("status_description")
                                        ?.setFilterValue(event.target.value)
                                }
                                className="pl-10 pr-4 py-2 border-muted"
                                disabled={disabled}
                            />
                        </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                        {onRefresh && (
                            <RefreshButton
                                onRefresh={onRefresh}
                                tooltipText="Refresh assessments"
                                successMessage="Assessments refreshed"
                                errorMessage="Failed to refresh assessments"
                                disabled={disabled}
                            />
                        )}
                    </div>
                </div>

                {/* Status Legend */}
                {/* <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium">Status:</span>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 m-1 rounded-full bg-green-500"></div>
                            <span>Available</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Lock className="h-4 w-4 text-amber-600" />
                            <span>Locked</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <FileX className="h-4 w-4 text-muted-foreground" />
                            <span>Exported</span>
                        </div>
                    </div>
                </div> */}

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className={
                                                header.id === "select"
                                                    ? "w-[50px]"
                                                    : ""
                                            }
                                        >
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
                                <LoadingRow
                                    colSpan={columns.length}
                                    loadingText="Loading... This may take up to 30 seconds"
                                />
                            ) : error ? (
                                <ErrorRow
                                    colSpan={columns.length}
                                    message={error.message}
                                    onRetry={onRetry}
                                />
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => {
                                    const assessment = row.original;
                                    const isExported = isAssessmentExported(
                                        assessment.oasis
                                    );
                                    const isAccepted = isAssessmentAccepted(
                                        assessment.oasis
                                    );
                                    const isLocked = isAssessmentLocked(
                                        assessment.oasis
                                    );
                                    const isDisabled =
                                        disabled ||
                                        isAssessmentDisabled(assessment);

                                    return (
                                        <Tooltip key={row.id} delayDuration={0}>
                                            <TooltipTrigger asChild>
                                                <TableRow
                                                    className={cn(
                                                        isDisabled &&
                                                            "opacity-60 cursor-not-allowed",
                                                        // Check if this is the last row and conditionally remove border
                                                        row.id ===
                                                            table.getRowModel()
                                                                .rows[
                                                                table.getRowModel()
                                                                    .rows
                                                                    .length - 1
                                                            ]?.id &&
                                                            "border-b-0"
                                                        // !isDisabled &&
                                                        //     "cursor-pointer hover:bg-muted/50",
                                                        // isExported &&
                                                        //     "bg-muted/30",
                                                        // isLocked &&
                                                        //     "bg-amber-50 dark:bg-amber-950/20",
                                                        // !isExported &&
                                                        //     !isLocked &&
                                                        //     "bg-green-50/50 dark:bg-green-950/10"
                                                    )}
                                                    onClick={() => {
                                                        if (isDisabled) return;

                                                        if (
                                                            isExported ||
                                                            isAccepted
                                                        ) {
                                                            // Don't allow selection of exported or accepted assessments
                                                            return;
                                                        }

                                                        if (
                                                            isLocked &&
                                                            !row.getIsSelected()
                                                        ) {
                                                            // Show confirmation dialog for locked assessments only when selecting (not deselecting)
                                                            setLockedAssessmentDialog(
                                                                {
                                                                    isOpen: true,
                                                                    assessment,
                                                                }
                                                            );
                                                            return;
                                                        }

                                                        // Normal selection for unlocked assessments
                                                        // Clear all other selections first (single select)
                                                        setRowSelection({});
                                                        // Then select this row
                                                        row.toggleSelected(
                                                            true
                                                        );
                                                    }}
                                                >
                                                    {row
                                                        .getVisibleCells()
                                                        .map((cell) => (
                                                            <TableCell
                                                                key={cell.id}
                                                                className={
                                                                    cell.column
                                                                        .id ===
                                                                    "select"
                                                                        ? "w-[50px] h-[50px]"
                                                                        : ""
                                                                }
                                                            >
                                                                {flexRender(
                                                                    cell.column
                                                                        .columnDef
                                                                        .cell,
                                                                    cell.getContext()
                                                                )}
                                                            </TableCell>
                                                        ))}
                                                </TableRow>
                                            </TooltipTrigger>
                                            {(isExported ||
                                                isAccepted ||
                                                assessment.status_description ===
                                                    "Transfer" ||
                                                assessment.status_description ===
                                                    "Discharge") && (
                                                <TooltipContent>
                                                    <p className="max-w-xs">
                                                        {isExported
                                                            ? "This assessment has been exported. You can NOT enter an OASIS for an assessment that has been exported."
                                                            : isAccepted
                                                            ? "This assessment has been accepted. You can NOT enter an OASIS for an assessment that has been accepted."
                                                            : "This assessment type cannot be selected for OASIS entry."}
                                                    </p>
                                                </TooltipContent>
                                            )}
                                            {/* {isLocked && (
                                                <TooltipContent>
                                                    <p className="max-w-xs">
                                                        This assessment is
                                                        locked. Click to select
                                                        it - you'll be asked to
                                                        confirm before
                                                        proceeding.
                                                    </p>
                                                </TooltipContent>
                                            )} */}
                                        </Tooltip>
                                    );
                                })
                            ) : (
                                <EmptyRow
                                    colSpan={columns.length}
                                    message="No assessments found"
                                />
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Locked Assessment Confirmation Dialog */}
                <AlertDialog
                    open={lockedAssessmentDialog.isOpen}
                    onOpenChange={(open) =>
                        !open && handleLockedAssessmentCancel()
                    }
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                Assessment is Locked
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                The selected assessment is locked, submitting an
                                OASIS entry will unlock the assessment and make
                                changes to the OASIS summary. Are you sure you
                                want to proceed with your selection?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel
                                onClick={handleLockedAssessmentCancel}
                            >
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleLockedAssessmentConfirm}
                            >
                                Yes, proceed
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Pagination Controls */}
                <div className="flex items-center justify-end space-x-2 py-1">
                    <div className="flex-1 text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()} (
                        {table.getFilteredRowModel().rows.length} total rows)
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <ChevronLeft className="h-4 w-4 " />
                            Previous
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
