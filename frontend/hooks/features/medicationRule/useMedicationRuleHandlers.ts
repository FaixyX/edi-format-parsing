import { useCallback } from "react";
import { toast } from "sonner";
import { NewMedicationRule, MedicationRule } from "@/types/medicationRule";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    addMedicationRule,
    updateMedicationRule,
    deleteMedicationRule,
} from "@/services/medicationRuleApi";
import { useMedicationRuleMutations } from "@/hooks/features/medicationRule/useMedicationRuleMutations";

export function useMedicationRuleHandlers(
    ruleToDelete: MedicationRule | null,
    ruleToEdit: MedicationRule | null,
    setIsAddDialogOpen: (open: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (open: boolean) => void,
    setIsDeleteDialogOpen: (open: boolean) => void,
    setRuleToDelete: (rule: MedicationRule | null) => void,
    setRuleToEdit: (rule: MedicationRule | null) => void
) {
    const queryClient = useQueryClient();

    const { createMutation, deleteMutation, updateMutation } =
        useMedicationRuleMutations(
            setIsAddDialogOpen,
            resetForm,
            setIsDeleteDialogOpen,
            setRuleToDelete,
            setIsEditDialogOpen,
            setRuleToEdit
        );

    const handleAddRule = useCallback(
        (rule: NewMedicationRule) => {
            createMutation.mutate(rule);
        },
        [createMutation]
    );

    const handleEditRule = useCallback(
        (editingRule: NewMedicationRule | null) => {
            if (editingRule && typeof editingRule.id === "number") {
                updateMutation.mutate({
                    id: editingRule.id,
                    data: editingRule as NewMedicationRule,
                });
            }
        },
        [updateMutation]
    );

    const handleDeleteRule = useCallback(() => {
        if (ruleToDelete) {
            deleteMutation.mutate(ruleToDelete.id);
        }
    }, [ruleToDelete, deleteMutation]);

    return {
        handleAddRule,
        handleEditRule,
        handleDeleteRule,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
