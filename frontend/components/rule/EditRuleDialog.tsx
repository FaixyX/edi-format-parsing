import {
    Rule,
    RuleType,
    NewPdfField,
    NewExcelCell,
    LlmExample,
} from "@/types/rule";
import { AddRuleDialog } from "./AddRuleDialog";
import { RefetchOptions } from "@tanstack/react-query";
import { ChangeEventOrCustomEvent } from "@/types/common";

interface EditRuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    rule: Rule;
    newPdfField: NewPdfField;
    newExcelCell: NewExcelCell;
    newLlmExample: LlmExample;
    onInputChange: (
        e: ChangeEventOrCustomEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onRuleTypeChange: (value: RuleType) => void;
    onPdfFieldInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onPdfFieldChange: (value: string) => void;
    onExcelCellInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onLlmExampleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onAddPdfField: () => void;
    onRemovePdfField: (index: number) => void;
    onAddExcelCell: () => void;
    onRemoveExcelCell: (index: number) => void;
    onAddLlmExample: () => void;
    onRemoveLlmExample: (index: number) => void;
    onEditLlmExample: (index: number) => void;
    onCancelEditLlmExample: () => void;
    editingExampleIndex: number | null;
    editingExample: LlmExample | null;
    onEditExampleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onSaveEditLlmExample: () => void;
    generateLlmAssistantTemplate?: () => void;
    generateLlmUserTemplate?: () => void;
    onSystemInstructionChange?: (value: string) => void;
    onLlmExamplesChange?: (examples: LlmExample[]) => void;
    modelId: string | null;
    fieldOptions: Array<{ value: string; label: string }>;
    isLoadingFields?: boolean;
    onRefreshFields?:
        | ((options?: RefetchOptions) => Promise<any>)
        | (() => Promise<boolean> | Promise<void>);
}

export function EditRuleDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    rule,
    newPdfField,
    newExcelCell,
    newLlmExample,
    onInputChange,
    onRuleTypeChange,
    onPdfFieldChange,
    onPdfFieldInputChange,
    onExcelCellInputChange,
    onLlmExampleInputChange,
    onAddPdfField,
    onRemovePdfField,
    onAddExcelCell,
    onRemoveExcelCell,
    onAddLlmExample,
    onRemoveLlmExample,
    onEditLlmExample,
    onCancelEditLlmExample,
    editingExampleIndex,
    editingExample,
    onEditExampleChange,
    onSaveEditLlmExample,
    generateLlmAssistantTemplate,
    generateLlmUserTemplate,
    onSystemInstructionChange,
    onLlmExamplesChange,
    modelId,
    fieldOptions,
    isLoadingFields = false,
    onRefreshFields,
}: EditRuleDialogProps) {
    return (
        <AddRuleDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            rule={rule}
            newPdfField={newPdfField}
            newExcelCell={newExcelCell}
            newLlmExample={newLlmExample}
            onInputChange={onInputChange}
            onRuleTypeChange={onRuleTypeChange}
            onPdfFieldInputChange={onPdfFieldInputChange}
            onPdfFieldChange={onPdfFieldChange}
            onExcelCellInputChange={onExcelCellInputChange}
            onLlmExampleInputChange={onLlmExampleInputChange}
            onAddPdfField={onAddPdfField}
            onRemovePdfField={onRemovePdfField}
            onAddExcelCell={onAddExcelCell}
            onRemoveExcelCell={onRemoveExcelCell}
            onAddLlmExample={onAddLlmExample}
            onRemoveLlmExample={onRemoveLlmExample}
            onEditLlmExample={onEditLlmExample}
            onCancelEditLlmExample={onCancelEditLlmExample}
            editingExampleIndex={editingExampleIndex}
            editingExample={editingExample}
            onEditExampleChange={onEditExampleChange}
            onSaveEditLlmExample={onSaveEditLlmExample}
            generateLlmAssistantTemplate={generateLlmAssistantTemplate}
            generateLlmUserTemplate={generateLlmUserTemplate}
            onSystemInstructionChange={onSystemInstructionChange}
            onLlmExamplesChange={onLlmExamplesChange}
            title="Edit Rule"
            submitText="Save Changes"
            loadingText="Saving..."
            modelId={modelId}
            fieldOptions={fieldOptions}
            isLoadingFields={isLoadingFields}
            onRefreshFields={onRefreshFields}
        />
    );
}
