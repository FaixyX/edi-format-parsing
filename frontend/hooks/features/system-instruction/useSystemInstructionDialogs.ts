import { useState } from "react";
import { SystemInstruction } from "@/types/system_instruction";

export function useSystemInstructionDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [instructionToEdit, setInstructionToEdit] =
        useState<SystemInstruction | null>(null);
    const [instructionToDelete, setInstructionToDelete] =
        useState<SystemInstruction | null>(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [instructionToView, setInstructionToView] =
        useState<SystemInstruction | null>(null);

    const openAddDialog = () => {
        setIsAddDialogOpen(true);
    };

    const closeAddDialog = () => {
        setIsAddDialogOpen(false);
    };

    const openEditDialog = (instruction: SystemInstruction) => {
        setInstructionToEdit(instruction);
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setTimeout(() => {
            setInstructionToEdit(null);
        }, 100);
    };

    const openDeleteDialog = (instruction: SystemInstruction) => {
        setInstructionToDelete(instruction);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setTimeout(() => {
            setInstructionToDelete(null);
        }, 100);
    };

    const openViewDialog = (instruction: SystemInstruction) => {
        setInstructionToView(instruction);
        setIsViewDialogOpen(true);
    };

    const closeViewDialog = () => {
        setIsViewDialogOpen(false);
        setTimeout(() => {
            setInstructionToView(null);
        }, 100);
    };

    return {
        // Dialog states
        isAddDialogOpen,
        isEditDialogOpen,
        isDeleteDialogOpen,
        isViewDialogOpen,
        instructionToEdit,
        instructionToDelete,
        instructionToView,

        // Dialog actions
        openAddDialog,
        closeAddDialog,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
        openViewDialog,
        closeViewDialog,
    };
}
