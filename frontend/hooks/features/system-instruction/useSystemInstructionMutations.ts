import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    addSystemInstruction,
    updateSystemInstruction,
    deleteSystemInstruction,
    toggleSystemInstructionStatus,
} from "@/services/systemInstructionApi";
import {
    NewSystemInstruction,
    SystemInstruction,
} from "@/types/system_instruction";
import { toast } from "sonner";

export function useSystemInstructionMutations() {
    const queryClient = useQueryClient();
    const queryKey = ["systemInstructions"];

    const addMutation = useMutation({
        mutationFn: (instruction: NewSystemInstruction) =>
            addSystemInstruction(instruction),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success("System instruction added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add system instruction", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            instruction,
        }: {
            id: string;
            instruction: Partial<NewSystemInstruction>;
        }) => updateSystemInstruction(id, instruction),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success("System instruction updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update system instruction", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteSystemInstruction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            toast.success("System instruction deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete system instruction", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            toggleSystemInstructionStatus(id, is_active),
        onMutate: async ({ id, is_active }) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousInstructions =
                queryClient.getQueryData<SystemInstruction[]>(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData<SystemInstruction[]>(queryKey, (old) =>
                old?.map((instruction) =>
                    instruction.id === id
                        ? { ...instruction, is_active }
                        : instruction
                )
            );

            // Return a context object with the previous value
            return { previousInstructions };
        },
        onError: (err, variables, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousInstructions) {
                queryClient.setQueryData(
                    queryKey,
                    context.previousInstructions
                );
            }
            toast.error("Failed to update status", {
                description:
                    err instanceof Error ? err.message : "Unknown error",
            });
        },
        onSuccess: (_, { is_active }) => {
            toast.success(
                `System instruction ${
                    is_active ? "enabled" : "disabled"
                } successfully`
            );
        },
        onSettled: () => {
            // Always refetch after error or success to ensure we're up to date
            queryClient.invalidateQueries({ queryKey });
        },
    });

    return {
        addMutation,
        updateMutation,
        deleteMutation,
        toggleStatusMutation,
    };
}
