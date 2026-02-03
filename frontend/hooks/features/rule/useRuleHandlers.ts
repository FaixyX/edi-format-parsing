import { useRuleMutations } from "@/hooks/features/rule/useRuleMutations";
import { Rule, NewRule } from "@/types/rule";

export const useRuleHandlers = (
    pdfTypeId: string,
    ruleToDelete: Rule | null,
    editingRule: Rule | null,
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setRuleToDelete: (state: Rule | null) => void
) => {
    const { createMutation, updateMutation, deleteMutation } = useRuleMutations(
        pdfTypeId,
        setIsAddDialogOpen,
        setIsEditDialogOpen,
        setIsDeleteDialogOpen,
        setRuleToDelete,
        resetForm
    );

    const handleAddRule = (newRule: NewRule) => {
        // Format the rule for submission
        const { llm_system_instruction, llm_examples, ...baseRule } = newRule;

        const submissionRule: NewRule = {
            ...baseRule,
            // Only include LLM fields if it's an LLM rule type
            ...(newRule.rule_type === "LLM_SIMPLE" ||
            newRule.rule_type === "LLM_COMPLEX"
                ? {
                      llm_system_instruction,
                      llm_examples,
                  }
                : {}),
        };

        createMutation.mutate(submissionRule);
    };

    const handleEditRule = () => {
        if (editingRule) {
            const {
                id,
                pdf_type_id,
                llm_system_instruction,
                llm_examples,
                ...ruleData
            } = editingRule;

            // Format the rule for submission
            const baseRule = {
                ...ruleData,
                pdf_fields: ruleData.pdf_fields.map(
                    ({ id, rule_id, ...field }) => field
                ),
                excel_cells: ruleData.excel_cells.map(
                    ({ id, rule_id, ...cell }) => cell
                ),
            };

            const submissionRule: NewRule = {
                ...baseRule,
                // Only include LLM fields if it's an LLM rule type
                ...(ruleData.rule_type === "LLM_SIMPLE" ||
                ruleData.rule_type === "LLM_COMPLEX"
                    ? {
                          llm_system_instruction,
                          llm_examples,
                      }
                    : {}),
            };

            updateMutation.mutate({
                ruleId: id,
                rule: submissionRule,
            });
        }
    };

    const handleDeleteRule = () => {
        if (ruleToDelete) {
            deleteMutation.mutate(ruleToDelete.id);
        }
    };

    return {
        handleAddRule,
        handleEditRule,
        handleDeleteRule,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
};
