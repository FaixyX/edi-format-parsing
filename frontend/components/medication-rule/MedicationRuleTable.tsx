import { MedicationRule } from "@/types/medicationRule";
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
import { ActionMenu } from "@/components/ui/data-table/action-menu";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { ColumnVisibility } from "@/components/ui/data-table/column-visibility";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
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
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { loadTableVisibility } from "@/lib/utils";

import { ExcelCellsList } from "../rule/table/ExcelCellsList";
import { LlmDetailsCell } from "../rule/table/LlmDetailsCell";
import { MedicationRuleTypeCell } from "./table/MedicationRuleTypeCell";

interface MedicationRuleTableProps {
    rules: MedicationRule[];
    isLoading: boolean;
    error: Error | null;
    onEdit: (rule: MedicationRule) => void;
    onDelete: (rule: MedicationRule) => void;
    onRetry: () => void;
    onAdd: () => void;
    onRefresh?: () => Promise<any>;
}

export function MedicationRuleTable({
    rules,
    isLoading,
    error,
    onEdit,
    onDelete,
    onRetry,
    onAdd,
    onRefresh,
}: MedicationRuleTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    const tableId = "medication-rule-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => loadTableVisibility(tableId));

    const [expandedRows, setExpandedRows] = React.useState<
        Record<string, boolean>
    >({});

    const toggleRowExpand = (rowId: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [rowId]: !prev[rowId],
        }));
    };

    const columns: ColumnDef<MedicationRule>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Rule Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="font-medium">{row.getValue("name")}</div>
            ),
        },
        {
            accessorKey: "rule_type",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Rule Type
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <MedicationRuleTypeCell type={row.getValue("rule_type")} />
            ),
        },
        {
            accessorKey: "llm_details",
            header: "LLM Details",
            cell: ({ row }) => <LlmDetailsCell rule={row.original as any} />,
        },
        {
            accessorKey: "excel_cells",
            header: "Excel Cells",
            cell: ({ row }) => {
                const cells = row.original.excel_cells;
                const isExpanded = expandedRows[row.id + "-cells"] || false;
                return (
                    <ExcelCellsList
                        cells={cells}
                        rowId={row.id + "-cells"}
                        isExpanded={isExpanded}
                        onToggleExpand={toggleRowExpand}
                        badgeClassName="text-xs bg-blue-50"
                    />
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            enableHiding: false,
            cell: ({ row }) => {
                const rule = row.original;
                return (
                    <ActionMenu
                        onEdit={(e) => {
                            e.stopPropagation();
                            onEdit(rule);
                        }}
                        onDelete={(e) => {
                            e.stopPropagation();
                            onDelete(rule);
                        }}
                        editLabel="Edit rule"
                        deleteLabel="Delete rule"
                    />
                );
            },
        },
    ];

    const table = useReactTable({
        data: rules,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        initialState: {
            pagination: {
                pageSize: 5,
            },
        },
        autoResetPageIndex: false,
    });

    return (
        <div className="space-y-4 w-full">
            <div className="flex w-full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    <div className="relative flex-1 min-w-[240px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search rules..."
                            value={
                                (table
                                    .getColumn("name")
                                    ?.getFilterValue() as string) ?? ""
                            }
                            onChange={(event) =>
                                table
                                    .getColumn("name")
                                    ?.setFilterValue(event.target.value)
                            }
                            className="pl-10 pr-4 py-2 border-muted"
                        />
                    </div>
                    <div className="flex-shrink-0">
                        <ColumnVisibility
                            table={table}
                            tableId="medication-rule-table"
                        />
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    {onRefresh && (
                        <RefreshButton
                            onRefresh={onRefresh}
                            tooltipText="Refresh medication rules"
                            successMessage="Medication rules refreshed"
                            errorMessage="Failed to refresh medication rules"
                        />
                    )}
                    <Button onClick={onAdd}>
                        <Plus className="h-4 w-4" />
                        Add Rule
                    </Button>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead
                                        key={header.id}
                                        className={
                                            header.id === "actions"
                                                ? "w-[120px]"
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
                                    data-state={
                                        row.getIsSelected() && "selected"
                                    }
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
                                message="No rules found"
                                actionLabel="Add Rule"
                                onAction={onAdd}
                            />
                        )}
                    </TableBody>
                </Table>
            </div>

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
    );
}
