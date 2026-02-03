import { Rule } from "@/types/rule";
import { TerminalSquare, MessageSquare } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface LlmDetailsCellProps {
    rule: Rule;
}

export function LlmDetailsCell({ rule }: LlmDetailsCellProps) {
    if (rule.rule_type !== "LLM_SIMPLE" && rule.rule_type !== "LLM_COMPLEX") {
        return <div>N/A</div>;
    }

    const hasSystemInstructions =
        !!rule.llm_system_instruction &&
        rule.llm_system_instruction.trim() !== "";
    const exampleCount = rule.llm_examples?.length || 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <TerminalSquare
                                    className={`h-4 w-4 ${
                                        hasSystemInstructions
                                            ? "text-blue-500"
                                            : "text-gray-300"
                                    }`}
                                />
                                <span className="ml-1 text-sm">
                                    System Instruction
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            {hasSystemInstructions ? (
                                <p className="max-w-xs text-xs">
                                    {rule.llm_system_instruction}
                                </p>
                            ) : (
                                <p>No system instruction defined</p>
                            )}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            <div className="flex items-center space-x-2">
                <MessageSquare
                    className={`h-4 w-4 ${
                        exampleCount > 0 ? "text-green-500" : "text-gray-300"
                    }`}
                />
                <span className="text-sm">
                    {exampleCount} Example{exampleCount !== 1 ? "s" : ""}
                </span>
            </div>
        </div>
    );
}
