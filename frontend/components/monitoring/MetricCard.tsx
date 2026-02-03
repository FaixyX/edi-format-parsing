"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color: "blue" | "purple" | "green" | "orange" | "red";
    className?: string;
    isLargeValue?: boolean;
    tooltip?: string;
}

const colorVariants = {
    blue: {
        value: "text-blue-600 dark:text-blue-400",
        icon: "text-blue-600",
        bg: "bg-blue-100 dark:bg-blue-900/20",
    },
    purple: {
        value: "text-purple-600 dark:text-purple-400",
        icon: "text-purple-600",
        bg: "bg-purple-100 dark:bg-purple-900/20",
    },
    green: {
        value: "text-green-600 dark:text-green-400",
        icon: "text-green-600",
        bg: "bg-green-100 dark:bg-green-900/20",
    },
    orange: {
        value: "text-orange-600 dark:text-orange-400",
        icon: "text-orange-600",
        bg: "bg-orange-100 dark:bg-orange-900/20",
    },
    red:{
        value:"text-red-600 dark text-red-400",
        icon: "text-red-600",
        bg: "bg-red-100 dark:bg-red-900/20",
    }
};

export function MetricCard({
    label,
    value,
    icon: Icon,
    color,
    className,
    isLargeValue = true,
    tooltip,
}: MetricCardProps) {
    const colors = colorVariants[color];

    const cardContent = (
        <Card className={className}>
            <CardContent className="p-4 h-full">
                <div className="flex items-center justify-between h-full">
                    <div className="space-y-1 min-w-0 flex flex-col justify-between h-full">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p
                            className={cn(
                                "tracking-tight truncate",
                                isLargeValue
                                    ? "text-2xl font-bold"
                                    : "font-mono",
                                colors.value
                            )}
                        >
                            {value}
                        </p>
                    </div>
                    <div
                        className={cn("rounded-lg p-2", colors.bg, colors.icon)}
                    >
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
                    <TooltipContent className="max-w-sm text-center">
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return cardContent;
}
