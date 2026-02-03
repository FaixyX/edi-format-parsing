// import { CopyButton } from "./copy-button";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinkCellProps {
    href: string;
    maxWidth?: string;
    variant?: "text" | "icon";
}
export function LinkCell({
    href,
    maxWidth = "150px",
    variant = "text",
}: LinkCellProps) {
    const isEmpty = !href || href.trim() === "";

    if (isEmpty) {
        return <div className="text-muted-foreground">-</div>;
    }

    if (variant === "icon") {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                    window.open(href, "_blank", "noopener,noreferrer")
                }
                className="h-8 w-8 p-0 hover:bg-blue-500/25 hover:text-blue-700"
            >
                <ExternalLink className="h-4 w-4" />
            </Button>
        );
    }

    return (
        <div className="flex items-center gap-4 justify-center">
            <div className="flex items-center gap-2 justify-center">
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ maxWidth }}
                    className="hover:underline truncate text-blue-600 dark:text-blue-300"
                >
                    <ExternalLink className="h-4 w-4 inline-block mr-1 " />
                    {href}
                </a>
            </div>
            {/* <CopyButton text={href} /> */}
        </div>
    );
}
