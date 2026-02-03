import { addPdfTemplate, deletePdfTemplate, updatePdfTemplate } from "@/services/pdfTemplateApi";
import { PdfTemplate } from "@/types/pdfTemplate";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function usePdfTemplateMutations(
    setIsAddDialogOpen: (state: boolean) => void,
    setIsEditDialogOpen: (state: boolean) => void,
    setIsDeleteDialogOpen: (state: boolean) => void,
    setTemplateToDelete: (state: PdfTemplate | null) => void,
    resetForm: () => void
) {
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: addPdfTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pdfTemplates"] });
            setIsAddDialogOpen(false);
            resetForm();
            toast.success("Template added successfully");
        },
        onError: (error) => {
            toast.error("Failed to add template", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: updatePdfTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pdfTemplates"] });
            setIsEditDialogOpen(false);
            resetForm();
            toast.success("Template updated successfully");
        },
        onError: (error) => {
            toast.error("Failed to update template", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deletePdfTemplate,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["pdfTemplates"] });
            setIsDeleteDialogOpen(false);
            setTemplateToDelete(null);
            toast.success("Template deleted successfully");
        },
        onError: (error) => {
            toast.error("Failed to delete template", {
                description:
                    error instanceof Error ? error.message : "Unknown error",
            });
        },
    });

    return {
        createMutation,
        updateMutation,
        deleteMutation,
    };
} 