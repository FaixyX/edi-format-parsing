"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from "@/components/ui/card";
import { FileCode, Check, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface Example {
    user_message: string;
    assistant_message: string;
}

export interface ParsedData {
    systemInstruction: string;
    examples: Example[];
    updateSystemInstruction: boolean;
    targetExampleType: "examples" | "training_data";
    appendExamples: boolean;
}

export interface ParserOptions {
    updateSystemInstruction: boolean;
    targetExampleType: "examples" | "training_data";
    appendExamples: boolean;
}

interface CodeSnippetParserProps {
    onParsedData: (data: ParsedData) => void;
    title?: string;
    description?: string;
    showTrainingDataOption?: boolean;
    defaultOptions?: Partial<ParserOptions>;
}

export function CodeSnippetParser({
    onParsedData,
    title = "Paste OpenAI Code Snippet",
    description = "Paste your OpenAI API code snippet to automatically extract the system instruction and examples",
    showTrainingDataOption = true,
    defaultOptions,
}: CodeSnippetParserProps) {
    const [codeSnippet, setCodeSnippet] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const [previewData, setPreviewData] = useState<Omit<
        ParsedData,
        "updateSystemInstruction" | "targetExampleType" | "appendExamples"
    > | null>(null);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [options, setOptions] = useState<ParserOptions>({
        updateSystemInstruction:
            defaultOptions?.updateSystemInstruction ?? true,
        targetExampleType: defaultOptions?.targetExampleType ?? "examples",
        appendExamples: defaultOptions?.appendExamples ?? false,
    });

    // Function to handle escape sequences in strings
    const processEscapeSequences = (text: string): string => {
        // Replace common JSON escape sequences with their actual characters
        return text
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, "\\")
            .replace(/\\b/g, "\b")
            .replace(/\\f/g, "\f");
    };

    const parseCodeSnippet = () => {
        try {
            setParsing(true);
            setError(null);
            setPreviewData(null);

            // Extract system instruction using a more flexible regex
            const systemMatch = codeSnippet.match(
                /"role":\s*"(?:system|developer)"[\s\S]*?"(?:content|text)":\s*(?:\[\s*{\s*"type":\s*"(?:input_text|text)",\s*"text":\s*"(.*?)"\s*}|"(.*?)")/
            );

            let systemInstruction = "";
            if (systemMatch) {
                // Get the captured group that has a value (either from array format or direct string format)
                systemInstruction = systemMatch[1] || systemMatch[2] || "";
                // Process escape sequences
                systemInstruction = processEscapeSequences(systemInstruction);
            }

            if (!systemInstruction) {
                throw new Error(
                    "Could not find system instruction in the code snippet"
                );
            }

            // Extract conversation examples with more flexible regex
            const examples: Example[] = [];

            // Match user messages (both array format and direct string format)
            const userRegex =
                /"role":\s*"user"[\s\S]*?"(?:content|text)":\s*(?:\[\s*{\s*"type":\s*"(?:input_text|text)",\s*"text":\s*"(.*?)"\s*}|"(.*?)")/g;
            // Match assistant/developer messages (both array format and direct string format)
            const assistantRegex =
                /"role":\s*"assistant"[\s\S]*?"(?:content|text)":\s*(?:\[\s*{\s*"type":\s*"(?:output_text|text)",\s*"text":\s*"(.*?)"\s*}|"(.*?)")/g;

            // Extract all user messages
            const userMessages: string[] = [];
            let userMatch;
            while ((userMatch = userRegex.exec(codeSnippet)) !== null) {
                const message = userMatch[1] || userMatch[2] || "";
                // Process escape sequences
                userMessages.push(processEscapeSequences(message));
            }

            // Extract all assistant messages
            const assistantMessages: string[] = [];
            let assistantMatch;
            while (
                (assistantMatch = assistantRegex.exec(codeSnippet)) !== null
            ) {
                const message = assistantMatch[1] || assistantMatch[2] || "";
                // Process escape sequences
                assistantMessages.push(processEscapeSequences(message));
            }

            // Create examples from pairs
            for (
                let i = 0;
                i < Math.min(userMessages.length, assistantMessages.length);
                i++
            ) {
                if (userMessages[i] && assistantMessages[i]) {
                    examples.push({
                        user_message: userMessages[i],
                        assistant_message: assistantMessages[i],
                    });
                }
            }

            // Validate we found at least the system instruction
            if (!systemInstruction) {
                throw new Error(
                    "Could not parse system instruction from the code snippet"
                );
            }

            const parsedData = {
                systemInstruction,
                examples,
            };

            // Set preview data
            setPreviewData(parsedData);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to parse code snippet"
            );
        } finally {
            setParsing(false);
        }
    };

    const handleApply = () => {
        if (previewData) {
            onParsedData({
                ...previewData,
                updateSystemInstruction: options.updateSystemInstruction,
                targetExampleType: options.targetExampleType,
                appendExamples: options.appendExamples,
            });
            setCodeSnippet("");
            setPreviewData(null);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileCode className="h-5 w-5" />
                        {title}
                    </CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Textarea
                            placeholder="Paste your OpenAI code snippet here..."
                            className="min-h-[200px] font-mono text-sm"
                            value={codeSnippet}
                            onChange={(e) => setCodeSnippet(e.target.value)}
                        />

                        <Collapsible
                            open={optionsOpen}
                            onOpenChange={setOptionsOpen}
                            className="border rounded-md p-2"
                        >
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between cursor-pointer p-2 hover:bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-2">
                                        <Settings className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">
                                            Parser Options
                                        </span>
                                    </div>
                                    <Badge variant="outline">
                                        {optionsOpen ? "Hide" : "Show"}
                                    </Badge>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-4 space-y-4 px-2">
                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="update-system"
                                        className="flex-1"
                                    >
                                        Update System Instruction
                                    </Label>
                                    <Switch
                                        id="update-system"
                                        checked={
                                            options.updateSystemInstruction
                                        }
                                        onCheckedChange={(checked) =>
                                            setOptions((prev) => ({
                                                ...prev,
                                                updateSystemInstruction:
                                                    checked,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="append-examples"
                                        className="flex-1"
                                    >
                                        Append Examples (instead of replacing)
                                    </Label>
                                    <Switch
                                        id="append-examples"
                                        checked={options.appendExamples}
                                        onCheckedChange={(checked) =>
                                            setOptions((prev) => ({
                                                ...prev,
                                                appendExamples: checked,
                                            }))
                                        }
                                    />
                                </div>

                                {showTrainingDataOption && (
                                    <div className="space-y-2">
                                        <Label>Target for Examples</Label>
                                        <RadioGroup
                                            value={options.targetExampleType}
                                            onValueChange={(
                                                value:
                                                    | "examples"
                                                    | "training_data"
                                            ) =>
                                                setOptions((prev) => ({
                                                    ...prev,
                                                    targetExampleType: value,
                                                }))
                                            }
                                            className="flex flex-col space-y-1"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="examples"
                                                    id="examples"
                                                />
                                                <Label htmlFor="examples">
                                                    Examples
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem
                                                    value="training_data"
                                                    id="training_data"
                                                />
                                                <Label htmlFor="training_data">
                                                    Training Data
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>
                                )}
                            </CollapsibleContent>
                        </Collapsible>

                        <div className="flex justify-end">
                            <Button
                                onClick={parseCodeSnippet}
                                disabled={!codeSnippet.trim() || parsing}
                                className="w-full sm:w-auto"
                                type="button"
                            >
                                {parsing ? "Parsing..." : "Parse Code Snippet"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {previewData && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-600" />
                            Preview
                        </CardTitle>
                        <CardDescription>
                            Review the extracted data before applying it
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium mb-2">
                                    System Instruction
                                    {!options.updateSystemInstruction && (
                                        <Badge
                                            variant="outline"
                                            className="ml-2 bg-amber-50 text-amber-700 border-amber-200"
                                        >
                                            Will not update
                                        </Badge>
                                    )}
                                </h3>
                                <div className="bg-background p-3 rounded-md text-sm border whitespace-pre-wrap">
                                    {previewData.systemInstruction}
                                </div>
                            </div>

                            {previewData.examples.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-sm font-medium">
                                            {options.targetExampleType ===
                                            "examples"
                                                ? "Examples"
                                                : "Training Data"}
                                        </h3>
                                        <Badge variant="outline">
                                            {previewData.examples.length}
                                        </Badge>
                                        <Badge
                                            variant={
                                                options.appendExamples
                                                    ? "default"
                                                    : "outline"
                                            }
                                            className="ml-auto"
                                        >
                                            {options.appendExamples
                                                ? "Append"
                                                : "Replace"}
                                        </Badge>
                                    </div>

                                    <div className="space-y-3">
                                        {previewData.examples
                                            .slice(0, 2)
                                            .map((example, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-background p-3 rounded-md text-sm border"
                                                >
                                                    <p className="font-medium mb-1">
                                                        User:
                                                    </p>
                                                    <p className="mb-2 text-muted-foreground whitespace-pre-wrap">
                                                        {example.user_message}
                                                    </p>
                                                    <p className="font-medium mb-1">
                                                        Assistant:
                                                    </p>
                                                    <p className="text-muted-foreground whitespace-pre-wrap">
                                                        {
                                                            example.assistant_message
                                                        }
                                                    </p>
                                                </div>
                                            ))}

                                        {previewData.examples.length > 2 && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="text-center text-sm text-muted-foreground">
                                                            +{" "}
                                                            {previewData
                                                                .examples
                                                                .length -
                                                                2}{" "}
                                                            more examples
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>
                                                            All examples will be
                                                            added when you apply
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            onClick={handleApply}
                            className="w-full"
                            variant="default"
                            type="button"
                        >
                            Apply to Form
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
