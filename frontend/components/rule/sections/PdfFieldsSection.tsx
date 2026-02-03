import { Button } from "@/components/ui/button";
import { Plus, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { NewPdfField, RuleType } from "@/types/rule";
import { ComboboxField } from "@/components/ui/data-table/combobox-field";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { RefetchOptions } from "@tanstack/react-query";

interface PdfFieldsSectionProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    newPdfField: {
        field_name: string;
        description?: string;
    };
    pdfFields: NewPdfField[];
    onAddPdfField: () => void;
    onRemovePdfField: (index: number) => void;
    onPdfFieldChange?: (value: string) => void;
    ruleType: RuleType;
    modelId: string | null;
    fieldOptions: Array<{ value: string; label: string }>;
    isLoadingFields?: boolean;
    onRefreshFields?:
        | ((options?: RefetchOptions) => Promise<any>)
        | (() => Promise<boolean> | Promise<void>);
}

export function PdfFieldsSection({
    isOpen,
    onOpenChange,
    newPdfField,
    pdfFields,
    onAddPdfField,
    onRemovePdfField,
    onPdfFieldChange,
    ruleType,
    modelId,
    fieldOptions,
    isLoadingFields = false,
    onRefreshFields,
}: PdfFieldsSectionProps) {
    const isDirectMapping = ruleType === "DIRECT";
    const maxFieldsReached = isDirectMapping && pdfFields.length > 0;

    return (
        <CollapsibleSection
            title="PDF Fields"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            titleClassName="text-red-500"
        >
            {isDirectMapping && (
                <div className="mb-2 text-sm flex items-center text-muted-foreground">
                    <Info className="h-4 w-4 mr-1" />
                    Direct mapping allows only one PDF field.
                </div>
            )}

            {!modelId && (
                <div className="mb-2 text-sm flex items-center text-muted-foreground">
                    <Info className="h-4 w-4 mr-1" />
                    Please select a model first to view available fields.
                </div>
            )}

            <div className="flex gap-2 align-middle">
                <ComboboxField
                    label="Field Name"
                    id="field_name"
                    value={newPdfField.field_name}
                    options={fieldOptions}
                    onChange={(value) => onPdfFieldChange?.(value)}
                    placeholder="Select a field..."
                    searchPlaceholder="Search fields..."
                    emptyMessage={
                        isLoadingFields
                            ? "Loading fields..."
                            : "No field found."
                    }
                    disabled={isLoadingFields || !modelId}
                    className="w-full"
                />
                <Button
                    size="icon"
                    variant="outline"
                    onClick={onAddPdfField}
                    disabled={
                        !modelId || !newPdfField.field_name || maxFieldsReached
                    }
                >
                    <Plus />
                </Button>
                {onRefreshFields && (
                    <RefreshButton
                        tooltipText="Refresh fields"
                        onRefresh={onRefreshFields}
                        successMessage="Fields refreshed successfully"
                        errorMessage="Failed to refresh fields"
                        disabled={isLoadingFields || !modelId}
                    />
                )}
            </div>

            {pdfFields.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {pdfFields.map((field, index) => (
                        <Badge
                            key={index}
                            variant="field"
                            className="text-sm flex items-center gap-1 pr-1"
                        >
                            {field.field_name}
                            <Button
                                type="button"
                                variant="link"
                                size="icon"
                                className="h-5 w-5 p-0 text-red-500"
                                onClick={() => onRemovePdfField(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}
        </CollapsibleSection>
    );
}
