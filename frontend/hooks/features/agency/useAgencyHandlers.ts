import { useAgencyMutations } from "@/hooks/features/agency/useAgencyMutations";
import { useState } from "react";
import { Agency, NewAgency } from "@/types/agency";
import { AgencyFormValues } from "@/schema/agency-schema";

export const useAgencyHandlers = (
    agencyToDelete: Agency | null,
    editingAgency: Agency | null,
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setAgencyToDelete: (state: Agency | null) => void
) => {
    const [showPassword, setShowPassword] = useState<Record<string, boolean>>(
        {}
    );

    const { createMutation, updateMutation, deleteMutation } =
        useAgencyMutations(
            setIsAddDialogOpen,
            setIsEditDialogOpen,
            setIsDeleteDialogOpen,
            setAgencyToDelete,
            resetForm
        );

    const handleAddAgency = (formData: AgencyFormValues) => {
        // Convert form data to NewAgency format
        // Convert empty string to null for NPI
        const npi = formData.npi?.trim() || null;
        const newAgency: NewAgency = {
            name: formData.name || "",
            link: formData.link || "",
            npi: npi || null,
            username: formData.username || "",
            password: formData.password || "",
        };
        createMutation.mutate(newAgency);
    };

    const handleEditAgency = (formData: AgencyFormValues) => {
        if (editingAgency) {
            // Convert form data to Agency format
            // Convert empty string to null for NPI
            const npi = formData.npi?.trim() || null;
            const updatedAgency: Agency = {
                ...editingAgency,
                name: formData.name ?? editingAgency.name,
                link: formData.link ?? editingAgency.link,
                npi: npi || null,
                username: formData.username ?? editingAgency.username,
                password: formData.password ?? editingAgency.password,
            };
            updateMutation.mutate(updatedAgency);
        }
    };

    const handleDeleteAgency = () => {
        if (agencyToDelete) {
            deleteMutation.mutate(agencyToDelete.id);
        }
    };

    const togglePassword = (id: string) => {
        setShowPassword((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    return {
        handleAddAgency,
        handleEditAgency,
        handleDeleteAgency,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
        showPassword,
        togglePassword,
    };
};
