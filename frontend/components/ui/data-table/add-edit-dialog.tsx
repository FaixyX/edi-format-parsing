import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddEditDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    title: string;
    isSubmitting?: boolean;
    submitText?: string;
    loadingText?: string;
    children?: React.ReactNode;
}

export function AddEditDialog({
    isOpen,
    onClose,
    onSubmit,
    title,
    isSubmitting = false,
    submitText = "Save",
    loadingText = "Saving...",
    children,
}: AddEditDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">{children}</div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        isLoading={isSubmitting}
                        loadingText={loadingText}
                        onClick={onSubmit}
                    >
                        {submitText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
