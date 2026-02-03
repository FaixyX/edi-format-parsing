import { useState } from "react";
import { MacAddress, NewMacAddress } from "@/types/macAddress";
import { initialMacAddressState } from "@/constants/macAddress";

export function useMacAddressFormHandlers() {
    const [newMacAddress, setNewMacAddress] = useState<NewMacAddress>(
        initialMacAddressState
    );
    const [editingMacAddress, setEditingMacAddress] = useState<MacAddress  | null>(
        null
    );

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        isEditing: boolean = false
    ) => {
        const { name, value } = e.target;
        if (isEditing && editingMacAddress) {
            setEditingMacAddress({ ...editingMacAddress, [name]: value });
        } else {
            setNewMacAddress((prev) => ({ ...prev, [name]: value }));
        }
    };

    const resetForm = () => {
        setNewMacAddress(initialMacAddressState);
        setEditingMacAddress(null);
    };

    // const initializeEditForm = (mac: MacAddress) => {
    //     setEditingMacAddress({
    //         address: mac.address,
    //         device_name: mac.device_name,
    //         enabled: mac.enabled,
    //     });
    // };

    return {
        newMacAddress,
        editingMacAddress,
        setEditingMacAddress,
        handleInputChange,
        resetForm
        // initializeEditForm,
    };
}
