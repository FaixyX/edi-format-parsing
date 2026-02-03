import { useMacAddressFormHandlers } from "@/hooks/features/mac-address/useMacAddressFormHandlers";
import { useMacAddressDialogs } from "@/hooks/features/mac-address/useMacAddressDialogs";
import { useMacAddressMutations } from "@/hooks/features/mac-address/useMacAddressMutations";
import { MacAddress, NewMacAddress } from "@/types/macAddress";

export function useMacAddressHandlers(
    macToDelete: MacAddress | null,
    macToEdit: MacAddress | null,
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setMacToDelete: (state: MacAddress | null) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setMacToEdit: (state: MacAddress | null) => void
) {
    const {
        createMutation,
        deleteMutation,
        updateMutation,
        toggleStatusMutation,
    } = useMacAddressMutations(
        setIsAddDialogOpen,
        resetForm,
        setIsDeleteDialogOpen,
        setMacToDelete,
        setIsEditDialogOpen,
        setMacToEdit
    );

    const handleAddMacAddress = (newMacAddress: NewMacAddress) => {
        createMutation.mutate(newMacAddress);
    };

    const handleEditMacAddress = () => {
        if (macToEdit) {
            updateMutation.mutate({
                id: macToEdit.id,
                data: macToEdit,
            });
        }
    };

    const handleDeleteMacAddress = () => {
        if (macToDelete) {
            deleteMutation.mutate(macToDelete.id);
        }
    };

    return {
        toggleStatusMutation,
        handleAddMacAddress,
        handleEditMacAddress,
        handleDeleteMacAddress,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
}
