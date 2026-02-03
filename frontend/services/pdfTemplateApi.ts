"use client";

import { Backend } from "@/lib/helper";
import {
    PdfTemplate,
    NewPdfTemplate,
    AzureModel,
    AzureModelOption,
} from "@/types/pdfTemplate";

export async function getPdfTemplates(): Promise<PdfTemplate[]> {
    const { data } = await Backend.get("pdf-templates", {
        withCredentials: true,
    });

    return data;
}

export async function addPdfTemplate(
    template: NewPdfTemplate
): Promise<PdfTemplate> {
    try {
        const { data } = await Backend.post("pdf-templates/", {
            withCredentials: true,
            body: template,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function updatePdfTemplate(
    template: PdfTemplate
): Promise<PdfTemplate> {
    try {
        const { data } = await Backend.put(`pdf-templates/${template.id}`, {
            withCredentials: true,
            body: template,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function deletePdfTemplate(id: string): Promise<void> {
    await Backend.delete(`pdf-templates/${id}`, {
        withCredentials: true,
    });
}

export async function getAzureModels(): Promise<AzureModelOption[]> {
    try {
        const { data } = await Backend.get("ai-models/azure", {
            withCredentials: true,
        });

        return (data as AzureModel[]).map((model: AzureModel) => ({
            value: model.model_id,
            label: model.model_id,
            description: model.description,
        }));
    } catch (error) {
        console.error("Error fetching Azure models:", error);
        throw error;
    }
}

export async function getModelFields(
    modelId: string
): Promise<Array<{ value: string; label: string }>> {
    try {
        const { data } = await Backend.get(`ai-models/azure/${modelId}`, {
            withCredentials: true,
        });

        return (data.fields as string[]).map((field: string) => ({
            value: field,
            label: field,
        }));
    } catch (error) {
        console.error("Error fetching model fields:", error);
        throw error;
    }
}
