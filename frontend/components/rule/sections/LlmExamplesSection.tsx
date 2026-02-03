import { LlmExample, RuleType } from "@/types/rule";
import { ExamplesSection } from "@/components/shared/examples/ExamplesSection";

interface LlmExamplesSectionProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    newLlmExample: LlmExample;
    llmExamples: LlmExample[];
    onLlmExampleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
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
    ruleType?: RuleType;
}

export function LlmExamplesSection({
    isOpen,
    onOpenChange,
    newLlmExample,
    llmExamples,
    onLlmExampleInputChange,
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
    ruleType,
}: LlmExamplesSectionProps) {
    const isComplexLLM = ruleType === "LLM_COMPLEX";
    const isLlmRule = ruleType === "LLM_SIMPLE" || ruleType === "LLM_COMPLEX";
    const showTemplateButtons =
        (isComplexLLM && !!generateLlmAssistantTemplate) ||
        (isLlmRule && !!generateLlmUserTemplate);

    return (
        <ExamplesSection
            title="Examples"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            newExample={newLlmExample}
            examples={llmExamples}
            onExampleInputChange={onLlmExampleInputChange}
            onAddExample={onAddLlmExample}
            onRemoveExample={onRemoveLlmExample}
            onEditExample={onEditLlmExample}
            onCancelEditExample={onCancelEditLlmExample}
            editingExampleIndex={editingExampleIndex}
            editingExample={editingExample}
            onEditExampleChange={onEditExampleChange}
            onSaveEditExample={onSaveEditLlmExample}
            generateAssistantTemplate={generateLlmAssistantTemplate}
            generateUserTemplate={generateLlmUserTemplate}
            showTemplateButtons={showTemplateButtons}
            allowEmptyExamples={true}
        />
    );
}
