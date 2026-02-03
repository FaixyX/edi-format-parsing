"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SystemInstruction } from "@/types/system_instruction";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/ui/data-table/copy-button";
import { ExternalLink } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { useState } from "react";

interface ViewSystemInstructionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    systemInstruction: SystemInstruction | null;
}

export function ViewSystemInstructionDialog({
    isOpen,
    onClose,
    systemInstruction,
}: ViewSystemInstructionDialogProps) {
    // Generate OpenAI prompt URL
    const getOpenAIPromptUrl = (promptId: string) => {
        return `https://platform.openai.com/prompts/${promptId}`;
    };

    // Collapsible state for each section - moved before conditional return
    const [systemInstructionOpen, setSystemInstructionOpen] = useState(true);
    const [examplesOpen, setExamplesOpen] = useState(
        !!systemInstruction?.examples && systemInstruction.examples.length > 0
    );
    const [trainingDataOpen, setTrainingDataOpen] = useState(
        !!systemInstruction?.training_data &&
            systemInstruction.training_data.length > 0
    );

    if (!systemInstruction) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <DialogTitle>{systemInstruction.name}</DialogTitle>
                        <div className="flex space-x-2">
                            <Badge
                                className={
                                    systemInstruction.is_active
                                        ? "bg-green-500 hover:bg-green-600"
                                        : "bg-red-500 hover:bg-red-600"
                                }
                            >
                                {systemInstruction.is_active
                                    ? "Active"
                                    : "Inactive"}
                            </Badge>
                            {systemInstruction.use_prompt_id && (
                                <Badge className="bg-purple-500 hover:bg-purple-600">
                                    OpenAI Prompt
                                </Badge>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {systemInstruction.description && (
                    <div className="mt-2 mb-4">
                        <p className="text-sm text-muted-foreground">
                            {systemInstruction.description}
                        </p>
                    </div>
                )}

                <div className="mt-2 mb-4">
                    <h4 className="text-sm font-medium mb-2">Model:</h4>
                    <p className="text-sm">
                        {systemInstruction.model_id || "Default (gpt-4o)"}
                    </p>
                </div>

                {systemInstruction.use_prompt_id ? (
                    <div className="mt-6">
                        <h4 className="text-sm font-medium mb-2">
                            OpenAI Prompt ID:
                        </h4>
                        <div className="bg-muted p-4 rounded-md overflow-auto relative">
                            <div className="flex justify-between items-center">
                                <pre className="text-sm whitespace-pre-wrap break-words font-mono pr-10">
                                    {systemInstruction.prompt_id ||
                                        "No prompt ID"}
                                </pre>
                                <div className="absolute top-1/2 right-2 transform -translate-y-1/2">
                                    <CopyButton
                                        text={systemInstruction.prompt_id || ""}
                                        tooltipText=""
                                        className="ring-0 z-10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-6">
                        <CollapsibleSection
                            title="System Instruction"
                            isOpen={systemInstructionOpen}
                            onOpenChange={setSystemInstructionOpen}
                        >
                            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[400px]">
                                <pre className="text-sm whitespace-pre-wrap break-words font-mono">
                                    {systemInstruction.instruction_text ||
                                        "No system instruction"}
                                </pre>
                            </div>
                        </CollapsibleSection>
                    </div>
                )}

                {/* Examples Section */}
                {!systemInstruction.use_prompt_id &&
                    systemInstruction.examples &&
                    systemInstruction.examples.length > 0 && (
                        <>
                            <Separator className="my-6" />
                            <div className="mt-4">
                                <CollapsibleSection
                                    title={`Examples (${systemInstruction.examples.length})`}
                                    isOpen={examplesOpen}
                                    onOpenChange={setExamplesOpen}
                                >
                                    <div className="space-y-4">
                                        {systemInstruction.examples.map(
                                            (example, index) => (
                                                <Card key={index}>
                                                    <CardHeader className="py-3">
                                                        <h5 className="text-sm font-medium">
                                                            Example {index + 1}
                                                        </h5>
                                                    </CardHeader>
                                                    <CardContent className="py-3">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <div className="text-sm font-medium mb-2">
                                                                    User:
                                                                </div>
                                                                <div className="bg-muted p-3 rounded-md text-sm">
                                                                    {example.user_message ||
                                                                        "No message"}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium mb-2">
                                                                    Assistant:
                                                                </div>
                                                                <div className="bg-muted p-3 rounded-md text-sm">
                                                                    {example.assistant_message ||
                                                                        "No response"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        )}
                                    </div>
                                </CollapsibleSection>
                            </div>
                        </>
                    )}

                {/* Training Data Section */}
                {!systemInstruction.use_prompt_id &&
                    systemInstruction.training_data &&
                    systemInstruction.training_data.length > 0 && (
                        <>
                            <Separator className="my-6" />
                            <div className="mt-4">
                                <CollapsibleSection
                                    title={`Training Data (${systemInstruction.training_data.length})`}
                                    isOpen={trainingDataOpen}
                                    onOpenChange={setTrainingDataOpen}
                                >
                                    <div className="space-y-4">
                                        {systemInstruction.training_data.map(
                                            (example, index) => (
                                                <Card key={index}>
                                                    <CardHeader className="py-3">
                                                        <h5 className="text-sm font-medium">
                                                            Training Example{" "}
                                                            {index + 1}
                                                        </h5>
                                                    </CardHeader>
                                                    <CardContent className="py-3">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <div className="text-sm font-medium mb-2">
                                                                    User:
                                                                </div>
                                                                <div className="bg-muted p-3 rounded-md text-sm">
                                                                    {example.user_message ||
                                                                        "No message"}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium mb-2">
                                                                    Assistant:
                                                                </div>
                                                                <div className="bg-muted p-3 rounded-md text-sm">
                                                                    {example.assistant_message ||
                                                                        "No response"}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        )}
                                    </div>
                                </CollapsibleSection>
                            </div>
                        </>
                    )}

                <DialogFooter className="mt-6 gap-2">
                    {systemInstruction.use_prompt_id && (
                        <Button
                            variant="outline"
                            className="flex items-center gap-1"
                            onClick={() =>
                                window.open(
                                    getOpenAIPromptUrl(
                                        systemInstruction.prompt_id || ""
                                    ),
                                    "_blank"
                                )
                            }
                        >
                            <ExternalLink size={16} />
                            Open in OpenAI
                        </Button>
                    )}
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
