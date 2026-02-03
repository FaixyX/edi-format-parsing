import { FormField } from "@/components/ui/data-table/form-field";
import { Button } from "@/components/ui/button";
import { Plus, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { NewExcelCell, RuleType } from "@/types/rule";

interface ExcelCellsSectionProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    newExcelCell: {
        cell_reference: string;
        description?: string;
    };
    excelCells: NewExcelCell[];
    onExcelCellInputChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => void;
    onAddExcelCell: () => void;
    onRemoveExcelCell: (index: number) => void;
    ruleType: RuleType;
}

export function ExcelCellsSection({
    isOpen,
    onOpenChange,
    newExcelCell,
    excelCells,
    onExcelCellInputChange,
    onAddExcelCell,
    onRemoveExcelCell,
    ruleType,
}: ExcelCellsSectionProps) {
    const isComplexLLM = ruleType === "LLM_COMPLEX";
    const maxCellsReached = !isComplexLLM && excelCells.length > 0;

    return (
        <CollapsibleSection
            title="Excel Cells"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            titleClassName="text-green-500"
        >
            {!isComplexLLM && (
                <div className="mb-2 text-sm flex items-center text-muted-foreground">
                    <Info className="h-4 w-4 mr-1" />
                    {ruleType === "DIRECT"
                        ? "Direct mapping"
                        : "Simple LLM"}{" "}
                    allows only one Excel cell.
                </div>
            )}

            <div className="flex gap-2 align-middle">
                <FormField
                    label="Cell Reference"
                    id="cell_reference"
                    name="cell_reference"
                    className="w-full"
                    value={newExcelCell.cell_reference}
                    onChange={onExcelCellInputChange}
                    placeholder="Enter cell reference (e.g., A1, B2)"
                />
                <Button
                    size="icon"
                    variant="outline"
                    onClick={onAddExcelCell}
                    disabled={!newExcelCell.cell_reference || maxCellsReached}
                >
                    <Plus />
                </Button>
            </div>

            {excelCells.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {excelCells.map((cell, index) => (
                        <Badge
                            key={index}
                            variant="cell"
                            className="text-sm flex items-center gap-1 pr-1 bg-blue-50"
                        >
                            {cell.cell_reference}
                            <Button
                                type="button"
                                variant="link"
                                size="icon"
                                className="h-5 w-5 p-0 text-green-500"
                                onClick={() => onRemoveExcelCell(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
            )}
        </CollapsibleSection>
    );
}
