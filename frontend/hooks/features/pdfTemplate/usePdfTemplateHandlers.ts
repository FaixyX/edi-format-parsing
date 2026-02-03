import { usePdfTemplateMutations } from "@/hooks/features/pdfTemplate/usePdfTemplateMutations";

import { PdfTemplate, NewPdfTemplate } from "@/types/pdfTemplate";

export const usePdfTemplateHandlers = (
    templateToDelete: PdfTemplate | null,
    editingTemplate: PdfTemplate | null,
    setIsAddDialogOpen: (state: boolean) => void,
    resetForm: () => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setTemplateToDelete: (state: PdfTemplate | null) => void
) => {
    const { createMutation, updateMutation, deleteMutation } =
        usePdfTemplateMutations(
            setIsAddDialogOpen,
            setIsEditDialogOpen,
            setIsDeleteDialogOpen,
            setTemplateToDelete,
            resetForm
        );

    const handleAddTemplate = (newTemplate: NewPdfTemplate) => {
        createMutation.mutate(newTemplate);
    };

    const handleEditTemplate = () => {
        if (editingTemplate) {
            updateMutation.mutate(editingTemplate);
        }
    };

    const handleDeleteTemplate = () => {
        if (templateToDelete) {
            deleteMutation.mutate(templateToDelete.id);
        }
    };

    return {
        handleAddTemplate,
        handleEditTemplate,
        handleDeleteTemplate,
        isAdding: createMutation.isPending,
        isEditing: updateMutation.isPending,
        isDeleting: deleteMutation.isPending,
    };
};
