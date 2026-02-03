import { useState } from "react";
import { MedicationRule } from "@/types/medicationRule";

export function useMedicationRuleDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<MedicationRule | null>(
        null
    );
    const [ruleToEdit, setRuleToEdit] = useState<MedicationRule | null>(null);

    const openEditDialog = (rule: MedicationRule) => {
        setRuleToEdit(rule);
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setTimeout(() => {
            setRuleToEdit(null);
        }, 100);
    };

    const openDeleteDialog = (rule: MedicationRule) => {
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
        isDeleteDialogOpen,
        ruleToDelete,
        ruleToEdit,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
        setRuleToDelete,
        setIsDeleteDialogOpen,
        setIsEditDialogOpen,
        setRuleToEdit,
    };
}
