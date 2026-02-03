"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    FileCheck,
    SkipForward,
    CheckSquare,
    AlertCircle,
    Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricCard } from "./MetricCard";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useState } from "react";

interface SkippedFieldDetail {
    field_name: string;
    field_type: string;
    subsection_id: string;
    skip_reason: string;
    timestamp: string;
}

interface FormFillingResultsProps {
    formFillingResult: {
        status: string;
        message: string;
        subsections_processed: number;
        fields_filled: number;
        fields_skipped: number;
        skipped_fields_details?: SkippedFieldDetail[];
        errors: any[];
        saved: boolean;
    };
    className?: string;
}

export function FormFillingResults({
    formFillingResult,
    className,
}: FormFillingResultsProps) {
    const {
        subsections_processed,
        fields_filled,
        fields_skipped,
        skipped_fields_details,
    } = formFillingResult;

    const [skippedFieldsOpen, setSkippedFieldsOpen] = useState(false);

    const getSkipReasonBadge = (reason: string) => {
        const reasonLower = reason.toLowerCase();
        let variant: "default" | "secondary" | "destructive" | "outline" =
            "secondary";

        if (reasonLower.includes("not found")) {
            variant = "destructive";
        } else if (reasonLower.includes("empty")) {
            variant = "outline";
        } else if (reasonLower.includes("disabled")) {
            variant = "default";
        }

        return (
            <Badge variant={variant} className="text-xs">
                {reason}
            </Badge>
        );
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 gap-4">
                <MetricCard
                    label="Subsections Processed"
                    value={subsections_processed}
                    icon={FileCheck}
                    color="green"
                />
            </div>

            {/* Additional Stats */}
            <div className="grid grid-cols-2 gap-4">
                <MetricCard
                    label="Fields Filled"
                    value={fields_filled}
                    icon={CheckSquare}
                    color="blue"
                />
                <MetricCard
                    label="Fields Skipped"
                    value={fields_skipped}
                    icon={SkipForward}
                    color="orange"
                />
            </div>

            {/* Detailed Skipped Fields */}
            {skipped_fields_details && skipped_fields_details.length > 0 && (
                <div className="mt-4">
                    <CollapsibleSection
                        title={`Skipped Fields (${skipped_fields_details.length})`}
                        isOpen={skippedFieldsOpen}
                        onOpenChange={setSkippedFieldsOpen}
                    >
                        <div className="space-y-3">
                            {skipped_fields_details.map((field, index) => (
                                <Card
                                    key={index}
                                    className="border-l-4 border-l-orange-500"
                                >
                                    <CardContent className="p-4">
                                        <div className="space-y-2">
                                            {/* Field number and name */}
                                            <div className="flex items-start gap-2">
                                                <Badge variant="Other follow-up">
                                                    #{index + 1}
                                                </Badge>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200 text-wrap">
                                                            {field.field_name}
                                                        </span>
                                                    </div>

                                                    {/* Subsection and skip reason */}
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                                        <div className="flex items-center gap-1">
                                                            <Hash className="h-3 w-3" />
                                                            <span className="font-mono">
                                                                {
                                                                    field.subsection_id
                                                                }
                                                            </span>
                                                        </div>
                                                        <span className="text-gray-400">
                                                            •
                                                        </span>
                                                        {getSkipReasonBadge(
                                                            field.skip_reason
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CollapsibleSection>
                </div>
            )}
        </div>
    );
}
