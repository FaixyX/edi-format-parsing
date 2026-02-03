import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { FolderOpen } from "lucide-react";

interface EmptyRowProps {
    colSpan: number;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyRow({
    colSpan,
    message,
    actionLabel,
    onAction,
}: EmptyRowProps) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan}>
                <div className="flex items-center flex-col justify-center gap-3 p-4 text-muted-foreground">
                    <FolderOpen className="h-8 w-8" />
                    <div className="flex justify-center align-middle">
                        <p className="font-medium">
                            {message}{" "}
                            {onAction && (
                                <>
                                    <Button
                                        variant="link"
                                        onClick={onAction}
                                        className="font-semibold px-0"
                                    >
                                        {actionLabel}
                                    </Button>{" "}
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}
