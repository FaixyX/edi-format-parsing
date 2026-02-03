import { Brain } from "lucide-react";

interface MedicationRuleTypeCellProps {
    type: string;
}

export function getMedicationRuleTypeLabel(type: string): string {
    switch (type) {
        case "DIRECT":
            return "Direct Mapping";
        case "LLM_SIMPLE":
            return "Simple LLM";
        case "LLM_COMPLEX":
            return "Complex LLM";
        default:
            return type;
    }
}

export function MedicationRuleTypeCell({ type }: MedicationRuleTypeCellProps) {
    const isLlmType = type === "LLM_SIMPLE" || type === "LLM_COMPLEX";

    return (
        <div className="flex items-center gap-1">
            {isLlmType && <Brain className="h-4 w-4 text-blue-500 mr-1" />}
            <span>{getMedicationRuleTypeLabel(type)}</span>
        </div>
    );
}
