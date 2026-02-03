import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeletePdfTemplateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export function DeletePdfTemplateDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
}: DeletePdfTemplateDialogProps) {
    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Delete Template"
            description="Are you sure you want to delete this template? This action cannot be undone."
            isDeleting={isDeleting}
        />
    );
}
