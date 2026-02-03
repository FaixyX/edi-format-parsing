"use client";

import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useSystemInstructionMutations } from "@/hooks/features/system-instruction/useSystemInstructionMutations";
import { SystemInstruction } from "@/types/system_instruction";
import { initialSystemInstructionExample } from "@/constants/system_instruction";
import {
    SystemInstructionForm,
    SystemInstructionFormValues,
} from "./SystemInstructionForm";
import { useOpenAIModels } from "@/hooks/features/system-instruction/useOpenAIModels";

interface EditSystemInstructionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    systemInstruction: SystemInstruction | null;
}

export function EditSystemInstructionDialog({
    isOpen,
    onClose,
    systemInstruction,
}: EditSystemInstructionDialogProps) {
    const { updateMutation } = useSystemInstructionMutations();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examplesOpen, setExamplesOpen] = useState(true);
    const {
        modelOptions,
        isLoading: isLoadingModels,
        refetch: refetchModels,
    } = useOpenAIModels();
    const [defaultValues, setDefaultValues] =
        useState<SystemInstructionFormValues>({
            name: "",
            instruction_text: "",
            prompt_id: "",
            use_prompt_id: false,
            description: "",
            is_active: true,
            model_id: "",
            examples: [],
            training_data: [],
        });

    useEffect(() => {
        if (systemInstruction && isOpen) {
            setDefaultValues({
                name: systemInstruction.name,
                instruction_text: systemInstruction.instruction_text || "",
                prompt_id: systemInstruction.prompt_id || "",
                use_prompt_id: systemInstruction.use_prompt_id || false,
                description: systemInstruction.description || "",
                is_active: systemInstruction.is_active,
                model_id: systemInstruction.model_id || "",
                examples: systemInstruction.examples || [],
                training_data: systemInstruction.training_data || [],
            });
        }
    }, [systemInstruction, isOpen]);

    const handleSubmit = async (values: SystemInstructionFormValues) => {
        if (!systemInstruction) return;

        setIsSubmitting(true);
        try {
            await updateMutation.mutateAsync({
                id: systemInstruction.id,
                instruction: {
                    ...values,
                    description: values.description || null,
                    // If using prompt_id, clear instruction_text and examples
                    instruction_text: values.use_prompt_id
                        ? undefined
                        : values.instruction_text,
                    examples: values.use_prompt_id ? [] : values.examples,
                    training_data: values.training_data,
                    // If not using prompt_id, clear prompt_id
                    prompt_id: values.use_prompt_id
                        ? values.prompt_id
                        : undefined,
                    // Keep model_id regardless of prompt_id usage
                    model_id: values.model_id || undefined,
                },
            });
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit System Instruction</DialogTitle>
                </DialogHeader>
                <SystemInstructionForm
                    defaultValues={defaultValues}
                    onSubmit={handleSubmit}
                    onCancel={onClose}
                    isSubmitting={isSubmitting}
                    submitText="Update Instruction"
                    loadingText="Updating..."
                    initialSystemInstructionExample={
                        initialSystemInstructionExample
                    }
                    examplesOpen={examplesOpen}
                    onExamplesOpenChange={setExamplesOpen}
                    modelOptions={modelOptions}
                    isLoadingModels={isLoadingModels}
                    refetchModels={refetchModels}
                />
            </DialogContent>
        </Dialog>
    );
}
