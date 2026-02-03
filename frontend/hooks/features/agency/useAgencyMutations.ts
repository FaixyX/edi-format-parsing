import { addAgency, deleteAgency, updateAgency } from "@/services/agencyApi";
import { Agency } from "@/types/agency";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useAgencyMutations(
    setIsAddDialogOpen: (state: boolean) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setAgencyToDelete: (state: Agency | null) => void,
    resetForm: () => void
) {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: addAgency,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agencies"] });
            setIsAddDialogOpen(false);
            resetForm();
            toast.success("Agency added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add agency", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: updateAgency,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agencies"] });
            setIsEditDialogOpen(false);
            resetForm();
            toast.success("Agency updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update agency", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAgency,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["agencies"] });
            setIsDeleteDialogOpen(false);
            setAgencyToDelete(null);
            toast.success("Agency deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete agency", {
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
