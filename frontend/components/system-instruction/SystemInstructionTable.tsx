import { SystemInstruction } from "@/types/system_instruction";
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
import { StatusToggle } from "@/components/ui/data-table/status-toggle";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { ColumnVisibility } from "@/components/ui/data-table/column-visibility";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Search,
    Plus,
    ChevronLeft,
    ChevronRight,
    Key,
    FileText,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { loadTableVisibility } from "@/lib/utils";

interface SystemInstructionTableProps {
    instructions: SystemInstruction[];
    isLoading: boolean;
    error: Error | null;
    onEdit: (instruction: SystemInstruction) => void;
    onDelete: (instruction: SystemInstruction) => void;
    onView: (instruction: SystemInstruction) => void;
    onRetry: () => void;
    onAdd: () => void;
    onToggleStatus: (id: string, is_active: boolean) => void;
    isTogglingStatus: (id: string) => boolean;
    onRefresh?: () => Promise<any>;
}

export function SystemInstructionTable({
    instructions,
    isLoading,
    error,
    onEdit,
    onDelete,
    onView,
    onRetry,
    onAdd,
    onToggleStatus,
    isTogglingStatus,
    onRefresh,
}: SystemInstructionTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    const tableId = "system-instruction-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => loadTableVisibility(tableId));

    const columns: ColumnDef<SystemInstruction>[] = [
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
                        Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="font-medium flex items-center gap-2">
                    {row.original.use_prompt_id ? (
                        <Key className="h-4 w-4 text-purple-500" />
                    ) : (
                        <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    <span>{row.getValue("name")}</span>
                </div>
            ),
        },
        {
            accessorKey: "type",
            header: "Type",
            cell: ({ row }) => {
                const instruction = row.original;
                return (
                    <div className="flex items-center">
                        {instruction.use_prompt_id ? (
                            <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
                            >
                                OpenAI Prompt
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                            >
                                Manual
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "model_id",
            header: "Model",
            cell: ({ row }) => {
                const model_id = row.getValue("model_id") as string | undefined;
                return (
                    <div className="truncate max-w-sm">
                        {model_id || "Default (gpt-4o)"}
                    </div>
                );
            },
        },
        {
            accessorKey: "description",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Description
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => {
                const description = row.getValue("description") as
                    | string
                    | null;
                return (
                    <div className="truncate max-w-sm">
                        {description || "No description"}
                    </div>
                );
            },
        },
        {
            accessorKey: "is_active",
            header: "Status",
            cell: ({ row }) => {
                const instruction = row.original;
                return (
                    <StatusToggle
                        enabled={instruction.is_active}
                        onToggle={() =>
                            onToggleStatus(
                                instruction.id,
                                !instruction.is_active
                            )
                        }
                        isLoading={isTogglingStatus(instruction.id)}
                    />
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            enableHiding: false,
            cell: ({ row }) => {
                const instruction = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <ActionMenu
                            onEdit={(e) => {
                                e.stopPropagation();
                                onEdit(instruction);
                            }}
                            onDelete={(e) => {
                                e.stopPropagation();
                                onDelete(instruction);
                            }}
                            editLabel="Edit instruction"
                            deleteLabel="Delete instruction"
                            disabled={false}
                        />
                    </div>
                );
            },
        },
    ];

    const table = useReactTable({
        data: instructions,
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
                pageSize: 7,
            },
        },
        autoResetPageIndex: false,
    });

    return (
        <div className="space-y-4 w-full">
            <div className="flex w/full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    <div className="relative flex-1 min-w-[240px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search instructions..."
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
                            tableId="system-instruction-table"
                        />
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    {onRefresh && (
                        <RefreshButton
                            onRefresh={onRefresh}
                            tooltipText="Refresh instructions"
                            successMessage="Instructions refreshed"
                            errorMessage="Failed to refresh instructions"
                        />
                    )}
                    <Button onClick={onAdd}>
                        <Plus className="h-4 w-4" />
                        Add Instruction
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
                                                ? "w-[140px]"
                                                : header.id === "default"
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
                                    className={cn(
                                        !row.original.is_active && "opacity-50"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={
                                                cell.column.id === "actions"
                                                    ? "w-[140px]"
                                                    : cell.column.id ===
                                                      "default"
                                                    ? "w-[120px]"
                                                    : ""
                                            }
                                            onClick={() => {
                                                if (
                                                    cell.column.id !==
                                                        "actions" &&
                                                    cell.column.id !==
                                                        "is_active"
                                                ) {
                                                    onView(row.original);
                                                }
                                            }}
                                        >
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
                                message="No system instructions found"
                                actionLabel="Add Instruction"
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
