import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";
import { User } from "@/types/user";

interface DeleteUserDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    user?: User;
}

export function DeleteUserDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    user,
}: DeleteUserDialogProps) {
    const description =
        user?.type === "Admin"
            ? "Warning: You are deleting an admin user. Make sure there are other admins who can manage the system. This action cannot be undone."
            : "This action cannot be undone. This will permanently delete this user.";

    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Delete User"
            description={description}
            isDeleting={isDeleting}
        />
    );
}
