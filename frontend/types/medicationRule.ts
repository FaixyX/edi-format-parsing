import {
    RuleType,
    ExcelCell,
    PdfField,
    LlmExample,
    NewExcelCell,
} from "./rule";

// Define medication rule type that doesn't include pdf_type_id
export interface MedicationRule {
    id: number;
    name: string;
    description?: string;
    rule_type: RuleType;
    excel_cells: ExcelCell[];
    llm_system_instruction?: string;
    llm_examples?: LlmExample[];
    // No pdf_fields or pdf_type_id
}

export interface NewMedicationRule {
    name: string;
    description?: string;
    rule_type: RuleType;
    excel_cells: NewExcelCell[];
    llm_system_instruction?: string;
    llm_examples?: LlmExample[];
    // Adding optional id for editing purposes
    id?: number;
}
