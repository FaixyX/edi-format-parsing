"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useSystemInstructionMutations } from "@/hooks/features/system-instruction/useSystemInstructionMutations";
import {
    initialSystemInstructionState,
    initialSystemInstructionExample,
} from "@/constants/system_instruction";
import {
    SystemInstructionForm,
    SystemInstructionFormValues,
} from "./SystemInstructionForm";
import { useOpenAIModels } from "@/hooks/features/system-instruction/useOpenAIModels";

interface AddSystemInstructionDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddSystemInstructionDialog({
    isOpen,
    onClose,
}: AddSystemInstructionDialogProps) {
    const { addMutation } = useSystemInstructionMutations();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [examplesOpen, setExamplesOpen] = useState(true);
    const {
        modelOptions,
        isLoading: isLoadingModels,
        refetch: refetchModels,
    } = useOpenAIModels();

    const handleSubmit = async (values: SystemInstructionFormValues) => {
        setIsSubmitting(true);
        try {
            await addMutation.mutateAsync({
                ...values,
                description: values.description || null,
                // If using prompt_id, clear instruction_text and examples
                instruction_text: values.use_prompt_id
                    ? undefined
                    : values.instruction_text,
                examples: values.use_prompt_id ? [] : values.examples,
                training_data: values.use_prompt_id ? [] : values.training_data,
                // If not using prompt_id, clear prompt_id
                prompt_id: values.use_prompt_id ? values.prompt_id : undefined,
                // Keep model_id regardless of prompt_id usage
                model_id: values.model_id || undefined,
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
                    <DialogTitle>Add System Instruction</DialogTitle>
                </DialogHeader>
                <SystemInstructionForm
                    defaultValues={{
                        ...initialSystemInstructionState,
                        description: "",
                        examples: initialSystemInstructionState.examples || [],
                        training_data:
                            initialSystemInstructionState.training_data || [],
                        use_prompt_id: false,
                        model_id: "",
                    }}
                    onSubmit={handleSubmit}
                    onCancel={() => onClose()}
                    isSubmitting={isSubmitting}
                    submitText="Add Instruction"
                    loadingText="Adding..."
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
