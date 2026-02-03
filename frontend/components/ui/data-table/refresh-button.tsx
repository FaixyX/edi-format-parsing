import { useState, forwardRef } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { toast } from "sonner";
import { RefetchOptions } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
    onRefresh:
        | ((options?: RefetchOptions) => Promise<any>)
        | (() => Promise<boolean> | Promise<void>);
    tooltipText?: string;
    successMessage?: string;
    errorMessage?: string;
    disabled?: boolean;
    className?: string;
    showToasts?: boolean;
}

export const RefreshButton = forwardRef<HTMLButtonElement, RefreshButtonProps>(
    (
        {
            onRefresh,
            tooltipText = "Refresh",
            successMessage = "Refreshed successfully",
            errorMessage = "Failed to refresh",
            disabled = false,
            className,
            showToasts = true,
        },
        ref
    ) => {
        const [isLoading, setIsLoading] = useState(false);
        const [success, setSuccess] = useState(false);
        const [error, setError] = useState(false);

        const handleRefresh = async () => {
            setIsLoading(true);
            setSuccess(false);
            setError(false);

            try {
                const result = await onRefresh();

                // Handle React Query result
                if (
                    result &&
                    typeof result === "object" &&
                    "isSuccess" in result
                ) {
                    setSuccess(result.isSuccess);
                    if (result.isSuccess && showToasts) {
                        toast.success(successMessage);
                    } else if (!result.isSuccess) {
                        setError(true);
                        if (showToasts) {
                            toast.error(errorMessage);
                        }
                    }
                }
                // Handle boolean or void result
                else {
                    // If onRefresh returns a boolean, use it to determine success
                    const isSuccess = result === undefined ? true : !!result;
                    setSuccess(isSuccess);
                    if (isSuccess && showToasts) {
                        toast.success(successMessage);
                    } else if (!isSuccess) {
                        setError(true);
                        if (showToasts) {
                            toast.error(errorMessage);
                        }
                    }
                }
            } catch {
                setError(true);
                if (showToasts) {
                    toast.error(errorMessage);
                }
            } finally {
                setIsLoading(false);

                // Reset success/error state after 2 seconds
                setTimeout(() => {
                    setSuccess(false);
                    setError(false);
                }, 2000);
            }
        };

        return (
            <TooltipButton
                ref={ref}
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                tooltipText={tooltipText}
                disabled={disabled || isLoading}
                className={cn(
                    "ring-1 ring-muted",
                    success
                        ? "ring-1 ring-green-600"
                        : error
                        ? "ring-1 text-red-600"
                        : "",
                    className
                )}
            >
                {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                ) : success ? (
                    <Check className="h-4 w-4 text-green-600" />
                ) : error ? (
                    <AlertCircle className="h-4 w-4" />
                ) : (
                    <RefreshCw className="h-4 w-4" />
                )}
            </TooltipButton>
        );
    }
);

RefreshButton.displayName = "RefreshButton";
