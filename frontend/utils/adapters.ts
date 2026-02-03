import { LlmExample } from "@/types/rule";

interface BackendContentItem {
    type: "text";
    text: string;
}

interface BackendLlmExample {
    role: "user" | "assistant";
    content: BackendContentItem[];
}

/**
 * Transforms frontend LLM examples to the backend format
 */
export function transformLlmExamplesToBackend(
    examples: LlmExample[] | undefined
): BackendLlmExample[] | undefined {
    if (!examples || examples.length === 0) {
        return undefined;
    }

    // For each example, we need to create two entries - one for user and one for assistant
    const backendExamples: BackendLlmExample[] = [];

    examples.forEach((example) => {
        // Add user message
        backendExamples.push({
            role: "user",
            content: [{ type: "text", text: example.user_message }],
        });

        // Add assistant message
        backendExamples.push({
            role: "assistant",
            content: [{ type: "text", text: example.assistant_message }],
        });
    });

    return backendExamples;
}

/**
 * Transforms backend LLM examples to the frontend format
 */
export function transformLlmExamplesFromBackend(
    examples: BackendLlmExample[] | undefined
): LlmExample[] | undefined {
    if (!examples || examples.length === 0) {
        return undefined;
    }

    const frontendExamples: LlmExample[] = [];

    // Process pairs of examples (user + assistant)
    for (let i = 0; i < examples.length; i += 2) {
        if (i + 1 < examples.length) {
            const userExample = examples[i];
            const assistantExample = examples[i + 1];

            if (
                userExample.role === "user" &&
                assistantExample.role === "assistant"
            ) {
                frontendExamples.push({
                    user_message: userExample.content[0]?.text || "",
                    assistant_message: assistantExample.content[0]?.text || "",
                });
            }
        }
    }

    return frontendExamples;
}
