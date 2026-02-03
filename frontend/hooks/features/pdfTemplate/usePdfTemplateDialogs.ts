import { useState } from "react";
import { PdfTemplate } from "@/types/pdfTemplate";

export function usePdfTemplateDialogs() {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [templateToDelete, setTemplateToDelete] =
        useState<PdfTemplate | null>(null);

    const openEditDialog = (template: PdfTemplate) => {
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
    };

    const openDeleteDialog = (template: PdfTemplate) => {
        setTemplateToDelete(template);
        setIsDeleteDialogOpen(true);
    };

    const closeDeleteDialog = () => {
        setIsDeleteDialogOpen(false);
        setTimeout(() => {
            setTemplateToDelete(null);
        }, 100);
    };

    return {
        isAddDialogOpen,
        setIsAddDialogOpen,
        isEditDialogOpen,
        setIsEditDialogOpen,
        isDeleteDialogOpen,
        setIsDeleteDialogOpen,
        templateToDelete,
        setTemplateToDelete,
        openEditDialog,
        closeEditDialog,
        openDeleteDialog,
        closeDeleteDialog,
    };
}
