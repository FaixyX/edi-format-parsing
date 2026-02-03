import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect } from "react";
import { saveTableVisibility } from "@/lib/utils";

interface ColumnVisibilityProps<TData> {
    table: Table<TData>;
    tableId?: string; // Optional ID to distinguish between different tables
}

export function ColumnVisibility<TData>({
    table,
    tableId = "default",
}: ColumnVisibilityProps<TData>) {
    // Save visibility state when it changes
    const columnVisibility = table.getState().columnVisibility;
    
    useEffect(() => {
        saveTableVisibility(tableId, columnVisibility);
    }, [columnVisibility, tableId]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="">
                    Columns <ChevronDown className=" h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {table
                    .getAllColumns()
                    .filter((column) => column.getCanHide())
                    .map((column) => {
                        return (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) => {
                                    column.toggleVisibility(!!value);
                                }}
                            >
                                {column.id}
                            </DropdownMenuCheckboxItem>
                        );
                    })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
