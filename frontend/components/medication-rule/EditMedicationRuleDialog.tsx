import { RuleType, NewExcelCell, LlmExample } from "@/types/rule";
import { NewMedicationRule } from "@/types/medicationRule";
import { AddMedicationRuleDialog } from "./AddMedicationRuleDialog";
import { ChangeEventOrCustomEvent } from "@/types/common";

interface EditMedicationRuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    rule: NewMedicationRule;
    newExcelCell: NewExcelCell;
    newLlmExample: LlmExample;
    onInputChange: (
        e: ChangeEventOrCustomEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onRuleTypeChange: (value: RuleType) => void;
    onExcelCellInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onLlmExampleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
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
    onSystemInstructionChange?: (value: string) => void;
    onLlmExamplesChange?: (examples: LlmExample[]) => void;
}

export function EditMedicationRuleDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    rule,
    newExcelCell,
    newLlmExample,
    onInputChange,
    onRuleTypeChange,
    onExcelCellInputChange,
    onLlmExampleInputChange,
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
    onSystemInstructionChange,
    onLlmExamplesChange,
}: EditMedicationRuleDialogProps) {
    return (
        <AddMedicationRuleDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            rule={rule}
            newExcelCell={newExcelCell}
            newLlmExample={newLlmExample}
            onInputChange={onInputChange}
            onRuleTypeChange={onRuleTypeChange}
            onExcelCellInputChange={onExcelCellInputChange}
            onLlmExampleInputChange={onLlmExampleInputChange}
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
            onSystemInstructionChange={onSystemInstructionChange}
            onLlmExamplesChange={onLlmExamplesChange}
            title="Edit Medication Rule"
            submitText="Save Changes"
            loadingText="Saving..."
        />
    );
}
