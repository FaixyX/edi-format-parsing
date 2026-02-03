import { PatientEpisode } from "@/types/patientEpisode";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Hash,
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
import { loadTableVisibility } from "@/lib/utils";
import { Button } from "../ui/button";
import { AgencySelector } from "../agency/AgencySelector";

interface PatientEpisodeTableProps {
    episodes: PatientEpisode[];
    isLoading: boolean;
    error: Error | null;
    onRetry: () => void;
    onRefresh: () => Promise<void>;
    isSyncing: boolean;
    selectedAgencyId: string;
    onSelectAgency: (agencyId: string) => void;
}

export function PatientEpisodeTable({
    episodes,
    isLoading,
    error,
    onRetry,
    onRefresh,
    isSyncing,
    selectedAgencyId,
    onSelectAgency,
}: PatientEpisodeTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");

    // Initialize column visibility from localStorage if available
    const tableId = "patient-episode-table";
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>(() => {
            return loadTableVisibility(tableId);
        });

    const columns: ColumnDef<PatientEpisode>[] = React.useMemo(
        () => [
            {
                accessorKey: "code",
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
                            Code
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => (
                    <div className="font-medium font-mono">
                        {row.getValue("code")}
                    </div>
                ),
            },
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
                cell: ({ row }) => (
                    <div className="font-medium">{row.getValue("name")}</div>
                ),
            },
            {
                accessorKey: "mrn",
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
                            MRN
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => (
                    <div className="font-mono text-sm">
                        {row.getValue("mrn")}
                    </div>
                ),
            },
            {
                accessorKey: "start_of_care",
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
                            Start of Care
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const startOfCare = row.getValue("start_of_care") as
                        | string
                        | null;
                    return (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {startOfCare
                                    ? new Date(
                                          startOfCare + "Z"
                                      ).toLocaleDateString()
                                    : "N/A"}
                            </span>
                        </div>
                    );
                },
            },
            {
                accessorKey: "discharge_date",
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
                            Discharge Date
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const dischargeDate = row.getValue("discharge_date") as
                        | string
                        | null;
                    return (
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {dischargeDate
                                    ? new Date(
                                          dischargeDate + "Z"
                                      ).toLocaleDateString()
                                    : "N/A"}
                            </span>
                        </div>
                    );
                },
            },
            {
                accessorKey: "last_synced",
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
                            Last Synced
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    );
                },
                cell: ({ row }) => {
                    const lastSynced = row.getValue("last_synced") as string;
                    const date = new Date(lastSynced + "Z");
                    return (
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-muted-foreground" />
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
            {
                accessorKey: "status",
                header: "Status",
                cell: ({ row }) => {
                    const episode = row.original;
                    const now = new Date();
                    const startOfCare = episode.start_of_care
                        ? new Date(episode.start_of_care)
                        : null;
                    const dischargeDate = episode.discharge_date
                        ? new Date(episode.discharge_date)
                        : null;

                    let status = "Unknown";
                    let variant:
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline" = "default";

                    if (dischargeDate && now > dischargeDate) {
                        status = "Discharged";
                        variant = "destructive";
                    } else if (startOfCare && now >= startOfCare) {
                        status = "Active";
                        variant = "default";
                    } else if (startOfCare && now < startOfCare) {
                        status = "Pending";
                        variant = "secondary";
                    } else {
                        status = "No Dates";
                        variant = "outline";
                    }

                    return (
                        <Badge variant={variant} className="text-xs">
                            {status}
                        </Badge>
                    );
                },
            },
        ],
        []
    );

    const table = useReactTable({
        data: episodes,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: (row, columnId, filterValue) => {
            const searchValue = filterValue.toLowerCase();
            const episode = row.original;

            // Search across code, name, and MRN
            return (
                episode.code.toLowerCase().includes(searchValue) ||
                episode.name.toLowerCase().includes(searchValue) ||
                episode.mrn.toLowerCase().includes(searchValue)
            );
        },
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
        },
        initialState: {
            pagination: {
                pageSize: 10,
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
                            placeholder="Search episodes..."
                            value={table.getState().globalFilter ?? ""}
                            onChange={(event) => {
                                setGlobalFilter(event.target.value);
                            }}
                            className="pl-10 pr-4 py-2 border-muted"
                        />
                    </div>
                    <div className="flex-shrink-0">
                        <ColumnVisibility
                            table={table}
                            tableId="patient-episode-table"
                        />
                    </div>
                    <div className="flex-shrink-0 min-w-[220px]">
                        <AgencySelector
                            selectedAgencyId={selectedAgencyId}
                            onSelectAgency={onSelectAgency}
                            placeholder="Select agency..."
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="ml-auto flex flex-wrap items-start gap-2 self-start">
                    <RefreshButton
                        onRefresh={onRefresh}
                        tooltipText="Sync patient episodes"
                        successMessage="Patient episodes synced successfully"
                        errorMessage="Failed to sync patient episodes"
                        disabled={isSyncing}
                        showToasts={false}
                    />
                </div>
            </div>

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
                        {!selectedAgencyId ? (
                            <EmptyRow
                                colSpan={columns.length}
                                message="Please select an agency to view patient episodes"
                            />
                        ) : isLoading ? (
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
                                message="No patient episodes found"
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
