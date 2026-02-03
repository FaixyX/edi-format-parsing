import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

interface ErrorRowProps {
    colSpan: number;
    message: string;
    onRetry?: () => void;
}

export function ErrorRow({ colSpan, message, onRetry }: ErrorRowProps) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan}>
                <div className="flex items-center justify-center gap-1 text-red-500 p-4">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">
                        {message}
                        {onRetry && ". "}
                    </p>
                    {onRetry && (
                        <Button
                            variant="link"
                            onClick={onRetry}
                            className="text-red-500 font-semibold px-0"
                        >
                            {" "}
                            Retry
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
