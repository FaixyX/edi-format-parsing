import { Agency } from "@/types/agency";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { LinkCell } from "@/components/ui/data-table/link-cell";
import { LoadingRow } from "@/components/ui/data-table/loading-row";
import { ErrorRow } from "@/components/ui/data-table/error-row";
import { EmptyRow } from "@/components/ui/data-table/empty-row";
import { ActionMenu } from "@/components/ui/data-table/action-menu";
import { CopyableText } from "@/components/ui/data-table/copyable-text";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { ColumnVisibility } from "@/components/ui/data-table/column-visibility";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Eye, EyeOff } from "lucide-react";
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
    getFacetedRowModel,
    getFacetedUniqueValues,
    useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { UserRole } from "@/lib/auth";
import { loadTableVisibility } from "@/lib/utils";

interface AgencyTableProps {
    agencies: Agency[];
    isLoading: boolean;
    error: Error | null;
    onEdit: (agency: Agency) => void;
    onDelete: (agency: Agency) => void;
    onRetry: () => void;
    onAdd: () => void;
    showPassword: Record<string, boolean>;
    onTogglePassword: (id: string) => void;
    showAddButton?: boolean;
    showDeleteButton?: boolean;
    showSensitiveData?: boolean;
    userRole: UserRole | null;
    onRefresh?: () => Promise<any>;
}

export function AgencyTable({
    agencies,
    isLoading,
    error,
    onEdit,
    onDelete,
    onRetry,
    onAdd,
    showPassword,
    onTogglePassword,
    showAddButton = true,
    showDeleteButton = true,
    showSensitiveData = true,
    onRefresh,
}: AgencyTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");

    // Initialize column visibility from localStorage if available
    const tableId = "agency-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => {
            const savedVisibility = loadTableVisibility(tableId);
            return savedVisibility || {};
        });

    // Sort agencies alphabetically by name
    const sortedAgencies = React.useMemo(() => {
        return [...agencies].sort((a, b) => {
            return a.name.localeCompare(b.name);
        });
    }, [agencies]);

    const columns: ColumnDef<Agency>[] = React.useMemo(
        () => [
            {
                accessorKey: "name",
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
                            Name
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const agency = row.original;
                    return (
                        <div className="flex items-center">
                            <span className="font-medium">{agency.name}</span>
                        </div>
                    );
                },
            },
            {
                accessorKey: "link",
                header: "Link",
                cell: ({ row }) => {
                    const link = row.getValue("link") as string;
                    return <LinkCell href={link} />;
                },
            },
            {
                accessorKey: "npi",
                header: "NPI",
                cell: ({ row }) => {
                    const npi = row.getValue("npi") as string | null;
                    if (!npi) return <span>N/A</span>;
                    return <CopyableText text={npi} className="font-mono" />;
                },
            },
            ...(showSensitiveData
                ? [
                      {
                          accessorKey: "username",
                          header: "Username",
                          cell: ({
                              row,
                          }: {
                              row: { getValue: (key: string) => any };
                          }) => {
                              return (
                                  <CopyableText
                                      text={row.getValue("username")}
                                  />
                              );
                          },
                      },
                      {
                          accessorKey: "password",
                          header: "Password",
                          cell: ({ row }: { row: { original: Agency } }) => {
                              const agency = row.original;
                              return (
                                  <div className="flex items-center gap-4">
                                      <div className="w-16 truncate">
                                          {showPassword[agency.id] ? (
                                              <CopyableText
                                                  text={agency.password}
                                              />
                                          ) : (
                                              <CopyableText
                                                  text={agency.password}
                                                  displayText="••••••••"
                                                  className="font-mono"
                                              />
                                          )}
                                      </div>
                                      <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                              onTogglePassword(agency.id)
                                          }
                                      >
                                          {showPassword[agency.id] ? (
                                              <EyeOff className="h-4 w-4" />
                                          ) : (
                                              <Eye className="h-4 w-4" />
                                          )}
                                      </Button>
                                  </div>
                              );
                          },
                      },
                  ]
                : []),
            {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => {
                    const agency = row.original;
                    return (
                        <ActionMenu
                            onEdit={(e) => {
                                e.stopPropagation();
                                onEdit(agency);
                            }}
                            onDelete={
                                showDeleteButton
                                    ? (e) => {
                                          e.stopPropagation();
                                          onDelete(agency);
                                      }
                                    : undefined
                            }
                            editLabel="Edit agency"
                            deleteLabel="Delete agency"
                        />
                    );
                },
            },
        ],
        [
            showPassword,
            onTogglePassword,
            onEdit,
            onDelete,
            showDeleteButton,
            showSensitiveData,
        ]
    );

    const table = useReactTable({
        data: sortedAgencies,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize: 7,
            },
        },
    });

    return (
        <div className="space-y-4 w-full">
            <div className="flex w-full flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
                    <div className="relative flex-1 min-w-[240px] max-w-lg">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search agency names..."
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
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    {onRefresh && (
                        <RefreshButton
                            onRefresh={onRefresh}
                            tooltipText="Refresh agencies"
                            successMessage="Agencies refreshed"
                            errorMessage="Failed to refresh agencies"
                        />
                    )}
                    {showAddButton && (
                        <Button onClick={onAdd}>
                            <Plus className="h-4 w-4" />
                            Add Agency
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
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
                        ) : table.getRowModel().rows.length === 0 ? (
                            <EmptyRow
                                colSpan={columns.length}
                                message="No agencies found"
                            />
                        ) : (
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
                        )}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination table={table} />
        </div>
    );
}
