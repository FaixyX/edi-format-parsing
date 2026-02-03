import { useState } from "react";
import {
    Rule,
    RuleType,
    NewRule,
    NewPdfField,
    NewExcelCell,
    LlmExample,
} from "@/types/rule";
import {
    initialRuleState,
    initialPdfFieldState,
    initialExcelCellState,
    initialLlmExampleState,
} from "@/constants/rule";
import { toast } from "sonner";
import { ChangeEventOrCustomEvent } from "@/types/common";

export function useRuleFormHandlers() {
    const [newRule, setNewRule] = useState<NewRule>(initialRuleState);
    const [editingRule, setEditingRule] = useState<Rule | null>(null);
    const [newPdfField, setNewPdfField] =
        useState<NewPdfField>(initialPdfFieldState);
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

    // New function to handle system instruction changes from code snippet parser
    const handleSystemInstructionChange = (
        value: string,
        isEditing: boolean = false
    ) => {
        if (isEditing && editingRule) {
            setEditingRule({
                ...editingRule,
                llm_system_instruction: value,
            });
        } else {
            setNewRule({
                ...newRule,
                llm_system_instruction: value,
            });
        }
    };

    // New function to handle examples changes from code snippet parser
    const handleLlmExamplesChange = (
        examples: LlmExample[],
        isEditing: boolean = false
    ) => {
        if (isEditing && editingRule) {
            setEditingRule({
                ...editingRule,
                llm_examples: examples,
            });
        } else {
            setNewRule({
                ...newRule,
                llm_examples: examples,
            });
        }
    };

    const generateLlmAssistantTemplate = (isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            if (editingRule.rule_type === "LLM_COMPLEX") {
                if (editingRule.excel_cells.length === 0) {
                    setNewLlmExample((prev) => ({
                        ...prev,
                        assistant_message: "",
                    }));
                } else {
                    const cellTemplate = editingRule.excel_cells
                        .map((cell) => `"${cell.cell_reference}": ""`)
                        .join(",\n");

                    const template = `{\n${cellTemplate}\n}`;

                    setNewLlmExample((prev) => ({
                        ...prev,
                        assistant_message: template,
                    }));
                }
            }
        } else {
            if (newRule.rule_type === "LLM_COMPLEX") {
                if (newRule.excel_cells.length === 0) {
                    setNewLlmExample((prev) => ({
                        ...prev,
                        assistant_message: "",
                    }));
                } else {
                    const cellTemplate = newRule.excel_cells
                        .map((cell) => `"${cell.cell_reference}": ""`)
                        .join(",\n");

                    const template = `{\n${cellTemplate}\n}`;

                    setNewLlmExample((prev) => ({
                        ...prev,
                        assistant_message: template,
                    }));
                }
            }
        }
    };

    const generateLlmUserTemplate = (isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            if (
                editingRule.rule_type === "LLM_SIMPLE" ||
                editingRule.rule_type === "LLM_COMPLEX"
            ) {
                if (editingRule.pdf_fields.length === 0) {
                    setNewLlmExample((prev) => ({
                        ...prev,
                        user_message: "",
                    }));
                } else {
                    const fieldTemplate = editingRule.pdf_fields
                        .map((field) => `"${field.field_name}": ""`)
                        .join(",\n");

                    const template = `{\n${fieldTemplate}\n}`;

                    setNewLlmExample((prev) => ({
                        ...prev,
                        user_message: template,
                    }));
                }
            }
        } else {
            if (
                newRule.rule_type === "LLM_SIMPLE" ||
                newRule.rule_type === "LLM_COMPLEX"
            ) {
                if (newRule.pdf_fields.length === 0) {
                    setNewLlmExample((prev) => ({
                        ...prev,
                        user_message: "",
                    }));
                } else {
                    const fieldTemplate = newRule.pdf_fields
                        .map((field) => `"${field.field_name}": ""`)
                        .join(",\n");

                    const template = `{\n${fieldTemplate}\n}`;

                    setNewLlmExample((prev) => ({
                        ...prev,
                        user_message: template,
                    }));
                }
            }
        }
    };

    const handleInputChange = (
        e: ChangeEventOrCustomEvent<HTMLInputElement | HTMLTextAreaElement>,
        isEditing: boolean = false
    ) => {
        const { name, value } = e.target;

        // Special handling for pdf_fields and excel_cells arrays
        if (name === "pdf_fields" || name === "excel_cells") {
            if (isEditing && editingRule) {
                setEditingRule({ ...editingRule, [name]: value });
            } else {
                setNewRule({ ...newRule, [name]: value });
            }
            return;
        }

        // Regular handling for other fields
        if (isEditing && editingRule) {
            setEditingRule({ ...editingRule, [name]: value });
        } else {
            setNewRule({ ...newRule, [name]: value });
        }
    };

    const handleRuleTypeChange = (
        value: RuleType,
        isEditing: boolean = false
    ) => {
        if (isEditing && editingRule) {
            // Current rule type
            const prevType = editingRule.rule_type;

            // If changing from a more permissive to a more restrictive type
            if (
                (prevType === "LLM_COMPLEX" &&
                    (value === "LLM_SIMPLE" || value === "DIRECT")) ||
                (prevType === "LLM_SIMPLE" && value === "DIRECT")
            ) {
                let updatedFields = [...editingRule.pdf_fields];
                let updatedCells = [...editingRule.excel_cells];

                // Direct mapping can only have one PDF field and one Excel cell
                if (value === "DIRECT") {
                    if (editingRule.pdf_fields.length > 1) {
                        updatedFields =
                            editingRule.pdf_fields.length > 0
                                ? [editingRule.pdf_fields[0]]
                                : [];
                        toast.info(
                            "Only one PDF field is allowed for Direct Mapping. Keeping only the first field."
                        );
                    }

                    if (editingRule.excel_cells.length > 1) {
                        updatedCells =
                            editingRule.excel_cells.length > 0
                                ? [editingRule.excel_cells[0]]
                                : [];
                        toast.info(
                            "Only one Excel cell is allowed for Direct Mapping. Keeping only the first cell."
                        );
                    }
                }

                // Simple LLM can have multiple PDF fields but only one Excel cell
                if (
                    value === "LLM_SIMPLE" &&
                    editingRule.excel_cells.length > 1
                ) {
                    updatedCells =
                        editingRule.excel_cells.length > 0
                            ? [editingRule.excel_cells[0]]
                            : [];
                    toast.info(
                        "Only one Excel cell is allowed for Simple LLM. Keeping only the first cell."
                    );
                }

                setEditingRule((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        rule_type: value,
                        pdf_fields: updatedFields,
                        excel_cells: updatedCells,
                    };
                });
            } else {
                setEditingRule({ ...editingRule, rule_type: value });
            }

            // Update template immediately if changing to Complex LLM
            if (value === "LLM_COMPLEX") {
                // We need to wait for the state update to complete
                setEditingRule((prev) => {
                    if (prev) {
                        const updated = { ...prev, rule_type: value };
                        // Generate template with the updated rule
                        if (updated.rule_type === "LLM_COMPLEX") {
                            if (updated.excel_cells.length === 0) {
                                setNewLlmExample((prevExample) => ({
                                    ...prevExample,
                                    assistant_message: "",
                                }));
                            } else {
                                const cellTemplate = updated.excel_cells
                                    .map(
                                        (cell) => `"${cell.cell_reference}": ""`
                                    )
                                    .join(",\n");

                                const template = `{\n${cellTemplate}\n}`;

                                setNewLlmExample((prevExample) => ({
                                    ...prevExample,
                                    assistant_message: template,
                                }));
                            }
                        }

                        // Generate user template with PDF fields
                        if (updated.pdf_fields.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: "",
                            }));
                        } else {
                            const fieldTemplate = updated.pdf_fields
                                .map((field) => `"${field.field_name}": ""`)
                                .join(",\n");

                            const template = `{\n${fieldTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: template,
                            }));
                        }

                        return updated;
                    }
                    return prev;
                });
            } else if (value === "LLM_SIMPLE") {
                // Generate user template for Simple LLM
                setEditingRule((prev) => {
                    if (prev) {
                        const updated = { ...prev, rule_type: value };

                        // Generate user template with PDF fields
                        if (updated.pdf_fields.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: "",
                            }));
                        } else {
                            const fieldTemplate = updated.pdf_fields
                                .map((field) => `"${field.field_name}": ""`)
                                .join(",\n");

                            const template = `{\n${fieldTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: template,
                            }));
                        }

                        return updated;
                    }
                    return prev;
                });
            }
        } else {
            // Current rule type
            const prevType = newRule.rule_type;

            // If changing from a more permissive to a more restrictive type
            if (
                (prevType === "LLM_COMPLEX" &&
                    (value === "LLM_SIMPLE" || value === "DIRECT")) ||
                (prevType === "LLM_SIMPLE" && value === "DIRECT")
            ) {
                let updatedFields = [...newRule.pdf_fields];
                let updatedCells = [...newRule.excel_cells];

                // Direct mapping can only have one PDF field and one Excel cell
                if (value === "DIRECT") {
                    if (newRule.pdf_fields.length > 1) {
                        updatedFields =
                            newRule.pdf_fields.length > 0
                                ? [newRule.pdf_fields[0]]
                                : [];
                        toast.info(
                            "Only one PDF field is allowed for Direct Mapping. Keeping only the first field."
                        );
                    }

                    if (newRule.excel_cells.length > 1) {
                        updatedCells =
                            newRule.excel_cells.length > 0
                                ? [newRule.excel_cells[0]]
                                : [];
                        toast.info(
                            "Only one Excel cell is allowed for Direct Mapping. Keeping only the first cell."
                        );
                    }
                }

                // Simple LLM can have multiple PDF fields but only one Excel cell
                if (value === "LLM_SIMPLE" && newRule.excel_cells.length > 1) {
                    updatedCells =
                        newRule.excel_cells.length > 0
                            ? [newRule.excel_cells[0]]
                            : [];
                    toast.info(
                        "Only one Excel cell is allowed for Simple LLM. Keeping only the first cell."
                    );
                }

                setNewRule((prev) => ({
                    ...prev,
                    rule_type: value,
                    pdf_fields: updatedFields,
                    excel_cells: updatedCells,
                }));
            } else {
                setNewRule({ ...newRule, rule_type: value });
            }

            // Update template immediately if changing to Complex LLM
            if (value === "LLM_COMPLEX") {
                setNewRule((prev) => {
                    const updated = { ...prev, rule_type: value };
                    // Generate template with the updated rule
                    if (updated.rule_type === "LLM_COMPLEX") {
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

                    // Generate user template with PDF fields
                    if (updated.pdf_fields.length === 0) {
                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: "",
                        }));
                    } else {
                        const fieldTemplate = updated.pdf_fields
                            .map((field) => `"${field.field_name}": ""`)
                            .join(",\n");

                        const template = `{\n${fieldTemplate}\n}`;

                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: template,
                        }));
                    }

                    return updated;
                });
            } else if (value === "LLM_SIMPLE") {
                // Generate user template for Simple LLM
                setNewRule((prev) => {
                    const updated = { ...prev, rule_type: value };

                    // Generate user template with PDF fields
                    if (updated.pdf_fields.length === 0) {
                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: "",
                        }));
                    } else {
                        const fieldTemplate = updated.pdf_fields
                            .map((field) => `"${field.field_name}": ""`)
                            .join(",\n");

                        const template = `{\n${fieldTemplate}\n}`;

                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: template,
                        }));
                    }

                    return updated;
                });
            }
        }
    };

    const handlePdfFieldInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setNewPdfField({ ...newPdfField, [name]: value });
    };

    const handlePdfFieldChange = (value: string) => {
        setNewPdfField({ ...newPdfField, field_name: value });
    };

    const handleExcelCellInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setNewExcelCell({ ...newExcelCell, [name]: value });
    };

    const handleLlmExampleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setNewLlmExample({ ...newLlmExample, [name]: value });
    };

    const addPdfField = (isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            // For DIRECT rule type, replace the existing field
            if (
                editingRule.rule_type === "DIRECT" &&
                editingRule.pdf_fields.length >= 1
            ) {
                toast.info(
                    "Direct Mapping can only have one PDF field. Replacing the existing field."
                );
                setEditingRule({
                    ...editingRule,
                    pdf_fields: [
                        { ...newPdfField, id: -1, rule_id: editingRule.id },
                    ],
                });
            } else {
                // For other rule types, add to the list
                setEditingRule((prev) => {
                    if (!prev) return prev;
                    const updated = {
                        ...prev,
                        pdf_fields: [
                            ...prev.pdf_fields,
                            { ...newPdfField, id: -1, rule_id: prev.id },
                        ],
                    };

                    // Generate user template for LLM rules
                    if (
                        updated.rule_type === "LLM_SIMPLE" ||
                        updated.rule_type === "LLM_COMPLEX"
                    ) {
                        if (updated.pdf_fields.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: "",
                            }));
                        } else {
                            const fieldTemplate = updated.pdf_fields
                                .map((field) => `"${field.field_name}": ""`)
                                .join(",\n");

                            const template = `{\n${fieldTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            }
        } else {
            // For DIRECT rule type, replace the existing field
            if (
                newRule.rule_type === "DIRECT" &&
                newRule.pdf_fields.length >= 1
            ) {
                toast.info(
                    "Direct Mapping can only have one PDF field. Replacing the existing field."
                );
                setNewRule({
                    ...newRule,
                    pdf_fields: [newPdfField],
                });
            } else {
                // For other rule types, add to the list
                setNewRule((prev) => {
                    const updated = {
                        ...prev,
                        pdf_fields: [...prev.pdf_fields, newPdfField],
                    };

                    // Generate user template for LLM rules
                    if (
                        updated.rule_type === "LLM_SIMPLE" ||
                        updated.rule_type === "LLM_COMPLEX"
                    ) {
                        if (updated.pdf_fields.length === 0) {
                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: "",
                            }));
                        } else {
                            const fieldTemplate = updated.pdf_fields
                                .map((field) => `"${field.field_name}": ""`)
                                .join(",\n");

                            const template = `{\n${fieldTemplate}\n}`;

                            setNewLlmExample((prevExample) => ({
                                ...prevExample,
                                user_message: template,
                            }));
                        }
                    }

                    return updated;
                });
            }
        }
        setNewPdfField(initialPdfFieldState);
    };

    const removePdfField = (index: number, isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            const updatedFields = [...editingRule.pdf_fields];
            updatedFields.splice(index, 1);

            setEditingRule((prev) => {
                if (!prev) return prev;
                const updated = {
                    ...prev,
                    pdf_fields: updatedFields,
                };

                // Generate user template for LLM rules
                if (
                    updated.rule_type === "LLM_SIMPLE" ||
                    updated.rule_type === "LLM_COMPLEX"
                ) {
                    if (updatedFields.length === 0) {
                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: "",
                        }));
                    } else {
                        const fieldTemplate = updatedFields
                            .map((field) => `"${field.field_name}": ""`)
                            .join(",\n");

                        const template = `{\n${fieldTemplate}\n}`;

                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: template,
                        }));
                    }
                }

                return updated;
            });
        } else {
            const updatedFields = [...newRule.pdf_fields];
            updatedFields.splice(index, 1);

            setNewRule((prev) => {
                const updated = {
                    ...prev,
                    pdf_fields: updatedFields,
                };

                // Generate user template for LLM rules
                if (
                    updated.rule_type === "LLM_SIMPLE" ||
                    updated.rule_type === "LLM_COMPLEX"
                ) {
                    if (updatedFields.length === 0) {
                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: "",
                        }));
                    } else {
                        const fieldTemplate = updatedFields
                            .map((field) => `"${field.field_name}": ""`)
                            .join(",\n");

                        const template = `{\n${fieldTemplate}\n}`;

                        setNewLlmExample((prevExample) => ({
                            ...prevExample,
                            user_message: template,
                        }));
                    }
                }

                return updated;
            });
        }
    };

    const addExcelCell = (isEditing: boolean = false) => {
        // Get the new cell to add
        const cellToAdd = { ...newExcelCell };

        if (isEditing && editingRule) {
            // For DIRECT and LLM_SIMPLE, replace the existing cell
            if (
                (editingRule.rule_type === "DIRECT" ||
                    editingRule.rule_type === "LLM_SIMPLE") &&
                editingRule.excel_cells.length >= 1
            ) {
                const ruleTypeLabel =
                    editingRule.rule_type === "DIRECT"
                        ? "Direct Mapping"
                        : "Simple LLM";
                toast.info(
                    `${ruleTypeLabel} can only have one Excel cell. Replacing the existing cell.`
                );

                // Create updated cells list with just the new cell
                const updatedCells = [
                    { ...cellToAdd, id: -1, rule_id: editingRule.id },
                ];

                // Update state with new cell
                setEditingRule((prev) => {
                    if (!prev) return prev;
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
            } else {
                // For LLM_COMPLEX, add to the list
                // Create updated cells list
                const updatedCells = [
                    ...editingRule.excel_cells,
                    { ...cellToAdd, id: -1, rule_id: editingRule.id },
                ];

                // Update state with new cells
                setEditingRule((prev) => {
                    if (!prev) return prev;
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
        } else {
            // For DIRECT and LLM_SIMPLE, replace the existing cell
            if (
                (newRule.rule_type === "DIRECT" ||
                    newRule.rule_type === "LLM_SIMPLE") &&
                newRule.excel_cells.length >= 1
            ) {
                const ruleTypeLabel =
                    newRule.rule_type === "DIRECT"
                        ? "Direct Mapping"
                        : "Simple LLM";
                toast.info(
                    `${ruleTypeLabel} can only have one Excel cell. Replacing the existing cell.`
                );

                // Create updated cells list with just the new cell
                const updatedCells = [cellToAdd];

                // Update state with new cell
                setNewRule((prev) => {
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
            } else {
                // For LLM_COMPLEX, add to the list
                // Create updated cells list
                const updatedCells = [...newRule.excel_cells, cellToAdd];

                // Update state with new cells
                setNewRule((prev) => {
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
        }

        // Reset cell input
        setNewExcelCell(initialExcelCellState);
    };

    const removeExcelCell = (index: number, isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            const updatedCells = [...editingRule.excel_cells];
            updatedCells.splice(index, 1);

            setEditingRule((prev) => {
                if (!prev) return prev;
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
        } else {
            const updatedCells = [...newRule.excel_cells];
            updatedCells.splice(index, 1);

            setNewRule((prev) => {
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
    };

    const addLlmExample = (isEditing: boolean = false) => {
        // if (
        //     !newLlmExample.user_message.trim() ||
        //     !newLlmExample.assistant_message.trim()
        // ) {
        //     return;
        // }

        // Store the current LLM example to add
        const exampleToAdd = { ...newLlmExample };

        if (editingExampleIndex !== null) {
            // We're updating an existing example
            if (isEditing && editingRule) {
                const updatedExamples = [...(editingRule.llm_examples || [])];
                updatedExamples[editingExampleIndex] = exampleToAdd;
                setEditingRule({
                    ...editingRule,
                    llm_examples: updatedExamples,
                });
            } else {
                const updatedExamples = [...(newRule.llm_examples || [])];
                updatedExamples[editingExampleIndex] = exampleToAdd;
                setNewRule({
                    ...newRule,
                    llm_examples: updatedExamples,
                });
            }

            // Reset editing state
            setEditingExampleIndex(null);
            toast.success("Example updated successfully");
        } else {
            // We're adding a new example
            if (isEditing && editingRule) {
                setEditingRule({
                    ...editingRule,
                    llm_examples: [
                        ...(editingRule.llm_examples || []),
                        exampleToAdd,
                    ],
                });
            } else {
                setNewRule({
                    ...newRule,
                    llm_examples: [
                        ...(newRule.llm_examples || []),
                        exampleToAdd,
                    ],
                });
            }
        }

        // Reset and generate new template immediately
        setNewLlmExample(initialLlmExampleState);

        // After adding an example, regenerate the template for the next one
        if (
            (isEditing &&
                editingRule &&
                editingRule.rule_type === "LLM_COMPLEX") ||
            (!isEditing && newRule.rule_type === "LLM_COMPLEX")
        ) {
            generateLlmAssistantTemplate(isEditing);
            generateLlmUserTemplate(isEditing);
        }
    };

    const editLlmExample = (index: number, isEditing: boolean = false) => {
        // Set the example we want to edit to the form state
        if (isEditing && editingRule) {
            const examples = editingRule.llm_examples || [];
            if (examples[index]) {
                setEditingExample({ ...examples[index] });
                setEditingExampleIndex(index);
            }
        } else {
            const examples = newRule.llm_examples || [];
            if (examples[index]) {
                setEditingExample({ ...examples[index] });
                setEditingExampleIndex(index);
            }
        }
    };

    const handleEditExampleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        if (editingExample) {
            setEditingExample({
                ...editingExample,
                [name]: value,
            });
        }
    };

    const saveEditLlmExample = (isEditing: boolean = false) => {
        if (editingExampleIndex === null || !editingExample) return;

        if (isEditing && editingRule) {
            const updatedExamples = [...(editingRule.llm_examples || [])];
            updatedExamples[editingExampleIndex] = editingExample;
            setEditingRule({
                ...editingRule,
                llm_examples: updatedExamples,
            });
        } else {
            const updatedExamples = [...(newRule.llm_examples || [])];
            updatedExamples[editingExampleIndex] = editingExample;
            setNewRule({
                ...newRule,
                llm_examples: updatedExamples,
            });
        }

        // Reset editing state
        setEditingExampleIndex(null);
        setEditingExample(null);
        toast.success("Example updated successfully");
    };

    const cancelEditLlmExample = () => {
        setEditingExampleIndex(null);
        setEditingExample(null);
    };

    const removeLlmExample = (index: number, isEditing: boolean = false) => {
        if (isEditing && editingRule) {
            const updatedExamples = [...(editingRule.llm_examples || [])];
            updatedExamples.splice(index, 1);
            setEditingRule({ ...editingRule, llm_examples: updatedExamples });
        } else {
            const updatedExamples = [...(newRule.llm_examples || [])];
            updatedExamples.splice(index, 1);
            setNewRule({ ...newRule, llm_examples: updatedExamples });
        }
    };

    const resetForm = () => {
        setNewRule(initialRuleState);
        setEditingRule(null);
        setNewPdfField(initialPdfFieldState);
        setNewExcelCell(initialExcelCellState);
        setNewLlmExample(initialLlmExampleState);
        setEditingExampleIndex(null);
        setEditingExample(null);
    };

    return {
        newRule,
        editingRule,
        setEditingRule,
        newPdfField,
        newExcelCell,
        newLlmExample,
        editingExampleIndex,
        editingExample,
        handleInputChange,
        handleRuleTypeChange,
        handlePdfFieldInputChange,
        handlePdfFieldChange,
        handleExcelCellInputChange,
        handleLlmExampleInputChange,
        handleEditExampleChange,
        addPdfField,
        removePdfField,
        addExcelCell,
        removeExcelCell,
        addLlmExample,
        editLlmExample,
        saveEditLlmExample,
        cancelEditLlmExample,
        removeLlmExample,
        resetForm,
        generateLlmAssistantTemplate,
        generateLlmUserTemplate,
        handleSystemInstructionChange,
        handleLlmExamplesChange,
    };
}
