import { PdfTemplate } from "@/types/pdfTemplate";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { FormRecognizers } from "@threeveloper/azure-react-icons";
import { LoadingRow } from "@/components/ui/data-table/loading-row";
import { ErrorRow } from "@/components/ui/data-table/error-row";
import { EmptyRow } from "@/components/ui/data-table/empty-row";
import { ActionMenu } from "@/components/ui/data-table/action-menu";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { ColumnVisibility } from "@/components/ui/data-table/column-visibility";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Search,
    Plus,
    Settings,
    ChevronLeft,
    ChevronRight,
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
import { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";
import { loadTableVisibility } from "@/lib/utils";

interface PdfTemplateTableProps {
    templates: PdfTemplate[];
    isLoading: boolean;
    error: Error | null;
    onEdit: (template: PdfTemplate) => void;
    onDelete: (template: PdfTemplate) => void;
    onManageRules: (template: PdfTemplate) => void;
    onRetry: () => void;
    onAdd: () => void;
    onOpenStudio: () => void;
    onRefresh?: () => Promise<any>;
}

export function PdfTemplateTable({
    templates,
    isLoading,
    error,
    onEdit,
    onDelete,
    onManageRules,
    onRetry,
    onAdd,
    onOpenStudio,
    onRefresh,
}: PdfTemplateTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    const tableId = "pdf-template-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => loadTableVisibility(tableId));

    const getStatusVariant = (
        status: string
    ): VariantProps<typeof badgeVariants>["variant"] => {
        switch (status) {
            case "disabled":
                return "destructive";
            case "in training":
                return "training";
            case "beta":
                return "beta";
            case "stable":
                return "stable";
            default:
                return "disabled";
        }
    };

    const columns: ColumnDef<PdfTemplate>[] = [
        {
            accessorKey: "pdfType",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        PDF Type
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="font-medium">{row.getValue("pdfType")}</div>
            ),
        },
        {
            accessorKey: "modelId",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Model ID
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div>{row.getValue("modelId")}</div>,
        },
        {
            accessorKey: "status",
            header: ({ column }) => {
                return (
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
                );
            },
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                return (
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            enableHiding: false,
            cell: ({ row }) => {
                const template = row.original;
                return (
                    <ActionMenu
                        onEdit={(e) => {
                            e.stopPropagation();
                            onEdit(template);
                        }}
                        onDelete={(e) => {
                            e.stopPropagation();
                            onDelete(template);
                        }}
                        editLabel="Edit template"
                        deleteLabel="Delete template"
                        additionalActions={[
                            {
                                label: "Manage Rules",
                                icon: <Settings className="h-4 w-4" />,
                                onClick: (e) => {
                                    e.stopPropagation();
                                    onManageRules(template);
                                },
                            },
                        ]}
                    />
                );
            },
        },
    ];

    const table = useReactTable({
        data: templates,
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
            <div className="flex w-full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    <div className="relative flex-1 min-w-[240px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search templates..."
                            value={
                                (table
                                    .getColumn("pdfType")
                                    ?.getFilterValue() as string) ?? ""
                            }
                            onChange={(event) =>
                                table
                                    .getColumn("pdfType")
                                    ?.setFilterValue(event.target.value)
                            }
                            className="pl-10 pr-4 py-2 border-muted"
                        />
                    </div>
                    <div className="flex-shrink-0">
                        <ColumnVisibility
                            table={table}
                            tableId="pdf-template-table"
                        />
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    {onRefresh && (
                        <RefreshButton
                            onRefresh={onRefresh}
                            tooltipText="Refresh templates"
                            successMessage="Templates refreshed"
                            errorMessage="Failed to refresh templates"
                        />
                    )}
                    <Button onClick={onOpenStudio} variant="azure-dark">
                        <FormRecognizers className="h-4 w-4" />
                        Open Document Intelligence Studio
                    </Button>
                    <Button onClick={onAdd}>
                        <Plus className="h-4 w-4" />
                        Add Template
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
                                                ? "w-[220px]"
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
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={
                                                cell.column.id === "actions"
                                                    ? "w-[220px]"
                                                    : ""
                                            }
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
                                message="No templates found."
                            />
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
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
