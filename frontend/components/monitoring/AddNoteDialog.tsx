import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { StickyNote } from "lucide-react";

interface AddNoteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: string) => Promise<boolean>;
    currentNote?: string;
    taskId: string;
    pdfFilename?: string;
    isLoading?: boolean;
}

export function AddNoteDialog({
    isOpen,
    onClose,
    onSave,
    currentNote = "",
    taskId,
    pdfFilename,
    isLoading = false,
}: AddNoteDialogProps) {
    const [note, setNote] = useState(currentNote);

    // Update local state when currentNote changes
    useEffect(() => {
        setNote(currentNote);
    }, [currentNote]);

    const handleSave = async () => {
        const success = await onSave(note.trim());
        if (success) {
            onClose();
        }
    };

    const handleClose = () => {
        setNote(currentNote); // Reset to original note
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <StickyNote className="h-5 w-5" />
                        {currentNote ? "Edit Note" : "Add Note"}
                    </DialogTitle>
                    <DialogDescription>
                        Add or update a note for this task. This note will be
                        visible to all users.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <div className="text-sm">
                            <span className="text-muted-foreground">
                                Task ID:
                            </span>{" "}
                            <span className="font-mono">
                                {taskId.substring(0, 8)}...
                            </span>
                        </div>
                        {pdfFilename && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">
                                    File:
                                </span>{" "}
                                <span className="font-medium">
                                    {pdfFilename}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="note"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Note
                        </label>
                        <Textarea
                            id="note"
                            placeholder="Enter your note here..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="min-h-[120px] resize-none"
                            disabled={isLoading}
                        />
                        <p className="text-xs text-muted-foreground">
                            {note.length} / 500 characters
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading || note.length > 500}
                    >
                        {isLoading ? "Saving..." : "Save Note"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
