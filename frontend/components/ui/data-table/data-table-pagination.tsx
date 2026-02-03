import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
}

// Helper function to generate page numbers with ellipsis
function getPageNumbers(
    currentPage: number,
    totalPages: number,
    maxVisible: number = 5
): (number | "ellipsis")[] {
    if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [];
    const halfVisible = Math.floor(maxVisible / 2);

    if (currentPage <= halfVisible + 1) {
        // Show first pages
        for (let i = 1; i <= maxVisible - 1; i++) {
            pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
    } else if (currentPage >= totalPages - halfVisible) {
        // Show last pages
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - (maxVisible - 2); i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Show middle pages
        pages.push(1);
        pages.push("ellipsis");
        for (
            let i = currentPage - Math.floor((maxVisible - 4) / 2);
            i <= currentPage + Math.floor((maxVisible - 4) / 2);
            i++
        ) {
            pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
    }

    return pages;
}

export function DataTablePagination<TData>({
    table,
}: DataTablePaginationProps<TData>) {
    const currentPage = table.getState().pagination.pageIndex + 1;
    const totalPages = table.getPageCount();
    const pageSize = table.getState().pagination.pageSize;
    const totalRows = table.getFilteredRowModel().rows.length;
    const startRow =
        totalRows === 0 ? 0 : currentPage * pageSize - pageSize + 1;
    const endRow = Math.min(currentPage * pageSize, totalRows);

    const pageNumbers = getPageNumbers(currentPage, totalPages);

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                    Showing {startRow} to {endRow} of {totalRows} entries
                </p>
            </div>
            <div className="flex flex-col gap-10 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 w-full">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value));
                            table.setPageIndex(0);
                        }}
                    >
                        <SelectTrigger className=" w-[70px]">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[5, 7, 10, 20, 30, 50, 100].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {/* <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                        Page {currentPage} of {totalPages}
                    </p>
                </div> */}
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">
                                    Go to first page
                                </span>
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <PaginationPrevious
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            />
                        </PaginationItem>
                        {pageNumbers.map((page, index) => {
                            if (page === "ellipsis") {
                                return (
                                    <PaginationItem key={`ellipsis-${index}`}>
                                        <PaginationEllipsis />
                                    </PaginationItem>
                                );
                            }
                            return (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        onClick={() =>
                                            table.setPageIndex(page - 1)
                                        }
                                        isActive={currentPage === page}
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            );
                        })}
                        <PaginationItem>
                            <PaginationNext
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            />
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    table.setPageIndex(totalPages - 1)
                                }
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Go to last page</span>
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        </div>
    );
}
