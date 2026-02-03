import { ExcelCell } from "@/types/rule";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExcelCellsListProps {
    cells: ExcelCell[];
    rowId: string;
    isExpanded: boolean;
    badgeClassName?: string;
    onToggleExpand: (rowId: string) => void;
}

export function ExcelCellsList({
    cells,
    rowId,
    isExpanded,
    badgeClassName = "text-xs",
    onToggleExpand,
}: ExcelCellsListProps) {
    if (cells.length === 0) return <div>No cells</div>;

    const displayLimit = isExpanded ? cells.length : 2;
    const hasMore = cells.length > displayLimit && !isExpanded;

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1 max-w-sm">
                {cells.slice(0, displayLimit).map((cell, index) => (
                    <Badge
                        key={index}
                        variant="cell"
                        className={badgeClassName}
                    >
                        {cell.cell_reference}
                    </Badge>
                ))}
                {hasMore && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="text-xs cursor-pointer"
                                    onClick={() => onToggleExpand(rowId)}
                                >
                                    +{cells.length - displayLimit} more
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="gap-1 flex flex-wrap max-w-xs">
                                    {cells
                                        .slice(displayLimit)
                                        .map((cell, index) => (
                                            <Badge
                                                key={index}
                                                variant="cell"
                                                className={badgeClassName}
                                            >
                                                {cell.cell_reference}
                                            </Badge>
                                        ))}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {isExpanded && cells.length > 2 && (
                    <Badge
                        variant="secondary"
                        className="text-xs cursor-pointer"
                        onClick={() => onToggleExpand(rowId)}
                    >
                        Show less
                    </Badge>
                )}
            </div>
        </div>
    );
}
