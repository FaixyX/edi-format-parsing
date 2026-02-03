"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

interface SuccessMessageProps {
    message: string;
    className?: string;
}

export function SuccessMessage({ message, className }: SuccessMessageProps) {
    return (
        <Alert variant="success" className={className}>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
                {message}
            </AlertDescription>
        </Alert>
    );
}
