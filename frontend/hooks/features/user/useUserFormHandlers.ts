import { useState } from "react";
import { User, UserType, NewUser } from "@/types/user";
import { initialUserState } from "@/constants/user";

export function useUserFormHandlers() {
    const [newUser, setNewUser] = useState<NewUser>(initialUserState);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        isEditing: boolean = false
    ) => {
        const { name, value } = e.target;
        if (isEditing && userToEdit) {
            setUserToEdit({ ...userToEdit, [name]: value });
        } else {
            setNewUser({ ...newUser, [name]: value });
        }
    };

    const handleTypeChange = (value: UserType, isEditing: boolean = false) => {
        if (isEditing && userToEdit) {
            setUserToEdit({ ...userToEdit, type: value });
        } else {
            setNewUser({ ...newUser, type: value });
        }
    };

    const resetForm = () => {
        setNewUser(initialUserState);
        setUserToEdit(null);
    };

    return {
        newUser,
        userToEdit,
        setUserToEdit,
        handleInputChange,
        handleTypeChange,
        resetForm,
    };
}
