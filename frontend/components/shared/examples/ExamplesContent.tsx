import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit, X, Check, RotateCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useState } from "react";

// Generic interface that works with both LlmExample and SystemInstructionExample
export interface Example {
    user_message: string;
    assistant_message: string;
}

interface ExamplesContentProps<T extends Example> {
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
    allowEmptyExamples?: boolean;
    labelPrefix?: string; // NEW
}

export function ExamplesContent<T extends Example>({
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
    allowEmptyExamples = true,
    labelPrefix = "Example", // NEW
}: ExamplesContentProps<T>) {
    const isEditing = editingExampleIndex !== null;
    const [examplesOpen, setExamplesOpen] = useState(examples.length > 0);

    return (
        <>
            <div className="flex items-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="text-xs text-muted-foreground italic mr-2">
                                Provide {labelPrefix.toLowerCase()}{" "}
                                conversations to train the LLM
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs">
                                {labelPrefix}s help the LLM understand the exact
                                format and type of responses you expect.
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex gap-3 flex-col">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label
                            htmlFor="user_message"
                            className="text-sm font-medium"
                        >
                            User Message
                        </label>
                        {showTemplateButtons && generateUserTemplate && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isEditing}
                                            size="sm"
                                            onClick={generateUserTemplate}
                                        >
                                            <RotateCw className="h-3 w-3" />
                                            Reset Template
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            Generate a template based on the
                                            fields you&apos;ve added
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <Textarea
                        id="user_message"
                        name="user_message"
                        value={newExample.user_message}
                        onChange={onExampleInputChange}
                        placeholder="Enter example user message"
                        className="min-h-[80px]"
                        disabled={isEditing}
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <label
                            htmlFor="assistant_message"
                            className="text-sm font-medium"
                        >
                            Assistant Response
                        </label>
                        {showTemplateButtons && generateAssistantTemplate && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={isEditing}
                                            size="sm"
                                            onClick={generateAssistantTemplate}
                                        >
                                            <RotateCw className="h-3 w-3" />
                                            Reset Template
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="max-w-xs">
                                            Generate a template based on the
                                            fields you&apos;ve added
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <Textarea
                        id="assistant_message"
                        name="assistant_message"
                        value={newExample.assistant_message}
                        onChange={onExampleInputChange}
                        placeholder="Enter example assistant response"
                        className="min-h-[80px]"
                        disabled={isEditing}
                    />
                </div>

                <Button
                    type="button"
                    onClick={onAddExample}
                    className="w-full"
                    disabled={
                        isEditing ||
                        (!allowEmptyExamples &&
                            (!newExample.user_message ||
                                !newExample.assistant_message))
                    }
                >
                    <Plus className="h-4 w-4" />
                    Add {labelPrefix}
                </Button>
            </div>

            {examples && examples.length > 0 && (
                <CollapsibleSection
                    title={`Added ${labelPrefix}s (${examples.length})`}
                    isOpen={examplesOpen}
                    onOpenChange={setExamplesOpen}
                >
                    <div className="space-y-4">
                        {examples.map((example, index) => (
                            <Card
                                key={index}
                                className={`relative ${
                                    editingExampleIndex === index
                                        ? "ring-blue-500 ring-2 ring-offset-2 outline-none ring-offset-background"
                                        : ""
                                }`}
                            >
                                <CardHeader className="p-5 pb-0 flex flex-row items-start justify-between">
                                    <h5 className="text-sm font-medium">
                                        {labelPrefix} {index + 1}
                                    </h5>
                                    <div className="flex space-x-1">
                                        {editingExampleIndex === index ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-green-500"
                                                    onClick={onSaveEditExample}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                    onClick={
                                                        onCancelEditExample
                                                    }
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-blue-500"
                                                    onClick={() =>
                                                        onEditExample(index)
                                                    }
                                                    disabled={isEditing}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        onRemoveExample(index)
                                                    }
                                                    disabled={isEditing}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="p-5 space-y-3">
                                    {editingExampleIndex === index &&
                                    editingExample ? (
                                        <>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    User message:
                                                </p>
                                                <Textarea
                                                    name="user_message"
                                                    value={
                                                        editingExample.user_message
                                                    }
                                                    onChange={
                                                        onEditExampleChange
                                                    }
                                                    placeholder="Enter user message"
                                                    className="min-h-[80px]"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Assistant response:
                                                </p>
                                                <Textarea
                                                    name="assistant_message"
                                                    value={
                                                        editingExample.assistant_message
                                                    }
                                                    onChange={
                                                        onEditExampleChange
                                                    }
                                                    placeholder="Enter assistant response"
                                                    className="min-h-[80px]"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    User message:
                                                </p>
                                                <Textarea
                                                    value={
                                                        example.user_message ||
                                                        ""
                                                    }
                                                    readOnly
                                                    className="min-h-[80px] bg-muted"
                                                    placeholder="No message"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                                    Assistant response:
                                                </p>
                                                <Textarea
                                                    value={
                                                        example.assistant_message ||
                                                        ""
                                                    }
                                                    readOnly
                                                    className="min-h-[80px] bg-muted"
                                                    placeholder="No response"
                                                />
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CollapsibleSection>
            )}
        </>
    );
}
