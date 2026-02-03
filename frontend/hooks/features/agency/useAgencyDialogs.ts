import { useState } from "react";

type DialogType = "add" | "edit" | "delete";

export function useAgencyDialogs() {
    const [dialogState, setDialogState] = useState({
        add: false,
        edit: false,
        delete: false,
    });

    const openDialog = (type: DialogType) => {
        setDialogState((prev) => ({ ...prev, [type]: true }));
    };

    const closeDialog = (type: DialogType) => {
        setDialogState((prev) => ({ ...prev, [type]: false }));
    };

    return {
        dialogState,
        openDialog,
        closeDialog,
    };
}
