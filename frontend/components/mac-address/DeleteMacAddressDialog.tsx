import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeleteMacAddressDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export function DeleteMacAddressDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
}: DeleteMacAddressDialogProps) {
    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Delete MAC Address"
            description="This action cannot be undone. This will permanently remove this MAC address from the authorized devices list."
            isDeleting={isDeleting}
        />
    );
}
