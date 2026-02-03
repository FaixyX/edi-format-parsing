"use client";

import { useState } from "react";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { SystemInstructionExample } from "@/types/system_instruction";
import { ExamplesSection } from "@/components/shared/examples/ExamplesSection";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogFooter } from "@/components/ui/dialog";
import { ComboboxField } from "@/components/ui/data-table/combobox-field";
import { systemInstructionNameOptions } from "@/constants/system_instruction_options";
import {
    CodeSnippetParser,
    ParsedData,
} from "@/components/shared/code-snippet/CodeSnippetParser";
import { FileText, Key } from "lucide-react";
import { TrainingDataSection } from "@/components/shared/examples/ExamplesSection";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";

export const systemInstructionFormSchema = z
    .object({
        name: z.string().min(1, "Name is required"),
        instruction_text: z.string().optional(),
        prompt_id: z
            .string()
            .optional()
            .refine((val) => !val || val.startsWith("pmpt_"), {
                message: "Prompt ID must start with 'pmpt_'",
            }),
        use_prompt_id: z.boolean().default(false),
        description: z.string().optional(),
        is_active: z.boolean().default(true),
        examples: z
            .array(
                z.object({
                    user_message: z.string(),
                    assistant_message: z.string(),
                })
            )
            .default([]),
        training_data: z
            .array(
                z.object({
                    user_message: z.string(),
                    assistant_message: z.string(),
                })
            )
            .default([]),
        model_id: z.string().optional(),
    })
    .refine(
        (data) => {
            // Either instruction_text or prompt_id must be provided based on use_prompt_id
            if (data.use_prompt_id) {
                return !!data.prompt_id;
            } else {
                return !!data.instruction_text;
            }
        },
        {
            message:
                "Either system instruction or OpenAI prompt ID must be provided",
            path: ["instruction_text"],
        }
    );

export type SystemInstructionFormValues = z.infer<
    typeof systemInstructionFormSchema
>;

interface SystemInstructionFormProps {
    defaultValues: SystemInstructionFormValues;
    onSubmit: (values: SystemInstructionFormValues) => Promise<void>;
    onCancel: () => void;
    isSubmitting: boolean;
    submitText: string;
    loadingText: string;
    initialSystemInstructionExample: SystemInstructionExample;
    examplesOpen?: boolean;
    onExamplesOpenChange?: (open: boolean) => void;
    isLoadingModels: boolean;
    refetchModels: () => void;
    modelOptions: { value: string; label: string }[];
}

export function SystemInstructionForm({
    defaultValues,
    onSubmit,
    onCancel,
    isSubmitting,
    submitText,
    loadingText,
    initialSystemInstructionExample,
    examplesOpen = true,
    onExamplesOpenChange = () => {},
    isLoadingModels,
    refetchModels,
    modelOptions,
}: SystemInstructionFormProps) {
    const [newExample, setNewExample] = useState<SystemInstructionExample>({
        ...initialSystemInstructionExample,
    });
    const [editingExampleIndex, setEditingExampleIndex] = useState<
        number | null
    >(null);
    const [editingExample, setEditingExample] =
        useState<SystemInstructionExample | null>(null);
    const [activeTab, setActiveTab] = useState("manual");
    const [newTrainingData, setNewTrainingData] =
        useState<SystemInstructionExample>({
            ...initialSystemInstructionExample,
        });
    const [editingTrainingDataIndex, setEditingTrainingDataIndex] = useState<
        number | null
    >(null);
    const [editingTrainingData, setEditingTrainingData] =
        useState<SystemInstructionExample | null>(null);
    const [trainingDataOpen, setTrainingDataOpen] = useState(true);

    const handleRefreshModels = async () => {
        return await refetchModels();
    };

    const form = useForm<SystemInstructionFormValues>({
        resolver: zodResolver(systemInstructionFormSchema),
        defaultValues,
    });

    const examples = form.watch("examples");
    const usePromptId = form.watch("use_prompt_id");
    const trainingData = form.watch("training_data");

    // When toggling use_prompt_id, update the active tab
    const handleUsePromptIdChange = (value: boolean) => {
        form.setValue("use_prompt_id", value);
        if (value) {
            setActiveTab("prompt_id");
        } else {
            setActiveTab("manual");
        }
    };

    const handleExampleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setNewExample((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddExample = () => {
        // Allow adding examples even if fields are empty
        const currentExamples = form.getValues("examples") || [];
        form.setValue("examples", [...currentExamples, { ...newExample }]);
        setNewExample({ ...initialSystemInstructionExample });
    };

    const handleRemoveExample = (index: number) => {
        const currentExamples = form.getValues("examples") || [];
        form.setValue(
            "examples",
            currentExamples.filter((_, i) => i !== index)
        );
    };

    const handleEditExample = (index: number) => {
        const currentExamples = form.getValues("examples") || [];
        setEditingExampleIndex(index);
        setEditingExample({ ...currentExamples[index] });
    };

    const handleCancelEditExample = () => {
        setEditingExampleIndex(null);
        setEditingExample(null);
    };

    const handleEditExampleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setEditingExample((prev) => (prev ? { ...prev, [name]: value } : null));
    };

    const handleSaveEditExample = () => {
        if (!editingExample || editingExampleIndex === null) return;

        const currentExamples = form.getValues("examples") || [];
        const updatedExamples = [...currentExamples];
        updatedExamples[editingExampleIndex] = editingExample;
        form.setValue("examples", updatedExamples);

        setEditingExampleIndex(null);
        setEditingExample(null);
    };

    const handleParsedData = (data: ParsedData) => {
        // Update system instruction if option is enabled
        if (data.updateSystemInstruction) {
            form.setValue("instruction_text", data.systemInstruction);
            form.setValue("use_prompt_id", false);
            setActiveTab("manual");
        }

        // Handle examples based on target type and append option
        if (data.targetExampleType === "examples") {
            const currentExamples = data.appendExamples
                ? form.getValues("examples") || []
                : [];
            form.setValue("examples", [...currentExamples, ...data.examples]);
        } else if (data.targetExampleType === "training_data") {
            const currentTrainingData = data.appendExamples
                ? form.getValues("training_data") || []
                : [];
            form.setValue("training_data", [
                ...currentTrainingData,
                ...data.examples,
            ]);
        }
    };

    // Handlers for training data
    const handleTrainingDataInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setNewTrainingData((prev) => ({ ...prev, [name]: value }));
    };
    const handleAddTrainingData = () => {
        const current = form.getValues("training_data") || [];
        form.setValue("training_data", [...current, { ...newTrainingData }]);
        setNewTrainingData({ ...initialSystemInstructionExample });
    };
    const handleRemoveTrainingData = (index: number) => {
        const current = form.getValues("training_data") || [];
        form.setValue(
            "training_data",
            current.filter((_, i) => i !== index)
        );
    };
    const handleEditTrainingData = (index: number) => {
        const current = form.getValues("training_data") || [];
        setEditingTrainingDataIndex(index);
        setEditingTrainingData({ ...current[index] });
    };
    const handleCancelEditTrainingData = () => {
        setEditingTrainingDataIndex(null);
        setEditingTrainingData(null);
    };
    const handleEditTrainingDataChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setEditingTrainingData((prev) =>
            prev ? { ...prev, [name]: value } : null
        );
    };
    const handleSaveEditTrainingData = () => {
        if (!editingTrainingData || editingTrainingDataIndex === null) return;
        const current = form.getValues("training_data") || [];
        const updated = [...current];
        updated[editingTrainingDataIndex] = editingTrainingData;
        form.setValue("training_data", updated);
        setEditingTrainingDataIndex(null);
        setEditingTrainingData(null);
    };

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6 mt-4"
            >
                <div className="space-y-4">
                    <ComboboxField
                        label="Name"
                        id="instruction-name"
                        options={systemInstructionNameOptions}
                        useFormControl={true}
                        name="name"
                        placeholder="Select an instruction name"
                        searchPlaceholder="Search names..."
                        emptyMessage="No name found"
                        labelPosition="top"
                    />
                </div>

                <div className=" flex gap-2 justify-between items-end">
                    <div className="flex-grow">
                        <ComboboxField
                            label="Model"
                            id="model_id"
                            options={modelOptions}
                            useFormControl={true}
                            name="model_id"
                            placeholder="Select a model... (default: gpt-4o)"
                            searchPlaceholder="Search models..."
                            emptyMessage={
                                isLoadingModels
                                    ? "Loading models..."
                                    : "No model found."
                            }
                            disabled={isLoadingModels}
                            labelPosition="top"
                        />
                    </div>

                    <RefreshButton
                        tooltipText="Refresh models"
                        onRefresh={handleRefreshModels}
                        successMessage="Models refreshed successfully"
                        errorMessage="Failed to refresh models"
                        disabled={isLoadingModels}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Enter description"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="use_prompt_id"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <div className="flex flex-col space-y-1.5">
                                <FormLabel>Instruction Type</FormLabel>
                                <FormDescription>
                                    Choose how you want to define this system
                                    instruction
                                </FormDescription>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={`flex flex-col items-center justify-center p-4 border rounded-md cursor-pointer transition-all ${
                                        !field.value
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-muted hover:border-primary/50"
                                    }`}
                                    onClick={() =>
                                        handleUsePromptIdChange(false)
                                    }
                                >
                                    <FileText
                                        className={`h-8 w-8 mb-2 ${
                                            !field.value
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    />
                                    <span
                                        className={`font-medium ${
                                            !field.value
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        Manual Entry
                                    </span>
                                    <span className="text-xs text-center mt-1 text-muted-foreground">
                                        Write your own instruction text
                                    </span>
                                </div>
                                <div
                                    className={`flex flex-col items-center justify-center p-4 border rounded-md cursor-pointer transition-all ${
                                        field.value
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-muted hover:border-primary/50"
                                    }`}
                                    onClick={() =>
                                        handleUsePromptIdChange(true)
                                    }
                                >
                                    <Key
                                        className={`h-8 w-8 mb-2 ${
                                            field.value
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    />
                                    <span
                                        className={`font-medium ${
                                            field.value
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        OpenAI Prompt ID
                                    </span>
                                    <span className="text-xs text-center mt-1 text-muted-foreground">
                                        Use a saved OpenAI prompt
                                    </span>
                                </div>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {usePromptId ? (
                    <FormField
                        control={form.control}
                        name="prompt_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>OpenAI Prompt ID</FormLabel>
                                <div className="space-y-2">
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                placeholder="Enter OpenAI prompt ID (e.g. pmpt_123456789...)"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormDescription className="flex items-start gap-2">
                                        <a
                                            href="https://platform.openai.com/playground"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline block mt-1"
                                        >
                                            Go to OpenAI Playground →
                                        </a>
                                    </FormDescription>
                                    <FormMessage />
                                </div>
                            </FormItem>
                        )}
                    />
                ) : (
                    <Tabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        className="mt-6"
                    >
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="manual">
                                Manual Entry
                            </TabsTrigger>
                            <TabsTrigger value="code">
                                From Code Snippet
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="code">
                            <CodeSnippetParser
                                onParsedData={handleParsedData}
                                showTrainingDataOption={true}
                                defaultOptions={{
                                    updateSystemInstruction: true,
                                    targetExampleType: "examples",
                                    appendExamples: false,
                                }}
                            />
                        </TabsContent>

                        <TabsContent value="manual">
                            <FormField
                                control={form.control}
                                name="instruction_text"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            System Instruction
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter the system instruction content"
                                                className="h-40 resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            This text will be used as the system
                                            instruction for OpenAI API calls.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Separator className="my-6" />

                            <ExamplesSection
                                isOpen={examplesOpen}
                                onOpenChange={onExamplesOpenChange}
                                newExample={newExample}
                                examples={examples}
                                onExampleInputChange={handleExampleInputChange}
                                onAddExample={handleAddExample}
                                onRemoveExample={handleRemoveExample}
                                onEditExample={handleEditExample}
                                onCancelEditExample={handleCancelEditExample}
                                editingExampleIndex={editingExampleIndex}
                                editingExample={editingExample}
                                onEditExampleChange={handleEditExampleChange}
                                onSaveEditExample={handleSaveEditExample}
                                labelPrefix="Example"
                            />
                            <div className="mt-6" />
                            <TrainingDataSection
                                isOpen={trainingDataOpen}
                                onOpenChange={setTrainingDataOpen}
                                newExample={newTrainingData}
                                examples={trainingData}
                                onExampleInputChange={
                                    handleTrainingDataInputChange
                                }
                                onAddExample={handleAddTrainingData}
                                onRemoveExample={handleRemoveTrainingData}
                                onEditExample={handleEditTrainingData}
                                onCancelEditExample={
                                    handleCancelEditTrainingData
                                }
                                editingExampleIndex={editingTrainingDataIndex}
                                editingExample={editingTrainingData}
                                onEditExampleChange={
                                    handleEditTrainingDataChange
                                }
                                onSaveEditExample={handleSaveEditTrainingData}
                                title="Training Data"
                                labelPrefix="Training Example"
                            />
                        </TabsContent>
                    </Tabs>
                )}

                <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between w-full">
                            <div className="space-y-0.5">
                                <FormLabel>Active</FormLabel>
                                <FormDescription>
                                    Instruction can be used when active
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} type="button">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? loadingText : submitText}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
