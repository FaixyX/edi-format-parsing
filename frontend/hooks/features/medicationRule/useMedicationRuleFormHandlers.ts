import { useState, useCallback } from "react";
import { RuleType, NewExcelCell, LlmExample } from "@/types/rule";
import { NewMedicationRule } from "@/types/medicationRule";
import {
    initialMedicationRuleState,
    initialExcelCellState,
    initialLlmExampleState,
} from "@/constants/medicationRule";
import { ChangeEventOrCustomEvent } from "@/types/common";
import { toast } from "sonner";

export function useMedicationRuleFormHandlers() {
    const [newRule, setNewRule] = useState<NewMedicationRule>(
        initialMedicationRuleState
    );
    const [editingRule, setEditingRule] = useState<NewMedicationRule | null>(
        null
    );
    const [newExcelCell, setNewExcelCell] = useState<NewExcelCell>(
        initialExcelCellState
    );
    const [newLlmExample, setNewLlmExample] = useState<LlmExample>(
        initialLlmExampleState
    );
    const [editingExampleIndex, setEditingExampleIndex] = useState<
        number | null
    >(null);
    const [editingExample, setEditingExample] = useState<LlmExample | null>(
        null
    );

    // Handle system instruction change from code snippet parser
    const handleSystemInstructionChange = useCallback(
        (value: string, isEditing: boolean) => {
            if (isEditing && editingRule) {
                setEditingRule((prev) => ({
                    ...prev!,
                    llm_system_instruction: value,
                }));
            } else {
                setNewRule((prev) => ({
                    ...prev,
                    llm_system_instruction: value,
                }));
            }
        },
        [editingRule]
    );

    // Handle examples change from code snippet parser
    const handleLlmExamplesChange = useCallback(
        (examples: LlmExample[], isEditing: boolean) => {
            if (isEditing && editingRule) {
                setEditingRule((prev) => ({
                    ...prev!,
                    llm_examples: examples,
                }));
            } else {
                setNewRule((prev) => ({
                    ...prev,
                    llm_examples: examples,
                }));
            }
        },
        [editingRule]
    );

    const resetForm = useCallback(() => {
        setNewRule(initialMedicationRuleState);
        setEditingRule(null);
        setNewExcelCell(initialExcelCellState);
        setNewLlmExample(initialLlmExampleState);
        setEditingExampleIndex(null);
        setEditingExample(null);
    }, []);

    const handleInputChange = useCallback(
        (
            e: ChangeEventOrCustomEvent<HTMLInputElement | HTMLTextAreaElement>,
            isEditing: boolean
        ) => {
            const { name, value } = e.target;
            if (isEditing && editingRule) {
                setEditingRule((prev) => ({ ...prev!, [name]: value }));
            } else {
                setNewRule((prev) => ({ ...prev, [name]: value }));
            }
        },
        [editingRule]
    );

    const handleRuleTypeChange = useCallback(
        (value: RuleType, isEditing: boolean) => {
            if (isEditing && editingRule) {
                setEditingRule((prev) => {
                    const updated = { ...prev!, rule_type: value };

                    // Current rule type
                    const prevType = prev!.rule_type;

                    // If changing from a more permissive to a more restrictive type
                    if (
                        (prevType === "LLM_COMPLEX" &&
                            (value === "LLM_SIMPLE" || value === "DIRECT")) ||
                        (prevType === "LLM_SIMPLE" && value === "DIRECT")
                    ) {
                        let updatedCells = [...updated.excel_cells];

                        // Direct mapping and Simple LLM can only have one Excel cell
                        if (value === "DIRECT" || value === "LLM_SIMPLE") {
                            if (updated.excel_cells.length > 1) {
                                updatedCells =
                                    updated.excel_cells.length > 0
                                        ? [updated.excel_cells[0]]
                                        : [];
                                toast.info(
                                    `Only one Excel cell is allowed for ${
                                        value === "DIRECT"
                                            ? "Direct Mapping"
                                            : "Simple LLM"
                                    }. Keeping only the first cell.`
                                );
                                updated.excel_cells = updatedCells;
                            }
                        }
                    }

                    // Generate assistant template immediately if changing to Complex LLM
                    if (value === "LLM_COMPLEX") {
                        if (updated.excel_cells.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: "",
                            }));
                        } else {
                            const cellTemplate = updated.excel_cells
                                .map((cell) => `"${cell.cell_reference}": ""`)
                                .join(",\n");

                            const template = `{\n${cellTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            } else {
                setNewRule((prev) => {
                    const updated = { ...prev, rule_type: value };

                    // Current rule type
                    const prevType = prev.rule_type;

                    // If changing from a more permissive to a more restrictive type
                    if (
                        (prevType === "LLM_COMPLEX" &&
                            (value === "LLM_SIMPLE" || value === "DIRECT")) ||
                        (prevType === "LLM_SIMPLE" && value === "DIRECT")
                    ) {
                        let updatedCells = [...updated.excel_cells];

                        // Direct mapping and Simple LLM can only have one Excel cell
                        if (value === "DIRECT" || value === "LLM_SIMPLE") {
                            if (updated.excel_cells.length > 1) {
                                updatedCells =
                                    updated.excel_cells.length > 0
                                        ? [updated.excel_cells[0]]
                                        : [];
                                toast.info(
                                    `Only one Excel cell is allowed for ${
                                        value === "DIRECT"
                                            ? "Direct Mapping"
                                            : "Simple LLM"
                                    }. Keeping only the first cell.`
                                );
                                updated.excel_cells = updatedCells;
                            }
                        }
                    }

                    // Generate assistant template immediately if changing to Complex LLM
                    if (value === "LLM_COMPLEX") {
                        if (updated.excel_cells.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: "",
                            }));
                        } else {
                            const cellTemplate = updated.excel_cells
                                .map((cell) => `"${cell.cell_reference}": ""`)
                                .join(",\n");

                            const template = `{\n${cellTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            }
        },
        [editingRule]
    );

    const handleExcelCellInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setNewExcelCell((prev) => ({ ...prev, [name]: value }));
        },
        []
    );

    const addExcelCell = useCallback(
        (isEditing: boolean) => {
            if (newExcelCell.cell_reference) {
                if (isEditing && editingRule) {
                    setEditingRule((prev) => {
                        // For DIRECT and LLM_SIMPLE rule types, replace the existing cell
                        if (
                            (prev!.rule_type === "DIRECT" ||
                                prev!.rule_type === "LLM_SIMPLE") &&
                            prev!.excel_cells.length >= 1
                        ) {
                            const ruleTypeLabel =
                                prev!.rule_type === "DIRECT"
                                    ? "Direct Mapping"
                                    : "Simple LLM";
                            toast.info(
                                `${ruleTypeLabel} can only have one Excel cell. Replacing the existing cell.`
                            );

                            const updated = {
                                ...prev!,
                                excel_cells: [newExcelCell],
                            };

                            // Generate template immediately if in Complex LLM mode
                            if (updated.rule_type === "LLM_COMPLEX") {
                                if (updated.excel_cells.length === 0) {
                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: "",
                                    }));
                                } else {
                                    const cellTemplate = updated.excel_cells
                                        .map(
                                            (cell) =>
                                                `"${cell.cell_reference}": ""`
                                        )
                                        .join(",\n");

                                    const template = `{\n${cellTemplate}\n}`;

                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: template,
                                    }));
                                }
                            }

                            return updated;
                        } else {
                            const updated = {
                                ...prev!,
                                excel_cells: [
                                    ...prev!.excel_cells,
                                    newExcelCell,
                                ],
                            };

                            // Generate template immediately if in Complex LLM mode
                            if (updated.rule_type === "LLM_COMPLEX") {
                                if (updated.excel_cells.length === 0) {
                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: "",
                                    }));
                                } else {
                                    const cellTemplate = updated.excel_cells
                                        .map(
                                            (cell) =>
                                                `"${cell.cell_reference}": ""`
                                        )
                                        .join(",\n");

                                    const template = `{\n${cellTemplate}\n}`;

                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: template,
                                    }));
                                }
                            }

                            return updated;
                        }
                    });
                } else {
                    setNewRule((prev) => {
                        // For DIRECT and LLM_SIMPLE rule types, replace the existing cell
                        if (
                            (prev.rule_type === "DIRECT" ||
                                prev.rule_type === "LLM_SIMPLE") &&
                            prev.excel_cells.length >= 1
                        ) {
                            const ruleTypeLabel =
                                prev.rule_type === "DIRECT"
                                    ? "Direct Mapping"
                                    : "Simple LLM";
                            toast.info(
                                `${ruleTypeLabel} can only have one Excel cell. Replacing the existing cell.`
                            );

                            const updated = {
                                ...prev,
                                excel_cells: [newExcelCell],
                            };

                            // Generate template immediately if in Complex LLM mode
                            if (updated.rule_type === "LLM_COMPLEX") {
                                if (updated.excel_cells.length === 0) {
                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: "",
                                    }));
                                } else {
                                    const cellTemplate = updated.excel_cells
                                        .map(
                                            (cell) =>
                                                `"${cell.cell_reference}": ""`
                                        )
                                        .join(",\n");

                                    const template = `{\n${cellTemplate}\n}`;

                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: template,
                                    }));
                                }
                            }

                            return updated;
                        } else {
                            const updated = {
                                ...prev,
                                excel_cells: [
                                    ...prev.excel_cells,
                                    newExcelCell,
                                ],
                            };

                            // Generate template immediately if in Complex LLM mode
                            if (updated.rule_type === "LLM_COMPLEX") {
                                if (updated.excel_cells.length === 0) {
                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: "",
                                    }));
                                } else {
                                    const cellTemplate = updated.excel_cells
                                        .map(
                                            (cell) =>
                                                `"${cell.cell_reference}": ""`
                                        )
                                        .join(",\n");

                                    const template = `{\n${cellTemplate}\n}`;

                                    setNewLlmExample((prevExample) => ({
                                        ...prevExample,
                                        assistant_message: template,
                                    }));
                                }
                            }

                            return updated;
                        }
                    });
                }
                setNewExcelCell(initialExcelCellState);
            }
        },
        [newExcelCell, editingRule]
    );

    const removeExcelCell = useCallback(
        (index: number, isEditing: boolean) => {
            if (isEditing && editingRule) {
                setEditingRule((prev) => {
                    const updatedCells = prev!.excel_cells.filter(
                        (_, i) => i !== index
                    );
                    const updated = {
                        ...prev!,
                        excel_cells: updatedCells,
                    };

                    // Generate template immediately if in Complex LLM mode
                    if (updated.rule_type === "LLM_COMPLEX") {
                        if (updatedCells.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: "",
                            }));
                        } else {
                            const cellTemplate = updatedCells
                                .map((cell) => `"${cell.cell_reference}": ""`)
                                .join(",\n");

                            const template = `{\n${cellTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            } else {
                setNewRule((prev) => {
                    const updatedCells = prev.excel_cells.filter(
                        (_, i) => i !== index
                    );
                    const updated = {
                        ...prev,
                        excel_cells: updatedCells,
                    };

                    // Generate template immediately if in Complex LLM mode
                    if (updated.rule_type === "LLM_COMPLEX") {
                        if (updatedCells.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: "",
                            }));
                        } else {
                            const cellTemplate = updatedCells
                                .map((cell) => `"${cell.cell_reference}": ""`)
                                .join(",\n");

                            const template = `{\n${cellTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                assistant_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            }
        },
        [editingRule]
    );

    const handleLlmExampleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setNewLlmExample((prev) => ({ ...prev, [name]: value }));
        },
        []
    );

    const handleEditExampleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { name, value } = e.target;
            setEditingExample((prev) => ({ ...prev!, [name]: value }));
        },
        []
    );

    const addLlmExample = useCallback(
        (isEditing: boolean) => {
            // Allow adding examples even if fields are empty
            if (isEditing && editingRule) {
                setEditingRule((prev) => ({
                    ...prev!,
                    llm_examples: [
                        ...(prev!.llm_examples || []),
                        newLlmExample,
                    ],
                }));
            } else {
                setNewRule((prev) => ({
                    ...prev,
                    llm_examples: [...(prev.llm_examples || []), newLlmExample],
                }));
            }
            setNewLlmExample(initialLlmExampleState);
        },
        [newLlmExample, editingRule]
    );

    const editLlmExample = useCallback(
        (index: number, isEditing: boolean) => {
            const examples = isEditing
                ? editingRule?.llm_examples || []
                : newRule.llm_examples || [];
            setEditingExample(examples[index]);
            setEditingExampleIndex(index);
        },
        [editingRule, newRule.llm_examples]
    );

    const cancelEditLlmExample = useCallback(() => {
        setEditingExample(null);
        setEditingExampleIndex(null);
    }, []);

    const saveEditLlmExample = useCallback(
        (isEditing: boolean) => {
            if (editingExample && editingExampleIndex !== null) {
                if (isEditing && editingRule) {
                    setEditingRule((prev) => {
                        const newExamples = [...(prev!.llm_examples || [])];
                        newExamples[editingExampleIndex] = editingExample;
                        return { ...prev!, llm_examples: newExamples };
                    });
                } else {
                    setNewRule((prev) => {
                        const newExamples = [...(prev.llm_examples || [])];
                        newExamples[editingExampleIndex] = editingExample;
                        return { ...prev, llm_examples: newExamples };
                    });
                }
                cancelEditLlmExample();
            }
        },
        [editingExample, editingExampleIndex, editingRule, cancelEditLlmExample]
    );

    const removeLlmExample = useCallback(
        (index: number, isEditing: boolean) => {
            if (isEditing && editingRule) {
                setEditingRule((prev) => ({
                    ...prev!,
                    llm_examples: (prev!.llm_examples || []).filter(
                        (_, i) => i !== index
                    ),
                }));
            } else {
                setNewRule((prev) => ({
                    ...prev,
                    llm_examples: (prev.llm_examples || []).filter(
                        (_, i) => i !== index
                    ),
                }));
            }
        },
        [editingRule]
    );

    const generateLlmAssistantTemplate = useCallback(
        (isEditing: boolean) => {
            const excelCells = isEditing
                ? editingRule?.excel_cells || []
                : newRule.excel_cells || [];

            // If there are no Excel cells, set an empty template
            if (excelCells.length === 0) {
                setNewLlmExample((prev) => ({
                    ...prev,
                    assistant_message: "",
                }));
                return;
            }

            // Generate template with Excel cells as Python dict
            const cellTemplate = excelCells
                .map((cell) => `"${cell.cell_reference}": ""`)
                .join(",\n");

            const template = `{\n${cellTemplate}\n}`;

            setNewLlmExample((prev) => ({
                ...prev,
                assistant_message: template,
            }));
        },
        [editingRule, newRule.excel_cells]
    );

    return {
        newRule,
        setNewRule,
        editingRule,
        setEditingRule,
        newExcelCell,
        newLlmExample,
        editingExampleIndex,
        editingExample,
        handleInputChange,
        handleRuleTypeChange,
        handleExcelCellInputChange,
        handleLlmExampleInputChange,
        handleEditExampleChange,
        addExcelCell,
        removeExcelCell,
        addLlmExample,
        editLlmExample,
        saveEditLlmExample,
        cancelEditLlmExample,
        removeLlmExample,
        resetForm,
        generateLlmAssistantTemplate,
        handleSystemInstructionChange,
        handleLlmExamplesChange,
    };
}
