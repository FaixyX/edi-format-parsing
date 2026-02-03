import { NewMacAddress } from "@/types/macAddress";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";

interface EditMacAddressDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    macAddress: NewMacAddress;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function EditMacAddressDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    macAddress,
    onInputChange,
}: EditMacAddressDialogProps) {
    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title="Edit MAC Address"
            isSubmitting={isSubmitting}
            submitText="Update MAC Address"
            loadingText="Updating..."
        >
            <FormField
                label="MAC Address"
                id="edit-address"
                name="address"
                value={macAddress.address}
                onChange={onInputChange}
                placeholder="00:00:00:00:00:00"
            />
            <FormField
                label="Device Name"
                id="edit-device_name"
                name="device_name"
                value={macAddress.device_name}
                onChange={onInputChange}
            />
        </AddEditDialog>
    );
}
