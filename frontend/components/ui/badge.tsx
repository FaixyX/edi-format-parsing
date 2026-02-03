import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground",
                outline: "text-foreground",
                disabled: "border-transparent bg-gray-500 text-white",
                training: "border-transparent bg-amber-500 text-white",
                beta: "border-transparent bg-blue-600 text-white",
                stable: "border-transparent bg-green-600 text-white",
                // Status badges for monitoring
                pending:
                    "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                processing:
                    "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                completed:
                    "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                failed: "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                cell: "bg-green-300 border-green-500 text-green-500",
                field: "bg-red-300 border-red-500 text-red-500",
                // Assessment type variants with borders
                "SOC (further visits)":
                    "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300",
                "Follow-up/Recert":
                    "border-green-500 bg-green-50 text-green-700 dark:border-green-400 dark:bg-green-950 dark:text-green-300",
                ROC: "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-950 dark:text-purple-300",
                Discharge:
                    "border-red-500 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950 dark:text-red-300",
                Transfer:
                    "border-gray-500 bg-gray-50 text-gray-700 dark:border-gray-400 dark:bg-gray-950 dark:text-gray-300",
                "Other follow-up":
                    "border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-400 dark:bg-orange-950 dark:text-orange-300",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
