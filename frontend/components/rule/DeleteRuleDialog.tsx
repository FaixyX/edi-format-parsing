import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeleteRuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export function DeleteRuleDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
}: DeleteRuleDialogProps) {
    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Delete Rule"
            description="Are you sure you want to delete this rule? This action cannot be undone."
            isDeleting={isDeleting}
        />
    );
}
