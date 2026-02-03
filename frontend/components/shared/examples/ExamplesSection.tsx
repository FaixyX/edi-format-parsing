import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ExamplesContent, Example } from "./ExamplesContent";

interface ExamplesSectionProps<T extends Example> {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    newExample: T;
    examples: T[];
    onExampleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onAddExample: () => void;
    onRemoveExample: (index: number) => void;
    onEditExample: (index: number) => void;
    onCancelEditExample: () => void;
    editingExampleIndex: number | null;
    editingExample: T | null;
    onEditExampleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onSaveEditExample: () => void;
    generateAssistantTemplate?: () => void;
    generateUserTemplate?: () => void;
    showTemplateButtons?: boolean;
    title?: string;
    allowEmptyExamples?: boolean;
    labelPrefix?: string;
}

export function ExamplesSection<T extends Example>({
    isOpen,
    onOpenChange,
    newExample,
    examples,
    onExampleInputChange,
    onAddExample,
    onRemoveExample,
    onEditExample,
    onCancelEditExample,
    editingExampleIndex,
    editingExample,
    onEditExampleChange,
    onSaveEditExample,
    generateAssistantTemplate,
    generateUserTemplate,
    showTemplateButtons = false,
    title = "Examples",
    allowEmptyExamples = true,
    labelPrefix = "Example",
}: ExamplesSectionProps<T>) {
    return (
        <CollapsibleSection
            title={title}
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <ExamplesContent
                newExample={newExample}
                examples={examples}
                onExampleInputChange={onExampleInputChange}
                onAddExample={onAddExample}
                onRemoveExample={onRemoveExample}
                onEditExample={onEditExample}
                onCancelEditExample={onCancelEditExample}
                editingExampleIndex={editingExampleIndex}
                editingExample={editingExample}
                onEditExampleChange={onEditExampleChange}
                onSaveEditExample={onSaveEditExample}
                generateAssistantTemplate={generateAssistantTemplate}
                generateUserTemplate={generateUserTemplate}
                showTemplateButtons={showTemplateButtons}
                allowEmptyExamples={allowEmptyExamples}
                labelPrefix={labelPrefix}
            />
        </CollapsibleSection>
    );
}

export function TrainingDataSection<T extends Example>(
    props: ExamplesSectionProps<T>
) {
    return (
        <ExamplesSection
            {...props}
            title={props.title || "Training Data"}
            labelPrefix="Training Example"
        />
    );
}
