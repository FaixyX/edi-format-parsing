import { User } from "@/types/user";
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
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
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

interface UserTableProps {
    users: User[];
    isLoading: boolean;
    error: Error | null;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onRetry: () => void;
    onAdd: () => void;
    onToggleStatus: (id: string, enabled: boolean) => void;
    isTogglingStatus: (id: string) => boolean;
    onRefresh?: () => Promise<any>;
}

export function UserTable({
    users,
    isLoading,
    error,
    onEdit,
    onDelete,
    onRetry,
    onAdd,
    onToggleStatus,
    isTogglingStatus,
    onRefresh,
}: UserTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);

    const tableId = "user-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => loadTableVisibility(tableId));

    const columns: ColumnDef<User>[] = [
        {
            accessorKey: "username",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Username
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => (
                <div className="font-medium">{row.getValue("username")}</div>
            ),
        },
        {
            accessorKey: "type",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            column.toggleSorting(column.getIsSorted() === "asc")
                        }
                        className="p-0 hover:bg-transparent"
                    >
                        Type
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                );
            },
            cell: ({ row }) => <div>{row.getValue("type")}</div>,
        },
        {
            accessorKey: "enabled",
            header: "Status",
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <StatusToggle
                        enabled={user.enabled}
                        onToggle={() =>
                            onToggleStatus(user.id.toString(), !user.enabled)
                        }
                        disabled={user.protected}
                        isLoading={isTogglingStatus(user.id.toString())}
                    />
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            enableHiding: false,
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <ActionMenu
                        onEdit={(e) => {
                            e.stopPropagation();
                            onEdit(user);
                        }}
                        onDelete={(e) => {
                            e.stopPropagation();
                            onDelete(user);
                        }}
                        editLabel="Edit user"
                        deleteLabel="Delete user"
                        disabled={user.protected}
                    />
                );
            },
        },
    ];

    const table = useReactTable({
        data: users,
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
                            placeholder="Search users..."
                            value={
                                (table
                                    .getColumn("username")
                                    ?.getFilterValue() as string) ?? ""
                            }
                            onChange={(event) =>
                                table
                                    .getColumn("username")
                                    ?.setFilterValue(event.target.value)
                            }
                            className="pl-10 pr-4 py-2 border-muted"
                        />
                    </div>
                    <div className="flex-shrink-0">
                        <ColumnVisibility table={table} tableId="user-table" />
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    {onRefresh && (
                        <RefreshButton
                            onRefresh={onRefresh}
                            tooltipText="Refresh users"
                            successMessage="Users refreshed"
                            errorMessage="Failed to refresh users"
                        />
                    )}
                    <Button onClick={onAdd}>
                        <Plus className="h-4 w-4" />
                        Add User
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
                                                ? "w-[100px]"
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
                                        !row.original.enabled && "opacity-50"
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className={
                                                cell.column.id === "actions"
                                                    ? "w-[100px]"
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
                                message="No users found"
                                actionLabel="Add User"
                                onAction={onAdd}
                            />
                        )}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination table={table} />
        </div>
    );
}
