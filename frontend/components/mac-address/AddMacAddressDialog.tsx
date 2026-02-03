import { NewMacAddress } from "@/types/macAddress";
import { AddEditDialog } from "@/components/ui/data-table/add-edit-dialog";
import { FormField } from "@/components/ui/data-table/form-field";

interface AddMacAddressDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    macAddress: NewMacAddress;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function AddMacAddressDialog({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting,
    macAddress,
    onInputChange,
}: AddMacAddressDialogProps) {
    return (
        <AddEditDialog
            isOpen={isOpen}
            onClose={onClose}
            onSubmit={onSubmit}
            title="Add New MAC Address"
            isSubmitting={isSubmitting}
            submitText="Add MAC Address"
            loadingText="Adding..."
        >
            <FormField
                label="MAC Address"
                id="address"
                name="address"
                value={macAddress.address}
                onChange={onInputChange}
                placeholder="00:00:00:00:00:00"
            />
            <FormField
                label="Device Name"
                id="device_name"
                name="device_name"
                value={macAddress.device_name}
                onChange={onInputChange}
            />
        </AddEditDialog>
    );
}
