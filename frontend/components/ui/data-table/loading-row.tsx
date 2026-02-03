import { TableCell, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface LoadingRowProps {
    colSpan: number;
    loadingText?: string;
}

export function LoadingRow({ colSpan, loadingText }: LoadingRowProps) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan}>
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    {loadingText && (
                        <p className="text-sm text-muted-foreground">
                            {loadingText}
                        </p>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
