import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReactNode } from "react";

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    titleClassName?: string;
}

export function CollapsibleSection({
    title,
    children,
    isOpen,
    onOpenChange,
    titleClassName = "text-primary",
}: CollapsibleSectionProps) {
    return (
        <Collapsible
            open={isOpen}
            onOpenChange={onOpenChange}
            className="space-y-4"
        >
            <CollapsibleTrigger asChild>
                <Button variant="ghost"  className="w-full">
                    <div
                        className={`flex items-center justify-between w-full ${titleClassName}`}
                    >
                        <h3 className="text-lg font-medium">{title}</h3>
                        <ChevronsUpDown className="h-4 w-4" />
                        <span className="sr-only">Toggle {title}</span>
                    </div>
                </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}
