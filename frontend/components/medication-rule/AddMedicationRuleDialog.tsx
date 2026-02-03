import { RuleType, NewExcelCell, LlmExample } from "@/types/rule";
import { NewMedicationRule } from "@/types/medicationRule";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { SelectField } from "@/components/ui/data-table/select-field";
import { medicationRuleTypeOptions } from "@/constants/medicationRule";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { ExcelCellsSection } from "../rule/sections/ExcelCellsSection";
import { MedicationLlmConfigSection } from "./sections/MedicationLlmConfigSection";
import { ChangeEventOrCustomEvent } from "@/types/common";

interface AddMedicationRuleDialogProps {
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
    title?: string;
    submitText?: string;
    loadingText?: string;
}

export function AddMedicationRuleDialog({
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
    title = "Add New Medication Rule",
    submitText = "Add Rule",
    loadingText = "Adding...",
}: AddMedicationRuleDialogProps) {
    const isLlmRule =
        rule.rule_type === "LLM_SIMPLE" || rule.rule_type === "LLM_COMPLEX";

    // State to manage collapsible sections
    const [excelCellsOpen, setExcelCellsOpen] = useState(true);
    const [llmConfigOpen, setLlmConfigOpen] = useState(true);
    const [llmExamplesOpen, setLlmExamplesOpen] = useState(true);

    // Handle system instruction change from code snippet
    const handleSystemInstructionChange = (value: string) => {
        if (onSystemInstructionChange) {
            onSystemInstructionChange(value);
        } else {
            // Fallback to using the input change handler
            const syntheticEvent = {
                target: {
                    name: "llm_system_instruction",
                    value,
                },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            onInputChange(syntheticEvent);
        }
    };

    // Handle examples change from code snippet
    const handleLlmExamplesChange = (examples: LlmExample[]) => {
        if (onLlmExamplesChange) {
            onLlmExamplesChange(examples);
        }
    };

    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title={title}
            isSubmitting={isSubmitting}
            submitText={submitText}
            loadingText={loadingText}
        >
            <FormField
                label="Rule Name"
                id="name"
                name="name"
                value={rule.name}
                onChange={onInputChange}
            />
            <div className="space-y-2 hidden">
                <label htmlFor="description" className="text-sm font-medium">
                    Description
                </label>
                <Textarea
                    id="description"
                    name="description"
                    value={rule.description || ""}
                    onChange={onInputChange}
                    placeholder="Enter a description for this rule"
                    className="min-h-[80px]"
                    disabled={true}
                />
            </div>
            <SelectField
                label="Rule Type"
                id="rule_type"
                value={rule.rule_type}
                options={medicationRuleTypeOptions}
                onChange={(value) => onRuleTypeChange(value as RuleType)}
            />

            <Separator className="my-4" />

            <ExcelCellsSection
                isOpen={excelCellsOpen}
                onOpenChange={setExcelCellsOpen}
                newExcelCell={newExcelCell}
                excelCells={rule.excel_cells}
                onExcelCellInputChange={onExcelCellInputChange}
                onAddExcelCell={onAddExcelCell}
                onRemoveExcelCell={onRemoveExcelCell}
                ruleType={rule.rule_type}
            />

            {isLlmRule && (
                <>
                    <Separator className="my-4" />
                    <MedicationLlmConfigSection
                        isOpen={llmConfigOpen}
                        onOpenChange={setLlmConfigOpen}
                        llmSystemInstruction={rule.llm_system_instruction || ""}
                        onInputChange={onInputChange}
                        llmExamplesOpen={llmExamplesOpen}
                        onLlmExamplesOpenChange={setLlmExamplesOpen}
                        newLlmExample={newLlmExample}
                        llmExamples={rule.llm_examples || []}
                        onLlmExampleInputChange={onLlmExampleInputChange}
                        onAddLlmExample={onAddLlmExample}
                        onRemoveLlmExample={onRemoveLlmExample}
                        onEditLlmExample={onEditLlmExample}
                        onCancelEditLlmExample={onCancelEditLlmExample}
                        editingExampleIndex={editingExampleIndex}
                        editingExample={editingExample}
                        onEditExampleChange={onEditExampleChange}
                        onSaveEditLlmExample={onSaveEditLlmExample}
                        generateLlmAssistantTemplate={
                            generateLlmAssistantTemplate
                        }
                        ruleType={rule.rule_type}
                        onSystemInstructionChange={
                            handleSystemInstructionChange
                        }
                        onLlmExamplesChange={handleLlmExamplesChange}
                    />
                </>
            )}
        </AddEditDialog>
    );
}
