import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pencil, Trash, RotateCw, MoreVertical } from "lucide-react";
import { MouseEvent } from "react";

interface ActionMenuProps {
    onEdit?: (e: MouseEvent<HTMLDivElement>) => void;
    onDelete?: (e: MouseEvent<HTMLDivElement>) => void;
    onRetry?: (e: MouseEvent<HTMLDivElement>) => void;
    editLabel?: string;
    deleteLabel?: string;
    retryLabel?: string;
    disabled?: boolean;
    showDelete?: boolean;
    showRetry?: boolean;
    additionalActions?: Array<{
        label: string;
        icon?: React.ReactNode;
        onClick: (e: MouseEvent<HTMLDivElement>) => void;
        variant?: "default" | "destructive";
    }>;
}

export function ActionMenu({
    onEdit,
    onDelete,
    onRetry,
    editLabel = "Edit",
    deleteLabel = "Delete",
    retryLabel = "Retry",
    disabled = false,
    showDelete = true,
    showRetry = false,
    additionalActions = [],
}: ActionMenuProps) {
    const hasActions =
        onEdit ||
        (onDelete && showDelete) ||
        (onRetry && showRetry) ||
        additionalActions.length > 0;

    if (!hasActions) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
            >
                {onEdit && (
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(e);
                        }}
                        disabled={disabled}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        {editLabel}
                    </DropdownMenuItem>
                )}
                {onRetry && showRetry && (
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            onRetry(e);
                        }}
                        disabled={disabled}
                    >
                        <RotateCw className="mr-2 h-4 w-4" />
                        {retryLabel}
                    </DropdownMenuItem>
                )}
                {additionalActions.map((action, index) => (
                    <DropdownMenuItem
                        key={index}
                        onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(e);
                        }}
                        disabled={disabled}
                        className={
                            action.variant === "destructive"
                                ? "text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-500/10 dark:focus:bg-red-500/20"
                                : ""
                        }
                    >
                        {action.icon && (
                            <span className="mr-2 flex items-center justify-center h-4 w-4">
                                {action.icon}
                            </span>
                        )}
                        {action.label}
                    </DropdownMenuItem>
                ))}
                {onDelete && showDelete && (
                    <>
                        {(onEdit ||
                            (onRetry && showRetry) ||
                            additionalActions.length > 0) && (
                            <DropdownMenuSeparator />
                        )}
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(e);
                            }}
                            disabled={disabled}
                            className="text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-500/10 dark:focus:bg-red-500/20"
                        >
                            <Trash className="mr-2 h-4 w-4" />
                            {deleteLabel}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
