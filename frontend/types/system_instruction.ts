export interface SystemInstructionExample {
    user_message: string;
    assistant_message: string;
}

export interface SystemInstruction {
    id: string;
    name: string;
    instruction_text?: string;
    prompt_id?: string;
    description: string | null;
    is_active: boolean;
    model_id?: string;
    examples?: SystemInstructionExample[];
    training_data?: SystemInstructionExample[];
    use_prompt_id?: boolean;
}

export type NewSystemInstruction = Omit<SystemInstruction, "id">;
