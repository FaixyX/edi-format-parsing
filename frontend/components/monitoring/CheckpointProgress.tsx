"use client";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Check, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckpointProgressProps {
    checkpoints: Record<string, boolean>;
    className?: string;
}

// Define the checkpoint steps in order with user-friendly labels
const CHECKPOINT_STEPS = [
    { key: "browser_initialized", label: "Browser Initialized" },
    { key: "login_completed", label: "Login Completed" },
    { key: "patient_list_accessed", label: "Patient List Accessed" },
    { key: "episode_found", label: "Episode Found" },
    { key: "chart_opened", label: "Chart Opened" },
    { key: "assessment_selected", label: "Assessment Selected" },
    { key: "pdf_processed", label: "PDF Processed" },
    { key: "form_filled", label: "Form Filled" },
    { key: "form_saved", label: "Form Saved" },
];

export function CheckpointProgress({
    checkpoints,
    className,
}: CheckpointProgressProps) {
    // Find the last completed step index
    const lastCompletedIndex = CHECKPOINT_STEPS.findLastIndex(
        (step) => checkpoints[step.key] === true
    );
    const failedStepIndex = lastCompletedIndex + 1;

    return (
        <div className={cn("space-y-4", className)}>
            {/* Progress bar */}
            {/* <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">
                        Processing Progress
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {completedSteps}/{totalSteps} steps completed
                    </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
            </div> */}

            {/* Checkpoint steps */}
            <div className="space-y-2">
                {CHECKPOINT_STEPS.map((step, index) => {
                    const isCompleted = checkpoints[step.key] === true;
                    const isFailed = index === failedStepIndex;
                    const isPending = index > failedStepIndex;

                    return (
                        <Alert
                            key={step.key}
                            variant={isFailed ? "destructive" : "default"}
                            className={cn(
                                "transition-colors",
                                isCompleted &&
                                    "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20",
                                isFailed &&
                                    "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
                                isPending && "border-muted bg-muted/20"
                            )}
                        >
                            {/* Status icon */}
                            {isCompleted && (
                                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            )}
                            {isFailed && (
                                <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                            )}
                            {isPending && (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            )}

                            <AlertTitle className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        isCompleted &&
                                            "text-green-700 dark:text-green-300",
                                        isFailed &&
                                            "text-red-700 dark:text-red-300",
                                        isPending && "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </span>

                                <span className="text-xs text-muted-foreground ml-2">
                                    {isCompleted && "Completed"}
                                    {isFailed && "Failed"}
                                    {isPending && "Pending"}
                                </span>
                            </AlertTitle>
                        </Alert>
                    );
                })}
            </div>
        </div>
    );
}
