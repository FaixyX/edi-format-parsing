import { RuleType, LlmExample, NewExcelCell } from "@/types/rule";
import { NewMedicationRule } from "@/types/medicationRule";

export const initialMedicationRuleState: NewMedicationRule = {
    name: "",
    description: "",
    rule_type: "DIRECT",
    excel_cells: [],
    llm_system_instruction: "",
    llm_examples: [],
};

export const initialExcelCellState: NewExcelCell = {
    cell_reference: "",
    description: "",
};

export const initialLlmExampleState: LlmExample = {
    user_message: "",
    assistant_message: "",
};

export const medicationRuleTypeOptions = [
    { value: "DIRECT", label: "Direct Mapping" },
    { value: "LLM_SIMPLE", label: "Simple LLM" },
    { value: "LLM_COMPLEX", label: "Complex LLM" },
];
