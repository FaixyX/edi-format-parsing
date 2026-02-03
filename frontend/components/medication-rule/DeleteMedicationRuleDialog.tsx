import { DeleteDialog } from "@/components/ui/data-table/delete-dialog";

interface DeleteMedicationRuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    ruleName: string;
}

export function DeleteMedicationRuleDialog({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    ruleName,
}: DeleteMedicationRuleDialogProps) {
    return (
        <DeleteDialog
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title="Delete Medication Rule"
            description={`Are you sure you want to delete "${ruleName}"? This action cannot be undone.`}
            isDeleting={isDeleting}
        />
    );
}
