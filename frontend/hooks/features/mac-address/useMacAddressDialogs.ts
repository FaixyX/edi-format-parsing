import { useState } from "react";
import { MacAddress } from "@/types/macAddress";

export function useMacAddressDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [macToDelete, setMacToDelete] = useState<MacAddress | null>(null);
    const [macToEdit, setMacToEdit] = useState<MacAddress | null>(null);

    const openEditDialog = (mac: MacAddress) => {
        setMacToEdit(mac);
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setTimeout(() => {
            setMacToEdit(null);
        }, 100);
    };

    const openDeleteDialog = (mac: MacAddress) => {
        setMacToDelete(mac);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setTimeout(() => {
            setMacToDelete(null);
        }, 100);
    };

    return {
        isAddDialogOpen,
        setIsAddDialogOpen,
        isEditDialogOpen,
        isDeleteDialogOpen,
        macToDelete,
        macToEdit,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
        setMacToDelete,
        setIsDeleteDialogOpen,
        setIsEditDialogOpen,
        setMacToEdit,
    };
}
