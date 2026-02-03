import { addRule, deleteRule, updateRule } from "@/services/ruleApi";
import { Rule, NewRule } from "@/types/rule";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useRuleMutations(
    pdfTypeId: string,
    setIsAddDialogOpen: (state: boolean) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setRuleToDelete: (state: Rule | null) => void,
    resetForm: () => void
) {
    const queryClient = useQueryClient();
    const queryKey = ["rules", pdfTypeId];

    const createMutation = useMutation({
        mutationFn: (rule: NewRule) => addRule(pdfTypeId, rule),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setIsAddDialogOpen(false);
            resetForm();
            toast.success("Rule added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add rule", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ ruleId, rule }: { ruleId: number; rule: NewRule }) =>
            updateRule(ruleId, rule),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            setIsEditDialogOpen(false);
            resetForm();
            toast.success("Rule updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update rule", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteRule,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
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

    return {
        createMutation,
        updateMutation,
        deleteMutation,
    };
}
