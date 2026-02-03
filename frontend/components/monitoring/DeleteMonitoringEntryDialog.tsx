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
import { Loader2 } from "lucide-react";

interface DeleteMonitoringEntryDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    taskId: string;
    pdfFilename: string;
    isLoading?: boolean;
}

export function DeleteMonitoringEntryDialog({
    isOpen,
    onClose,
    onConfirm,
    taskId,
    pdfFilename,
    isLoading = false,
}: DeleteMonitoringEntryDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Monitoring Entry</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete this monitoring entry?
                        This will permanently remove the task and all related
                        data, including the EDI file and validation results.
                        <br />
                        <br />
                        <strong>Task ID:</strong> {taskId.substring(0, 8)}...
                        <br />
                        <strong>File:</strong> {pdfFilename}
                        <br />
                        <br />
                        This action cannot be undone.
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
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Delete Entry
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
