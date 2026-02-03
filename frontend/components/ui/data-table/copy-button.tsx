import * as React from "react";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
    text: string;
    tooltipText?: string;
    className?: string;
}

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
    ({ text, tooltipText = "Copy to clipboard", className, ...props }, ref) => {
        const [copied, setCopied] = useState(false);

        const copyToClipboard = () => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        };

        return (
            <TooltipButton
                variant="ghost"
                size="icon"
                onClick={copyToClipboard}
                tooltipText={tooltipText}
                className={cn(copied && "ring-1 ring-green-600", className)}
                ref={ref}
                {...props}
            >
                {copied ? <Check className="text-green-600" /> : <Copy />}
            </TooltipButton>
        );
    }
);
CopyButton.displayName = "CopyButton";

export { CopyButton };
