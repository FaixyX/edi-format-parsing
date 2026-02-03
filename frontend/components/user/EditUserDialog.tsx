import { User, UserType } from "@/types/user";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";
import { SelectField } from "@/components/ui/data-table/select-field";
import { PasswordField } from "@/components/ui/data-table/password-field";
import { userTypeOptions } from "@/constants/user";

interface EditUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    user: User;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onTypeChange: (value: UserType) => void;
}

export function EditUserDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    user,
    onInputChange,
    onTypeChange,
}: EditUserDialogProps) {
    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title="Edit User"
            isSubmitting={isSubmitting}
            submitText="Save Changes"
            loadingText="Saving..."
        >
            <FormField
                label="Username"
                id="edit-username"
                name="username"
                value={user.username}
                onChange={onInputChange}
            />
            <PasswordField
                label="Password"
                id="edit-password"
                name="password"
                value={user.password || ""}
                onChange={onInputChange}
                placeholder="Leave blank to keep current password"
            />
            <SelectField
                label="Type"
                id="edit-type"
                value={user.type}
                options={userTypeOptions}
                onChange={(value) => onTypeChange(value as UserType)}
            />
        </AddEditDialog>
    );
}
