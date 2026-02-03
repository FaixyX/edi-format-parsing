import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeleteAgencyDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    agencyName?: string;
}

export function DeleteAgencyDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    agencyName,
}: DeleteAgencyDialogProps) {
    const description = agencyName
        ? `This action cannot be undone. This will permanently delete the agency "${agencyName}" and remove its data from the servers.`
        : "This action cannot be undone. This will permanently delete the agency and remove its data from the servers.";

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
