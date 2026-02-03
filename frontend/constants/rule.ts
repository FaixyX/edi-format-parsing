import { NewRule, NewPdfField, NewExcelCell, LlmExample } from "@/types/rule";

export const initialRuleState: NewRule = {
    name: "",
    description: "",
    rule_type: "DIRECT",
    pdf_fields: [],
    excel_cells: [],
    llm_system_instruction: "",
    llm_examples: [],
};

export const initialPdfFieldState: NewPdfField = {
    field_name: "",
    description: "",
};

export const initialExcelCellState: NewExcelCell = {
    cell_reference: "",
    description: "",
};

export const initialLlmExampleState: LlmExample = {
    user_message: "",
    assistant_message: "",
};

export const ruleTypeOptions = [
    { value: "DIRECT", label: "Direct Mapping" },
    { value: "LLM_SIMPLE", label: "Simple LLM" },
    { value: "LLM_COMPLEX", label: "Complex LLM" },
];
