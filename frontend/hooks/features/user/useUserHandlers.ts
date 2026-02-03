import { useUserMutations } from "@/hooks/features/user/useUserMutations";
import { useUserFormHandlers } from "@/hooks/features/user/useUserFormHandlers";
import { useUserDialogs } from "@/hooks/features/user/useUserDialogs";
import { NewUser, User } from "@/types/user";
import { on } from "events";

export const useUserHandlers = (
    userToDelete: User | null,
    userToEdit: User | null,
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setUserToDelete: (state: User | null) => void
) => {
    const {
        createMutation,
        updateMutation,
        deleteMutation,
        toggleStatusMutation,
    } = useUserMutations(
        setIsAddDialogOpen,
        resetForm,
        setIsEditDialogOpen,
        setIsDeleteDialogOpen,
        setUserToDelete
    );
    const { closeEditDialog, closeDeleteDialog } = useUserDialogs();

    const handleAddUser = (newUser: NewUser) => {
        createMutation.mutate(newUser);
    };

    const handleEditUser = () => {
        if (userToEdit) {
            const updateData = {
                username: userToEdit.username,
                type: userToEdit.type,
                password: userToEdit.password || "",
            };
            updateMutation.mutate({
                id: userToEdit.id.toString(),
                data: updateData,
            });
        }
    };

    const handleDeleteUser = () => {
        if (userToDelete) {
            deleteMutation.mutate(userToDelete.id.toString());
        }
    };

    return {
        handleAddUser,
        handleEditUser,
        handleDeleteUser,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        toggleStatusMutation,
    };
};
