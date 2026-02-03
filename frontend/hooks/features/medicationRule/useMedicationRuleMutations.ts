// Medication rule mutations for CRUD operations
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MedicationRule, NewMedicationRule } from "@/types/medicationRule";
import {
    addMedicationRule,
    deleteMedicationRule,
    updateMedicationRule,
} from "@/services/medicationRuleApi";

interface UpdateMedicationRuleParams {
    id: number;
    data: NewMedicationRule;
}

export function useMedicationRuleMutations(
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setRuleToDelete: (state: MedicationRule | null) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setRuleToEdit: (state: MedicationRule | null) => void
) {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: addMedicationRule,
        onSuccess: () => {
            setIsAddDialogOpen(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ["medicationRules"] });
            toast.success("Rule added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add rule", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteMedicationRule(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["medicationRules"] });
            setIsDeleteDialogOpen(false);
            setRuleToDelete(null);
            toast.success("Rule deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete rule", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: UpdateMedicationRuleParams) =>
            updateMedicationRule(id, data),
        onSuccess: () => {
            setIsEditDialogOpen(false);
            setRuleToEdit(null);
            queryClient.invalidateQueries({ queryKey: ["medicationRules"] });
            toast.success("Rule updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update rule", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    return {
        createMutation,
        deleteMutation,
        updateMutation,
    };
}
