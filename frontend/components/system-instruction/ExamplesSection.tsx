"use client";

import { SystemInstructionExample } from "@/types/system_instruction";
import { ExamplesContent } from "@/components/shared/examples/ExamplesContent";

interface ExamplesSectionProps {
    newExample: SystemInstructionExample;
    examples: SystemInstructionExample[];
    onExampleInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onAddExample: () => void;
    onRemoveExample: (index: number) => void;
    onEditExample: (index: number) => void;
    onCancelEditExample: () => void;
    editingExampleIndex: number | null;
    editingExample: SystemInstructionExample | null;
    onEditExampleChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onSaveEditExample: () => void;
}

export function ExamplesSection({
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
}: ExamplesSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center">
                <h3 className="text-lg font-medium">Examples</h3>
            </div>
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
                allowEmptyExamples={true}
            />
        </div>
    );
}
