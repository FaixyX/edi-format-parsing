import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MacAddress, NewMacAddress } from "@/types/macAddress";
import {
    addMacAddresses,
    deleteMacAddresses,
    toggleMacStatus,
    updateMacAddresses,
} from "@/services/macAddressApi";

interface UpdateMacAddressParams {
    id: string;
    data: Partial<NewMacAddress>;
}

interface ToggleMacStatusParams {
    id: string;
    enabled: boolean;
}

export function useMacAddressMutations(
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setMacToDelete: (state: MacAddress | null) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setMacToEdit: (state: MacAddress | null) => void
) {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: addMacAddresses,
        onSuccess: () => {
            setIsAddDialogOpen(false);
            resetForm();
            queryClient.invalidateQueries({ queryKey: ["macAddresses"] });
            toast.success("MAC address added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add MAC address", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMacAddresses,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["macAddresses"] });
            setIsDeleteDialogOpen(false);
            setMacToDelete(null);
            toast.success("MAC address deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete MAC address", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: UpdateMacAddressParams) =>
            updateMacAddresses(id, data),
        onSuccess: () => {
            setIsEditDialogOpen(false);
            setMacToEdit(null);
            queryClient.invalidateQueries({ queryKey: ["macAddresses"] });
            toast.success("MAC address updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update MAC address", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, enabled }: ToggleMacStatusParams) =>
            toggleMacStatus(id, enabled),
        onMutate: async ({ id, enabled }) => {
            await queryClient.cancelQueries({ queryKey: ["macAddresses"] });
            const previousMacs = queryClient.getQueryData<MacAddress[]>([
                "macAddresses",
            ]);
            queryClient.setQueryData<MacAddress[]>(["macAddresses"], (old) =>
                old?.map((mac) => (mac.id === id ? { ...mac, enabled } : mac))
            );
            return { previousMacs };
        },
        onError: (err, variables, context) => {
            if (context?.previousMacs) {
                queryClient.setQueryData(
                    ["macAddresses"],
                    context.previousMacs
                );
            }
            toast.error("Failed to update status", {
                description:
                    err instanceof Error ? err.message : "Unknown error",
            });
        },
        onSuccess: (_, { enabled }) => {
            toast.success(
                `MAC address ${enabled ? "enabled" : "disabled"} successfully`
            );
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["macAddresses"] });
        },
    });

    return {
        createMutation,
        deleteMutation,
        updateMutation,
        toggleStatusMutation,
    };
}
