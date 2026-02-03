"use client";

import { Backend } from "@/lib/helper";
import {
    SystemInstruction,
    NewSystemInstruction,
} from "@/types/system_instruction";

export async function getSystemInstructions(): Promise<SystemInstruction[]> {
    const { data } = await Backend.get("system-instructions", {
        withCredentials: true,
    });
    return data;
}

export async function getOpenAIModels(): Promise<
    { id: string; created: number }[]
> {
    const { data } = await Backend.get("ai-models/openai", {
        withCredentials: true,
    });
    return data;
}

export async function addSystemInstruction(
    instruction: NewSystemInstruction
): Promise<SystemInstruction> {
    try {
        const { data } = await Backend.post("system-instructions/", {
            withCredentials: true,
            body: instruction,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

export async function updateSystemInstruction(
    id: string,
    instruction: Partial<NewSystemInstruction>
): Promise<SystemInstruction> {
    const { data } = await Backend.put(`system-instructions/${id}`, {
        withCredentials: true,
        body: instruction,
    });

    return data;
}

export async function deleteSystemInstruction(id: string): Promise<void> {
    try {
        const { data } = await Backend.delete(`system-instructions/${id}`, {
            withCredentials: true,
        });

        if (data && data.detail) {
            throw new Error(data.detail);
        }
    } catch (error) {
        throw error;
    }
}

export async function toggleSystemInstructionStatus(
    id: string,
    is_active: boolean
): Promise<SystemInstruction> {
    try {
        const { data } = await Backend.patch(
            `system-instructions/${id}/toggle`,
            { is_active },
            { withCredentials: true }
        );

        if (data.detail) {
            throw new Error(data.detail);
        }

        return data;
    } catch (error) {
        throw error;
    }
}
