"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CopyableTextProps {
    text: string;
    displayText?: string;
    className?: string;
}

export function CopyableText({
    text,
    displayText,
    className,
}: CopyableTextProps) {
    const [copied, setCopied] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const textToDisplay = displayText || text;

    const copyToClipboard = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TooltipProvider>
            <Tooltip open={isOpen || copied}>
                <TooltipTrigger asChild>
                    <span
                        onClick={copyToClipboard}
                        onMouseEnter={() => setIsOpen(true)}
                        onMouseLeave={() => setIsOpen(false)}
                        className={cn(
                            "cursor-pointer transition-colors duration-200 ",
                            copied
                                ? "text-green-500 hover:text-green-600"
                                : "hover:text-primary",
                            className
                        )}
                    >
                        {textToDisplay}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{copied ? "Copied!" : "Click to copy"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
