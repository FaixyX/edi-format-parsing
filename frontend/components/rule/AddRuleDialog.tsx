import {
    NewRule,
    RuleType,
    NewPdfField,
    NewExcelCell,
    LlmExample,
} from "@/types/rule";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { SelectField } from "@/components/ui/data-table/select-field";
import { ruleTypeOptions } from "@/constants/rule";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { PdfFieldsSection } from "./sections/PdfFieldsSection";
import { ExcelCellsSection } from "./sections/ExcelCellsSection";
import { LlmConfigSection } from "./sections/LlmConfigSection";
import { RefetchOptions } from "@tanstack/react-query";
import { ChangeEventOrCustomEvent } from "@/types/common";

interface AddRuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    rule: NewRule;
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
    title?: string;
    submitText?: string;
    loadingText?: string;
    modelId: string | null;
    fieldOptions: Array<{ value: string; label: string }>;
    isLoadingFields?: boolean;
    onRefreshFields?:
        | ((options?: RefetchOptions) => Promise<any>)
        | (() => Promise<boolean> | Promise<void>);
}

export function AddRuleDialog({
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
    title = "Add New Rule",
    submitText = "Add Rule",
    loadingText = "Adding...",
    modelId,
    fieldOptions,
    isLoadingFields = false,
    onRefreshFields,
}: AddRuleDialogProps) {
    const isLlmRule =
        rule.rule_type === "LLM_SIMPLE" || rule.rule_type === "LLM_COMPLEX";

    // State to manage collapsible sections
    const [pdfFieldsOpen, setPdfFieldsOpen] = useState(true);
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
                options={ruleTypeOptions}
                onChange={(value) => onRuleTypeChange(value as RuleType)}
            />

            <Separator className="my-4" />

            <PdfFieldsSection
                isOpen={pdfFieldsOpen}
                onOpenChange={setPdfFieldsOpen}
                newPdfField={newPdfField}
                pdfFields={rule.pdf_fields}
                onPdfFieldChange={onPdfFieldChange}
                onAddPdfField={onAddPdfField}
                onRemovePdfField={onRemovePdfField}
                ruleType={rule.rule_type}
                modelId={modelId}
                fieldOptions={fieldOptions}
                isLoadingFields={isLoadingFields}
                onRefreshFields={onRefreshFields}
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
                    <LlmConfigSection
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
                        generateLlmUserTemplate={generateLlmUserTemplate}
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
