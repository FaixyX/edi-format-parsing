import { Textarea } from "@/components/ui/textarea";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { MedicationLlmExamplesSection } from "./MedicationLlmExamplesSection";
import { LlmExample, RuleType } from "@/types/rule";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CodeSnippetParser,
    ParsedData,
} from "@/components/shared/code-snippet/CodeSnippetParser";
import { useState } from "react";

interface MedicationLlmConfigSectionProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    llmSystemInstruction: string;
    onInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    llmExamplesOpen: boolean;
    onLlmExamplesOpenChange: (open: boolean) => void;
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
    ruleType: RuleType;
    onSystemInstructionChange?: (value: string) => void;
    onLlmExamplesChange?: (examples: LlmExample[]) => void;
}

export function MedicationLlmConfigSection({
    isOpen,
    onOpenChange,
    llmSystemInstruction,
    onInputChange,
    llmExamplesOpen,
    onLlmExamplesOpenChange,
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
    ruleType,
    onSystemInstructionChange,
    onLlmExamplesChange,
}: MedicationLlmConfigSectionProps) {
    const [activeTab, setActiveTab] = useState("manual");

    const handleParsedData = (data: ParsedData) => {
        // Update system instruction if handler is provided and option is enabled
        if (onSystemInstructionChange && data.updateSystemInstruction) {
            onSystemInstructionChange(data.systemInstruction);
        }

        // Update examples if handler is provided
        if (onLlmExamplesChange && data.targetExampleType === "examples") {
            const currentExamples = data.appendExamples ? llmExamples : [];
            onLlmExamplesChange([...currentExamples, ...data.examples]);
        }

        // Switch back to manual tab
        setActiveTab("manual");
    };

    return (
        <CollapsibleSection
            title="LLM Configuration"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
        >
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="mt-2"
            >
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="manual">Manual Entry</TabsTrigger>
                    <TabsTrigger value="code">From Code Snippet</TabsTrigger>
                </TabsList>

                <TabsContent value="code">
                    <CodeSnippetParser
                        onParsedData={handleParsedData}
                        title="Paste OpenAI Code Snippet"
                        description="Paste your OpenAI API code snippet to automatically extract the system instruction and examples"
                        showTrainingDataOption={false}
                        defaultOptions={{
                            updateSystemInstruction: true,
                            targetExampleType: "examples",
                            appendExamples: false,
                        }}
                    />
                </TabsContent>

                <TabsContent value="manual">
                    <div className="space-y-2">
                        <label
                            htmlFor="llm_system_instruction"
                            className="text-sm font-medium"
                        >
                            System Instruction
                        </label>
                        <Textarea
                            id="llm_system_instruction"
                            name="llm_system_instruction"
                            value={llmSystemInstruction}
                            onChange={onInputChange}
                            placeholder="Enter system instruction for LLM"
                            className="min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            This instruction will guide the LLM on how to map
                            data to Excel cells.
                        </p>
                    </div>

                    <div className="space-y-4 mt-6">
                        <MedicationLlmExamplesSection
                            isOpen={llmExamplesOpen}
                            onOpenChange={onLlmExamplesOpenChange}
                            newLlmExample={newLlmExample}
                            llmExamples={llmExamples}
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
                            ruleType={ruleType}
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </CollapsibleSection>
    );
}
