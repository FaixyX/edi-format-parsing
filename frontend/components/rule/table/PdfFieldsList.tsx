import { PdfField } from "@/types/rule";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PdfFieldsListProps {
    fields: PdfField[];
    rowId: string;
    isExpanded: boolean;
    badgeClassName?: string;
    onToggleExpand: (rowId: string) => void;
}

export function PdfFieldsList({
    fields,
    rowId,
    isExpanded,
    badgeClassName = "text-xs",
    onToggleExpand,
}: PdfFieldsListProps) {
    if (fields.length === 0) return <div>No fields</div>;

    const displayLimit = isExpanded ? fields.length : 2;
    const hasMore = fields.length > displayLimit && !isExpanded;

    return (
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1 max-w-sm">
                {fields.slice(0, displayLimit).map((field, index) => (
                    <Badge
                        key={index}
                        variant="field"
                        className={badgeClassName}
                    >
                        {field.field_name}
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
                                    +{fields.length - displayLimit} more
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="gap-1 flex flex-wrap max-w-xs">
                                    {fields
                                        .slice(displayLimit)
                                        .map((field, index) => (
                                            <Badge
                                                key={index}
                                                variant="field"
                                                className={badgeClassName}
                                            >
                                                {field.field_name}
                                            </Badge>
                                        ))}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {isExpanded && fields.length > 2 && (
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
