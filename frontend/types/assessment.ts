export interface Assessment {
    id: string; // UUID string
    status: string; // Date string
    status_description: AssessmentType;
    effective_dates: string; // Format: "05/25/25 - 07/23/25"
    oasis: string; // OASIS state
}

export type AssessmentType =
    | "SOC (further visits)"
    | "Follow-up/Recert"
    | "ROC"
    | "Discharge"
    | "Transfer"
    | "Other follow-up";

export interface AssessmentOption {
    value: string; // ID of the assessment
    label: string; // Display text for the combo box
    status: string;
    status_description: AssessmentType;
    effective_dates: string;
    oasis: string;
}

export interface NewAssessment {
    status_description: AssessmentType;
    assessment_date: string; // ISO date string
}

export const assessmentTypeOptions = [
    { value: "SOC (further visits)", label: "SOC (further visits)" },
    { value: "Follow-up/Recert", label: "Follow-up/Recert" },
    { value: "ROC", label: "ROC" },
    { value: "Discharge", label: "Discharge" },
    { value: "Transfer", label: "Transfer" },
    { value: "Other follow-up", label: "Other follow-up" },
];
