import { useState } from "react";
import { Agency, NewAgency } from "@/types/agency";
import { initialAgencyState } from "@/constants/agency";

export function useAgencyFormHandlers() {
    const [newAgency, setNewAgency] = useState<NewAgency>(initialAgencyState);
    const [editingAgency, setEditingAgency] = useState<Agency | null>(null);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
        isEditing: boolean = false
    ) => {
        const { name, value } = e.target;
        if (isEditing && editingAgency) {
            setEditingAgency({ ...editingAgency, [name]: value });
        } else {
            setNewAgency({ ...newAgency, [name]: value });
        }
    };

    const resetForm = () => {
        setNewAgency(initialAgencyState);
        setEditingAgency(null);
    };

    return {
        newAgency,
        editingAgency,
        setEditingAgency,
        handleInputChange,
        resetForm,
    };
}
