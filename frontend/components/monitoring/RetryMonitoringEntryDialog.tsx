import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RetryMonitoringEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    taskId: string;
    pdfFilename: string;
    isLoading?: boolean;
}

export function RetryMonitoringEntryDialog({
    isOpen,
    onClose,
    onConfirm,
    taskId,
    pdfFilename,
    isLoading = false,
}: RetryMonitoringEntryDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <RotateCw className="h-5 w-5 text-blue-600" />
                        Retry Task Processing
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to retry this task? This will
                        create a new background task using the same form
                        submission data and queue it for processing.
                        <br />
                        <br />
                        <strong>Task ID:</strong> {taskId.substring(0, 8)}...
                        <br />
                        <strong>PDF File:</strong> {pdfFilename}
                        <br />
                        <br />
                        The new task will be processed independently and may
                        succeed even if the original failed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>
                        Cancel
                    </AlertDialogCancel>

                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <RotateCw
                            className={cn(
                                "h-4 w-4",
                                isLoading && "animate-spin"
                            )}
                        />
                        {isLoading ? "Retrying ..." : "Retry Task"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
