import { useState } from "react";
import { Rule } from "@/types/rule";

export function useRuleDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

    const openEditDialog = (rule: Rule) => {
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
    };

    const openDeleteDialog = (rule: Rule) => {
        setRuleToDelete(rule);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setTimeout(() => {
            setRuleToDelete(null);
        }, 100);
    };

    return {
        isAddDialogOpen,
        setIsAddDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        isDeleteDialogOpen,
        setIsDeleteDialogOpen,
        ruleToDelete,
        setRuleToDelete,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
    };
}
