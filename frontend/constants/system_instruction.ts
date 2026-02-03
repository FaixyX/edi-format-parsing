import {
    NewSystemInstruction,
    SystemInstructionExample,
} from "@/types/system_instruction";

export const initialSystemInstructionExample: SystemInstructionExample = {
    user_message: "",
    assistant_message: "",
};

export const initialTrainingData: SystemInstructionExample[] = [];

export const initialSystemInstructionState: NewSystemInstruction = {
    name: "",
    instruction_text: "",
    prompt_id: "",
    use_prompt_id: false,
    description: "",
    is_active: true,
    model_id: "",
    examples: [],
    training_data: [],
};
