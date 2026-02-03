import { useState } from "react";
import {
    PdfTemplate,
    PdfTemplateStatus,
    NewPdfTemplate,
} from "@/types/pdfTemplate";
import { initialPdfTemplateState } from "@/constants/pdfTemplate";

export function usePdfTemplateFormHandlers() {
    const [newTemplate, setNewTemplate] = useState<NewPdfTemplate>(
        initialPdfTemplateState
    );
    const [editingTemplate, setEditingTemplate] = useState<PdfTemplate | null>(
        null
    );

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        isEditing: boolean = false
    ) => {
        const { name, value } = e.target;
        if (isEditing && editingTemplate) {
            setEditingTemplate({ ...editingTemplate, [name]: value });
        } else {
            setNewTemplate({ ...newTemplate, [name]: value });
        }
    };

    const handleStatusChange = (
        value: PdfTemplateStatus,
        isEditing: boolean = false
    ) => {
        if (isEditing && editingTemplate) {
            setEditingTemplate({ ...editingTemplate, status: value });
        } else {
            setNewTemplate({ ...newTemplate, status: value });
        }
    };

    const handleModelChange = (value: string, isEditing: boolean = false) => {
        if (isEditing && editingTemplate) {
            setEditingTemplate({ ...editingTemplate, modelId: value });
        } else {
            setNewTemplate({ ...newTemplate, modelId: value });
        }
    };

    const resetForm = () => {
        setNewTemplate(initialPdfTemplateState);
        setEditingTemplate(null);
    };

    return {
        newTemplate,
        editingTemplate,
        setEditingTemplate,
        handleInputChange,
        handleStatusChange,
        handleModelChange,
        resetForm,
    };
}
