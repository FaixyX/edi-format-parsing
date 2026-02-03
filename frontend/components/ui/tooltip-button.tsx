import * as React from "react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ButtonProps } from "@/components/ui/button";

interface TooltipButtonProps extends ButtonProps {
    tooltipText: string;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

const TooltipButton = React.forwardRef<HTMLButtonElement, TooltipButtonProps>(
    ({ tooltipText, children, className, disabled = false, ...props }, ref) => {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className={cn(
                                "transition-all aspect-square",
                                disabled && "cursor-not-allowed opacity-50",
                                className
                            )}
                            disabled={disabled}
                            ref={ref}
                            {...props}
                        >
                            {children}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipText}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
);
TooltipButton.displayName = "TooltipButton";

export { TooltipButton };
