import { useState } from "react";
import { User } from "@/types/user";

export function useUserDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const openEditDialog = (user: User) => {
        setUserToEdit(user);
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setUserToEdit(null);
    };

    const openDeleteDialog = (user: User) => {
        setUserToDelete(user);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
    };

    return {
        isAddDialogOpen,
        setIsAddDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        isDeleteDialogOpen,
        setIsDeleteDialogOpen,
        userToEdit,
        setUserToEdit,
        userToDelete,
        setUserToDelete,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
    };
}
