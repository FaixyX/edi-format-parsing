import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import * as React from "react";

interface StatusToggleProps {
    enabled: boolean;
    onToggle: (event: React.MouseEvent) => void;
    isLoading?: boolean;
    disabled?: boolean;
}

export function StatusToggle({
    enabled,
    onToggle,
    isLoading,
    disabled,
}: StatusToggleProps) {
    // Create a wrapper function that stops propagation before calling onToggle
    const handleToggle = React.useCallback(
        (event: React.MouseEvent) => {
            event.stopPropagation();
            onToggle(event);
        },
        [onToggle]
    );

    return (
        <div onClick={(e) => e.stopPropagation()}>
            <Switch
                checked={enabled}
                onCheckedChange={() => {}}
                onClick={handleToggle}
                disabled={disabled || isLoading}
                className={cn("data-[state=checked]:bg-primary")}
            />
        </div>
    );
}
