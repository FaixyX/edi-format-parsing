"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface TechnicalErrorDialogProps {
    isOpen: boolean;
    onClose: () => void;
    technicalDetails: any;
    isLoading?: boolean;
}

export function TechnicalErrorDialog({
    isOpen,
    onClose,
    technicalDetails,
    isLoading = false,
}: TechnicalErrorDialogProps) {
    const technicalMessage = isLoading
        ? "Loading technical error details..."
        : technicalDetails 
        ? JSON.stringify(technicalDetails, null, 2)
        : "No technical error details available. The error may not have been captured with full details.";

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Technical Error Details</DialogTitle>
                </DialogHeader>

                <div className="border rounded-md mt-4">
                    <div className="p-4 overflow-auto max-h-[60vh]">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                    <span className="text-sm text-muted-foreground">
                                        Loading error details...
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                                {technicalMessage}
                            </pre>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
