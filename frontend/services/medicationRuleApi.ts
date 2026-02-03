"use client";

import { Backend } from "@/lib/helper";
import { MedicationRule, NewMedicationRule } from "@/types/medicationRule";
import {
    transformLlmExamplesToBackend,
    transformLlmExamplesFromBackend,
} from "@/utils/adapters";

export async function getMedicationRules(): Promise<MedicationRule[]> {
    const { data } = await Backend.get(`medication-rules/`, {
        withCredentials: true,
    });

    // Transform the LLM examples for each rule
    return data.map((rule: any) => ({
        ...rule,
        llm_examples: transformLlmExamplesFromBackend(rule.llm_examples),
    }));
}

export async function getMedicationRule(
    ruleId: number
): Promise<MedicationRule> {
    const { data } = await Backend.get(`medication-rules/${ruleId}`, {
        withCredentials: true,
    });

    return {
        ...data,
        llm_examples: transformLlmExamplesFromBackend(data.llm_examples),
    };
}

export async function addMedicationRule(
    rule: NewMedicationRule
): Promise<MedicationRule> {
    try {
        // Transform the LLM examples to backend format
        const transformedRule = {
            ...rule,
            llm_examples: transformLlmExamplesToBackend(rule.llm_examples),
        };

        const { data } = await Backend.post(`medication-rules/`, {
            withCredentials: true,
            body: transformedRule,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return {
            ...data,
            llm_examples: transformLlmExamplesFromBackend(data.llm_examples),
        };
    } catch (error) {
        throw error;
    }
}

export async function updateMedicationRule(
    ruleId: number,
    rule: NewMedicationRule
): Promise<MedicationRule> {
    try {
        // Transform the LLM examples to backend format
        const transformedRule = {
            ...rule,
            llm_examples: transformLlmExamplesToBackend(rule.llm_examples),
        };

        const { data } = await Backend.put(`medication-rules/${ruleId}`, {
            withCredentials: true,
            body: transformedRule,
        });

        if (data.detail) {
            throw new Error(data.detail);
        }

        return {
            ...data,
            llm_examples: transformLlmExamplesFromBackend(data.llm_examples),
        };
    } catch (error) {
        throw error;
    }
}

export async function deleteMedicationRule(ruleId: number): Promise<void> {
    await Backend.delete(`medication-rules/${ruleId}`, {
        withCredentials: true,
    });
}
