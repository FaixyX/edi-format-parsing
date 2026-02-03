import { PdfTemplate, PdfTemplateStatus } from "@/types/pdfTemplate";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { SelectField } from "@/components/ui/data-table/select-field";
import { ComboboxField } from "@/components/ui/data-table/combobox-field";
import { pdfTemplateStatusOptions } from "@/constants/pdfTemplate";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";
import { Label } from "@radix-ui/react-label";
import { RefetchOptions } from "@tanstack/react-query";

interface EditPdfTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    template: PdfTemplate;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onStatusChange: (value: PdfTemplateStatus) => void;
    onModelChange: (value: string) => void;
    modelOptions: Array<{ value: string; label: string; description?: string }>;
    isLoadingModels?: boolean;
    onRefreshModels?:
        | ((options?: RefetchOptions) => Promise<any>)
        | (() => Promise<boolean> | Promise<void>);
}

export function EditPdfTemplateDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    template,
    onInputChange,
    onStatusChange,
    onModelChange,
    modelOptions,
    isLoadingModels = false,
    onRefreshModels,
}: EditPdfTemplateDialogProps) {
    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title="Edit Template"
            isSubmitting={isSubmitting}
            submitText="Save Changes"
            loadingText="Saving..."
        >
            <FormField
                label="PDF Type"
                id="edit-pdfType"
                name="pdfType"
                value={template.pdfType}
                onChange={onInputChange}
            />
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-modelId" className="text-right">
                    Model
                </Label>
                <div className="col-span-3 flex items-center gap-2">
                    <div className="flex-grow">
                        <ComboboxField
                            label=""
                            labelPosition="top"
                            id="edit-modelId"
                            value={template.modelId}
                            options={modelOptions}
                            onChange={(value) => onModelChange(value)}
                            placeholder="Select a model..."
                            searchPlaceholder="Search models..."
                            emptyMessage={
                                isLoadingModels
                                    ? "Loading models..."
                                    : "No model found."
                            }
                            disabled={isLoadingModels}
                            className="w-full gap-0"
                        />
                    </div>
                    {onRefreshModels && (
                        <RefreshButton
                            tooltipText="Refresh models"
                            onRefresh={onRefreshModels}
                            successMessage="Models refreshed successfully"
                            errorMessage="Failed to refresh models"
                            disabled={isLoadingModels}
                        />
                    )}
                </div>
            </div>
            <SelectField
                label="Status"
                id="edit-status"
                value={template.status}
                options={pdfTemplateStatusOptions}
                onChange={(value) => onStatusChange(value as PdfTemplateStatus)}
            />
        </AddEditDialog>
    );
}
