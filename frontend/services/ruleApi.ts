"use client";

import { Backend } from "@/lib/helper";
import { Rule, NewRule } from "@/types/rule";
import {
    transformLlmExamplesToBackend,
    transformLlmExamplesFromBackend,
} from "@/utils/adapters";

export async function getRulesByPdfTypeId(pdfTypeId: string): Promise<Rule[]> {
    const { data } = await Backend.get(`pdf-types/${pdfTypeId}/rules/`, {
        withCredentials: true,
    });

    // Transform the LLM examples for each rule
    return data.map((rule: any) => ({
        ...rule,
        llm_examples: transformLlmExamplesFromBackend(rule.llm_examples),
    }));
}

export async function getRule(ruleId: number): Promise<Rule> {
    const { data } = await Backend.get(`rules/${ruleId}`, {
        withCredentials: true,
    });

    return {
        ...data,
        llm_examples: transformLlmExamplesFromBackend(data.llm_examples),
    };
}

export async function addRule(pdfTypeId: string, rule: NewRule): Promise<Rule> {
    try {
        // Transform the LLM examples to backend format
        const transformedRule = {
            ...rule,
            llm_examples: transformLlmExamplesToBackend(rule.llm_examples),
        };

        const { data } = await Backend.post(`pdf-types/${pdfTypeId}/rules/`, {
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

export async function updateRule(ruleId: number, rule: NewRule): Promise<Rule> {
    try {
        // Transform the LLM examples to backend format
        const transformedRule = {
            ...rule,
            llm_examples: transformLlmExamplesToBackend(rule.llm_examples),
        };

        const { data } = await Backend.put(`rules/${ruleId}`, {
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

export async function deleteRule(ruleId: number): Promise<void> {
    await Backend.delete(`rules/${ruleId}`, {
        withCredentials: true,
    });
}
