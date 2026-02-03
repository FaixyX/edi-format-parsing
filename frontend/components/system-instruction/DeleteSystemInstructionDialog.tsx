import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeleteSystemInstructionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    systemInstructionName?: string;
}

export function DeleteSystemInstructionDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    systemInstructionName,
}: DeleteSystemInstructionDialogProps) {
    const description = systemInstructionName
        ? `This will permanently delete the system instruction "${systemInstructionName}".`
        : "This will permanently delete the system instruction.";

    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Are you sure?"
            description={description}
            isDeleting={isDeleting}
        />
    );
}
