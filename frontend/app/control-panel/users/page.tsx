"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/services/userApi";
import { useUserFormHandlers } from "@/hooks/features/user/useUserFormHandlers";
import { useUserDialogs } from "@/hooks/features/user/useUserDialogs";
import { useUserHandlers } from "@/hooks/features/user/useUserHandlers";

import { UserTable } from "@/components/user/UserTable";
import { AddUserDialog } from "@/components/user/AddUserDialog";
import { EditUserDialog } from "@/components/user/EditUserDialog";
import { DeleteUserDialog } from "@/components/user/DeleteUserDialog";
import { User } from "@/types/user";

export default function UserTablePage() {
    const {
        newUser,
        handleInputChange,
        userToEdit,
        handleTypeChange,
        setUserToEdit,
        resetForm,
    } = useUserFormHandlers();

    const {
        isAddDialogOpen,
        setIsAddDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        isDeleteDialogOpen,
        setIsDeleteDialogOpen,
        userToDelete,
        setUserToDelete,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
    } = useUserDialogs();

    const {
        handleAddUser,
        handleEditUser,
        handleDeleteUser,
        isAdding,
        isEditing,
        isDeleting,
        toggleStatusMutation,
    } = useUserHandlers(
        userToDelete,
        userToEdit,
        setIsAddDialogOpen,
        resetForm,
        setIsEditDialogOpen,
        setIsDeleteDialogOpen,
        setUserToDelete
    );

    // Fetch Users Query
    const {
        data: users = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
    });

    const handleOpenEdit = (user: User) => {
        setUserToEdit(user); // Set the editing agency state
        openEditDialog(user); // Open the dialog
    };

    // Handle closing the edit dialog
    const handleCloseEdit = () => {
        closeEditDialog();
        // Optional: Reset the editingAgency after dialog closes
        // setTimeout(() => setEditingAgency(null), 100);
    };

    return (
        <div className="space-y-6">
            <UserTable
                users={users}
                isLoading={isLoading}
                error={error}
                onEdit={handleOpenEdit}
                onDelete={openDeleteDialog}
                onRetry={refetch}
                onAdd={() => setIsAddDialogOpen(true)}
                onToggleStatus={(id, enabled) =>
                    toggleStatusMutation.mutate({ id, enabled })
                }
                isTogglingStatus={(id) =>
                    toggleStatusMutation.isPending &&
                    toggleStatusMutation.variables?.id === id
                }
                onRefresh={refetch}
            />

            <AddUserDialog
                isOpen={isAddDialogOpen}
                onClose={() => {
                    setIsAddDialogOpen(false);
                }}
                onSubmit={() => {
                    handleAddUser(newUser as User);
                }}
                isSubmitting={isAdding}
                user={newUser}
                onInputChange={handleInputChange}
                onTypeChange={handleTypeChange}
            />

            {userToEdit && (
                <EditUserDialog
                    isOpen={isEditDialogOpen}
                    onClose={handleCloseEdit}
                    onSubmit={handleEditUser}
                    isSubmitting={isEditing}
                    user={userToEdit}
                    onInputChange={(e) => handleInputChange(e, true)}
                    onTypeChange={(value) => handleTypeChange(value, true)}
                />
            )}

            <DeleteUserDialog
                isOpen={isDeleteDialogOpen}
                onClose={closeDeleteDialog}
                onConfirm={handleDeleteUser}
                isDeleting={isDeleting}
            />
        </div>
    );
}
