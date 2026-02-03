import { NewPdfTemplate } from "@/types/pdfTemplate";

export const initialPdfTemplateState: NewPdfTemplate = {
    pdfType: "",
    modelId: "",
    status: "disabled",
};

export const pdfTemplateStatusOptions = [
    { value: "disabled", label: "Disabled" },
    { value: "in training", label: "In Training" },
    { value: "beta", label: "Beta" },
    { value: "stable", label: "Stable" },
];
