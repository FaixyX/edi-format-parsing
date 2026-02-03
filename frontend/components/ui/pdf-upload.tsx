"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PDFUploadProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
    label?: string;
    description?: string;
    className?: string;
    disabled?: boolean;
}

export function PDFUpload({
    onFileSelect,
    selectedFile,
    label = "PDF Attachment *",
    description = "Upload a PDF file to attach to your submission (required)",
    className,
    disabled = false,
}: PDFUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const validateFile = (file: File): boolean => {
        // Check file type
        if (!file.type.includes("pdf")) {
            toast.error("Invalid file type", {
                description: "Please upload a PDF file (.pdf)",
            });
            return false;
        }

        // Check file size (30MB limit)
        const maxSize = 30 * 1024 * 1024; // 30MB
        if (file.size > maxSize) {
            toast.error("File too large", {
                description: "Please upload a file smaller than 30MB",
            });
            return false;
        }

        return true;
    };

    const handleFileSelect = useCallback(
        (file: File) => {
            if (validateFile(file)) {
                setIsUploading(true);
                // Simulate upload delay
                setTimeout(() => {
                    onFileSelect(file);
                    setIsUploading(false);
                    toast.success("PDF uploaded successfully");
                }, 1000);
            }
        },
        [onFileSelect]
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);

            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileSelect(file);
            }
        },
        [handleFileSelect]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileSelect(file);
            }
        },
        [handleFileSelect]
    );

    const removeFile = useCallback(() => {
        onFileSelect(null);
        toast.success("PDF removed");
    }, [onFileSelect]);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <div className={cn("space-y-4", className)}>
            <div>
                <Label className="text-base font-medium text-foreground">
                    {label}
                </Label>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
            </div>

            {selectedFile ? (
                <div className="border rounded-lg p-4 bg-muted/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">
                                    {selectedFile.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(selectedFile.size)}
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                            disabled={disabled}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div
                    className={cn(
                        "border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
                        isDragging
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-primary/50",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (!disabled) setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => {
                        if (!disabled) {
                            document.getElementById("pdf-upload")?.click();
                        }
                    }}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onKeyDown={(e) => {
                        if (!disabled && (e.key === "Enter" || e.key === " ")) {
                            document.getElementById("pdf-upload")?.click();
                        }
                    }}
                >
                    <div className="flex flex-col items-center justify-center space-y-3">
                        {isUploading ? (
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        ) : (
                            <Upload className="h-8 w-8 text-muted-foreground" />
                        )}
                        <div className="text-center">
                            <p className="font-medium">
                                {isUploading
                                    ? "Uploading PDF..."
                                    : "Drop your PDF here"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                or click to browse
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Maximum file size: 30MB
                            </p>
                        </div>
                    </div>

                    <Input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileInput}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}
