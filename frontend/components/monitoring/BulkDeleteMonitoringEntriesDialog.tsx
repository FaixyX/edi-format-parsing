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

interface BulkDeleteMonitoringEntriesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    count: number;
    isLoading?: boolean;
}

export function BulkDeleteMonitoringEntriesDialog({
    isOpen,
    onClose,
    onConfirm,
    count,
    isLoading = false,
}: BulkDeleteMonitoringEntriesDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete Multiple Monitoring Entries
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete <strong>{count}</strong>{" "}
                        monitoring
                        {count === 1 ? " entry" : " entries"}?
                        <br />
                        <br />
                        This will permanently remove all selected tasks and
                        their related data, including EDI files and validation
                        results.
                        <br />
                        <br />
                        <strong>This action cannot be undone.</strong>
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
                        Delete {count} {count === 1 ? "Entry" : "Entries"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
