export type PdfTemplateStatus = "disabled" | "in training" | "beta" | "stable";

export interface PdfTemplate {
    id: string;
    pdfType: string;
    modelId: string;
    status: PdfTemplateStatus;
}

export type NewPdfTemplate = Omit<PdfTemplate, "id">;

export interface AzureModel {
    model_id: string;
    description: string;
    created_date_time: string;
}

export interface AzureModelOption {
    value: string;
    label: string;
    description?: string;
}
