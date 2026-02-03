import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NewUser, User } from "@/types/user";
import {
    addUser,
    deleteUser,
    toggleUserStatus,
    updateUser,
} from "@/services/userApi";

interface UpdateUserParams {
    id: string;
    data: Partial<NewUser>;
}

interface ToggleUserParams {
    id: string;
    enabled: boolean;
}

export function useUserMutations(
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setUserToDelete: (state: User | null) => void
) {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: addUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            setIsAddDialogOpen(false);
            resetForm();
            toast.success("User added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add user", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: UpdateUserParams) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            setIsEditDialogOpen(false);
            resetForm();
            toast.success("User updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update user", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
            toast.success("User deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete user", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, enabled }: ToggleUserParams) =>
            toggleUserStatus(id, enabled),
        onMutate: async ({ id, enabled }) => {
            await queryClient.cancelQueries({ queryKey: ["users"] });
            const previousUsers = queryClient.getQueryData<User[]>(["users"]);
            queryClient.setQueryData<User[]>(["users"], (old) =>
                old?.map((user) =>
                    user.id.toString() === id ? { ...user, enabled } : user
                )
            );
            return { previousUsers };
        },
        onError: (err, variables, context) => {
            if (context?.previousUsers) {
                queryClient.setQueryData(["users"], context.previousUsers);
            }
            toast.error("Failed to update status", {
                description:
                    err instanceof Error ? err.message : "Unknown error",
            });
        },
        onSuccess: (_, { enabled }) => {
            toast.success(
                `User ${enabled ? "enabled" : "disabled"} successfully`
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });

    return {
        createMutation,
        updateMutation,
        deleteMutation,
        toggleStatusMutation,
    };
}
