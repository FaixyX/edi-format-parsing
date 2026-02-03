import { NewUser, UserType } from "@/types/user";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { SelectField } from "@/components/ui/data-table/select-field";
import { PasswordField } from "@/components/ui/data-table/password-field";
import { userTypeOptions } from "@/constants/user";

interface AddUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    user: NewUser;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTypeChange: (value: UserType) => void;
}

export function AddUserDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    user,
    onInputChange,
    onTypeChange,
}: AddUserDialogProps) {
    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title="Add New User"
            isSubmitting={isSubmitting}
            submitText="Add User"
            loadingText="Adding..."
        >
            <FormField
                label="Username"
                id="username"
                name="username"
                value={user.username}
                onChange={onInputChange}
            />
            <PasswordField
                label="Password"
                id="password"
                name="password"
                value={user.password}
                onChange={onInputChange}
            />
            <SelectField
                label="Type"
                id="type"
                value={user.type}
                options={userTypeOptions}
                onChange={(value) => onTypeChange(value as UserType)}
            />
        </AddEditDialog>
    );
}
