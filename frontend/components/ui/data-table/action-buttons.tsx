import { TooltipButton } from "@/components/ui/tooltip-button";
import { Pencil, Trash, RotateCw } from "lucide-react";
import { MouseEvent } from "react";

interface ActionButtonsProps {
    onEdit?: (e: MouseEvent<HTMLButtonElement>) => void;
    onDelete?: (e: MouseEvent<HTMLButtonElement>) => void;
    onRetry?: (e: MouseEvent<HTMLButtonElement>) => void;
    editTooltip?: string;
    deleteTooltip?: string;
    retryTooltip?: string;
    disabled?: boolean;
    showDelete?: boolean;
    showRetry?: boolean;
}

export function ActionButtons({
    onEdit,
    onDelete,
    onRetry,
    editTooltip = "Edit",
    deleteTooltip = "Delete",
    retryTooltip = "Retry",
    disabled = false,
    showDelete = true,
    showRetry = false,
}: ActionButtonsProps) {
    return (
        <div className="flex items-center gap-2">
            {onEdit && (
                <TooltipButton
                    variant="ghost"
                    size="icon"
                    onClick={onEdit}
                    disabled={disabled}
                    tooltipText={editTooltip}
                >
                    <Pencil className="h-4 w-4" />
                </TooltipButton>
            )}
            {onDelete && showDelete && (
                <TooltipButton
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    disabled={disabled}
                    tooltipText={deleteTooltip}
                >
                    <Trash className="h-4 w-4" />
                </TooltipButton>
            )}
            {onRetry && showRetry && (
                <TooltipButton
                    variant="ghost"
                    size="icon"
                    onClick={onRetry}
                    disabled={disabled}
                    tooltipText={retryTooltip}
                >
                    <RotateCw className="h-4 w-4" />
                </TooltipButton>
            )}
        </div>
    );
}
