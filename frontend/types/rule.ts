export type RuleType = "DIRECT" | "LLM_SIMPLE" | "LLM_COMPLEX";

export interface PdfField {
    id: number;
    field_name: string;
    description?: string;
    rule_id: number;
}

export interface ExcelCell {
    id: number;
    cell_reference: string;
    description?: string;
    rule_id: number;
}

export interface LlmExample {
    user_message: string;
    assistant_message: string;
}

export interface Rule {
    id: number;
    name: string;
    description?: string;
    rule_type: RuleType;
    pdf_type_id: string;
    pdf_fields: PdfField[];
    excel_cells: ExcelCell[];
    llm_system_instruction?: string;
    llm_examples?: LlmExample[];
}

export type NewPdfField = Omit<PdfField, "id" | "rule_id">;
export type NewExcelCell = Omit<ExcelCell, "id" | "rule_id">;

export interface NewRule {
    name: string;
    description?: string;
    rule_type: RuleType;
    pdf_fields: NewPdfField[];
    excel_cells: NewExcelCell[];
    llm_system_instruction?: string;
    llm_examples?: LlmExample[];
}
