"use client";

import { useState, useCallback, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Upload,
    FileText,
    X,
    AlertCircle,
    CheckCircle2,
    Loader2,
    XCircle,
    Trash2,
    RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { myFetch } from "@/lib/api";
import {
    useBillingFiles277Store,
    type UploadResult277,
} from "@/stores/billingFiles277Store";
import {
    retryMonitoringEntry,
    deleteMonitoringEntry,
} from "@/services/monitoringApi";

interface UploadResponse277 {
    total_files: number;
    successful: number;
    failed: number;
    results: UploadResult277[];
    task_ids: string[];
}

export default function Format2BillingFilesPage() {
    const {
        selectedFiles,
        uploadResults,
        setSelectedFiles,
        addSelectedFiles,
        removeSelectedFile,
        clearSelectedFiles,
        setUploadResults,
        addUploadResults,
        removeUploadResult,
        clearUploadResults,
        storeFailedFile,
        getFailedFile,
        removeFailedFile,
        clearAll,
    } = useBillingFiles277Store();

    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [retryingIndex, setRetryingIndex] = useState<number | null>(null);
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

    // Load persisted results on mount and validate they still exist
    // NOTE: Auto-cleanup removed - files should only be removed when:
    // 1. User explicitly deletes them from the upload page
    // 2. Tasks are deleted from the dashboard (handled by handleDelete checking for 404)

    const validateFile = (file: File): string | null => {
        // Check file extension
        const validExtensions = [".edi", ".txt"];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = validExtensions.some((ext) =>
            fileName.endsWith(ext)
        );

        if (!hasValidExtension) {
            return `Invalid file type. Only .edi and .txt files are allowed.`;
        }

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return `File too large. Maximum size is 10MB.`;
        }

        // Check if file is empty
        if (file.size === 0) {
            return `File is empty.`;
        }

        return null;
    };

    const addFiles = useCallback(
        (files: File[]) => {
            const errors: string[] = [];
            const validFiles: File[] = [];

            files.forEach((file) => {
                const error = validateFile(file);
                if (error) {
                    errors.push(`${file.name}: ${error}`);
                } else {
                    // Check for duplicates
                    const isDuplicate = selectedFiles.some(
                        (f) => f.name === file.name && f.size === file.size
                    );
                    if (!isDuplicate) {
                        validFiles.push(file);
                    } else {
                        errors.push(`${file.name}: File already selected`);
                    }
                }
            });

            if (errors.length > 0) {
                toast.error("Some files were not added", {
                    description: errors.join("\n"),
                });
            }

            if (validFiles.length > 0) {
                toast.success(`${validFiles.length} file(s) added`);
                addSelectedFiles(validFiles);
            }
        },
        [selectedFiles, addSelectedFiles]
    );

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            addFiles(Array.from(files));
        }
        // Reset input value to allow selecting the same file again
        event.target.value = "";
    };

    const removeFile = (index: number) => {
        removeSelectedFile(index);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);

            const files = Array.from(e.dataTransfer.files);
            addFiles(files);
        },
        [addFiles]
    );

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast.error("Please select at least one file");
            return;
        }

        setIsUploading(true);
        // Clear previous upload results before new upload
        clearUploadResults();
        // Clear selected files when upload starts
        const filesToUpload = [...selectedFiles];
        clearSelectedFiles();

        try {
            const formData = new FormData();
            filesToUpload.forEach((file) => {
                formData.append("files", file);
            });

            const response = await myFetch("POST", "billing-files-277/upload", {
                withCredentials: true,
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const detail = errorData.detail;
                const message =
                    typeof detail === "object" && detail?.error
                        ? detail.error
                        : typeof detail === "string"
                          ? detail
                          : `Server error: ${response.status}`;
                const suggestion =
                    typeof detail === "object" && detail?.suggestion
                        ? detail.suggestion
                        : undefined;
                toast.error(message, { description: suggestion });
                throw new Error(message);
            }

            const data: UploadResponse277 = await response.json();

            // Store failed files for retry
            data.results.forEach((result, index) => {
                if (!result.success && filesToUpload[index]) {
                    storeFailedFile(filesToUpload[index]);
                }
            });

            // Add results to store (merge with existing)
            addUploadResults(data.results);

            if (data.successful > 0 && data.failed === 0) {
                toast.success(
                    `Successfully uploaded ${data.successful} 277 file(s)`,
                    {
                        description: `${data.task_ids.length} task(s) created`,
                    }
                );
            } else if (data.successful > 0 && data.failed > 0) {
                toast.warning(
                    `Uploaded ${data.successful} of ${data.total_files} file(s)`,
                    {
                        description: `${data.failed} file(s) failed. See details below.`,
                    }
                );
            } else {
                toast.error(`Failed to upload all files`, {
                    description: `${data.failed} file(s) failed. See details below.`,
                });
            }
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload files", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Network error. Please check if the server is running.",
            });
            // Restore files on error
            setSelectedFiles(filesToUpload);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRetry = async (result: UploadResult277, index: number) => {
        setRetryingIndex(index);

        try {
            if (result.task_id) {
                // Task exists, use retry endpoint
                await retryMonitoringEntry(result.task_id);
                toast.success("Task retry initiated", {
                    description: `Task ${result.task_id} has been queued for retry`,
                });
                // Update result to show it's being retried
                const updatedResults = [...uploadResults];
                updatedResults[index] = {
                    ...result,
                    success: true, // Mark as success since retry was initiated
                };
                setUploadResults(updatedResults);
            } else {
                // No task_id, re-upload the file
                const file = getFailedFile(result.filename);
                if (!file) {
                    toast.error("File not found", {
                        description:
                            "The file is no longer available for retry. Please select it again.",
                    });
                    return;
                }

                const formData = new FormData();
                formData.append("files", file);

                const response = await myFetch(
                    "POST",
                    "billing-files-277/upload",
                    {
                        withCredentials: true,
                        body: formData,
                    }
                );

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(
                        errorData.detail?.error ||
                            errorData.detail ||
                            `Server error: ${response.status}`
                    );
                }

                const data: UploadResponse277 = await response.json();

                if (data.results.length > 0) {
                    const retryResult = data.results[0];

                    if (retryResult.success) {
                        toast.success("File re-uploaded successfully", {
                            description: retryResult.task_id
                                ? `Task ${retryResult.task_id} created`
                                : "File processed successfully",
                        });
                        // Remove from failed files
                        removeFailedFile(result.filename);
                        // Update result
                        const updatedResults = [...uploadResults];
                        updatedResults[index] = retryResult;
                        setUploadResults(updatedResults);
                    } else {
                        toast.error("Retry failed", {
                            description: retryResult.error || "Unknown error",
                        });
                        // Update error message
                        const updatedResults = [...uploadResults];
                        updatedResults[index] = {
                            ...result,
                            error: retryResult.error || result.error,
                        };
                        setUploadResults(updatedResults);
                    }
                }
            }
        } catch (error) {
            console.error("Retry error:", error);
            toast.error("Failed to retry", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Network error. Please try again.",
            });
        } finally {
            setRetryingIndex(null);
        }
    };

    const handleDelete = async (result: UploadResult277, index: number) => {
        setDeletingIndex(index);

        try {
            if (result.task_id) {
                // Task exists, delete it
                try {
                    await deleteMonitoringEntry(result.task_id);
                    toast.success("Task deleted successfully");
                } catch (error: any) {
                    // If task not found (404), it was already deleted elsewhere
                    // Still remove from upload page to keep UI in sync
                    if (error?.message?.includes("not found") || error?.message?.includes("404")) {
                        toast.info("Task already deleted", {
                            description: "Removing from upload results"
                        });
                    } else {
                        // Re-throw other errors
                        throw error;
                    }
                }
            }

            // Remove from results (even if task was already deleted)
            removeUploadResult(index);

            // Remove from failed files if it exists
            if (!result.success) {
                removeFailedFile(result.filename);
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Network error. Please try again.",
            });
        } finally {
            setDeletingIndex(null);
        }
    };

    const clearResults = () => {
        clearUploadResults();
        // Also clear failed files
        uploadResults.forEach((result) => {
            if (!result.success) {
                removeFailedFile(result.filename);
            }
        });
    };

    const retryAllFailed = async () => {
        // Get fresh state from store
        const storeState = useBillingFiles277Store.getState();
        const snapshot = [...storeState.uploadResults];
        const failedResults = snapshot.filter((r) => !r.success);

        console.log("retryAllFailed - failedResults:", failedResults);

        if (failedResults.length === 0) {
            toast.info("No failed tasks to retry");
            return;
        }

        // Separate results into two groups:
        // 1. Files without task_id (failed uploads) - can be batched together
        // 2. Tasks with task_id (existing tasks) - need individual retry calls
        const filesToReupload = failedResults.filter((r) => !r.task_id);
        const tasksToRetry = failedResults.filter((r) => r.task_id);

        console.log("Files to reupload:", filesToReupload.length);
        console.log("Tasks to retry:", tasksToRetry.length);

        let successCount = 0;
        let failCount = 0;

        // Batch upload files without task_id (more efficient - single API call)
        if (filesToReupload.length > 0) {
            try {
                const files: File[] = [];
                const fileResultMap = new Map<string, UploadResult277>();

                // Get fresh state to check for files
                const currentStoreState = useBillingFiles277Store.getState();
                console.log(
                    "Current failed files in store:",
                    Array.from(currentStoreState.failedFiles.keys())
                );

                for (const result of filesToReupload) {
                    // Use the hook's getFailedFile function
                    const file = getFailedFile(result.filename);
                    console.log(
                        `Looking for file: ${result.filename}, found:`,
                        !!file
                    );
                    if (file) {
                        files.push(file);
                        fileResultMap.set(result.filename, result);
                        console.log(`Found file for retry: ${result.filename}`);
                    } else {
                        console.warn(
                            `File not found in store: ${result.filename}`
                        );
                        console.warn(
                            "Available files:",
                            Array.from(currentStoreState.failedFiles.keys())
                        );
                        failCount++;
                    }
                }

                if (files.length === 0) {
                    console.error(
                        "No files found to retry. All files may have been lost from memory."
                    );
                    toast.error("No files available for retry", {
                        description:
                            "Files are no longer in memory. Please select them again.",
                    });
                    failCount += filesToReupload.length;
                } else if (files.length > 0) {
                    console.log(`Batch uploading ${files.length} files...`);
                    const formData = new FormData();
                    files.forEach((file) => {
                        formData.append("files", file);
                    });

                    const response = await myFetch(
                        "POST",
                        "billing-files-277/upload",
                        {
                            withCredentials: true,
                            body: formData,
                        }
                    );

                    if (!response.ok) {
                        const errorData = await response
                            .json()
                            .catch(() => ({}));
                        const errorMessage =
                            errorData.detail ||
                            `Server error: ${response.status}`;
                        console.error("Upload failed:", errorMessage);
                        throw new Error(errorMessage);
                    }

                    const data: UploadResponse277 = await response.json();
                    console.log("Batch upload response:", data);
                    console.log(
                        "Upload results details:",
                        data.results.map((r) => ({
                            filename: r.filename,
                            success: r.success,
                            error: r.error,
                        }))
                    );

                    // Get fresh state before updating
                    const freshState = useBillingFiles277Store.getState();
                    const currentResults = [...freshState.uploadResults];
                    console.log(
                        "Current results in store:",
                        currentResults.map((r) => ({
                            filename: r.filename,
                            success: r.success,
                        }))
                    );

                    data.results.forEach((retryResult) => {
                        const originalResult = fileResultMap.get(
                            retryResult.filename
                        );
                        console.log(
                            `Processing retry result for ${retryResult.filename}:`,
                            {
                                success: retryResult.success,
                                error: retryResult.error,
                                hasOriginalResult: !!originalResult,
                            }
                        );

                        if (originalResult) {
                            const index = currentResults.findIndex(
                                (r) => r.filename === retryResult.filename
                            );
                            if (index !== -1) {
                                if (retryResult.success) {
                                    successCount++;
                                    console.log(
                                        `✓ Successfully retried: ${retryResult.filename}`
                                    );
                                    // Use the hook's removeFailedFile function
                                    removeFailedFile(retryResult.filename);
                                    currentResults[index] = retryResult;
                                } else {
                                    failCount++;
                                    console.log(
                                        `✗ Failed to retry: ${retryResult.filename}, error: ${retryResult.error}`
                                    );
                                    currentResults[index] = {
                                        ...originalResult,
                                        error:
                                            retryResult.error ||
                                            originalResult.error,
                                    };
                                }
                            } else {
                                console.warn(
                                    `Result not found in current results: ${retryResult.filename}`
                                );
                                // Still count failures even if index not found
                                if (!retryResult.success) {
                                    failCount++;
                                }
                            }
                        } else {
                            console.warn(
                                `Original result not found in map: ${retryResult.filename}`
                            );
                            // Still count failures even if original result not found
                            if (!retryResult.success) {
                                failCount++;
                            }
                        }
                    });

                    console.log(
                        `After processing results - Success: ${successCount}, Failed: ${failCount}`
                    );

                    setUploadResults(currentResults);
                }
            } catch (error) {
                console.error("Error batch retrying files:", error);
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Unknown error occurred";
                toast.error("Failed to batch retry files", {
                    description: errorMessage,
                });
                failCount += filesToReupload.length;
            }
        }

        // Retry tasks with task_id individually (they need separate API calls per task)
        if (tasksToRetry.length > 0) {
            console.log(
                `Retrying ${tasksToRetry.length} tasks with task_id...`
            );
            for (const result of tasksToRetry) {
                try {
                    console.log(
                        `Retrying task ${result.task_id} for file ${result.filename}`
                    );
                    await retryMonitoringEntry(result.task_id!);
                    successCount++;

                    // Get fresh state before updating
                    const freshState = useBillingFiles277Store.getState();
                    const currentResults = [...freshState.uploadResults];
                    const index = currentResults.findIndex(
                        (r) => r.filename === result.filename
                    );
                    if (index !== -1) {
                        currentResults[index] = {
                            ...result,
                            success: true, // Mark as success since retry was initiated
                        };
                        setUploadResults(currentResults);
                    }
                } catch (error) {
                    console.error(
                        `Error retrying task ${result.task_id}:`,
                        error
                    );
                    toast.error(`Failed to retry task ${result.task_id}`, {
                        description:
                            error instanceof Error
                                ? error.message
                                : "Unknown error occurred",
                    });
                    failCount++;
                }
            }
        }

        // Show summary
        console.log(
            `Retry complete - Success: ${successCount}, Failed: ${failCount}`
        );
        const totalRetried = successCount + failCount;

        if (successCount > 0 && failCount === 0) {
            toast.success(`Retry initiated for ${successCount} failed task(s)`);
        } else if (successCount > 0 && failCount > 0) {
            toast.warning(
                `Retry initiated for ${successCount} task(s), ${failCount} failed again`
            );
        } else if (failCount > 0) {
            // All retries failed - but they were attempted
            toast.error(`All ${failCount} file(s) failed again on retry`, {
                description:
                    "Files were retried but still failed. Please check the error messages and fix the issues (e.g., add missing agencies).",
            });
        } else {
            toast.error("No tasks were retried");
        }
    };

    return (
        <div className="space-y-6">
            <Card className="p-0 m-0">
                <CardHeader>
                    <CardTitle>Upload 277 EDI Files</CardTitle>
                    <CardDescription>
                        Upload X12 EDI 277 response files (.edi or .txt). Each
                        file is parsed and stored as a task.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Upload Area */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                            isDragging
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-primary/50"
                        } ${
                            isUploading
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => {
                            if (!isUploading) {
                                document.getElementById("file-upload")?.click();
                            }
                        }}
                        role="button"
                        tabIndex={isUploading ? -1 : 0}
                        onKeyDown={(e) => {
                            if (
                                !isUploading &&
                                (e.key === "Enter" || e.key === " ")
                            ) {
                                document.getElementById("file-upload")?.click();
                            }
                        }}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            multiple
                            accept=".edi,.txt"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                        />
                        <div className="flex flex-col items-center justify-center space-y-3">
                            {isUploading ? (
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            ) : (
                                <Upload
                                    className={`h-8 w-8 ${
                                        isDragging
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                    }`}
                                />
                            )}
                            <div className="text-center">
                                <p className="font-medium">
                                    {isUploading
                                        ? "Uploading files..."
                                        : "Drop your files here"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    or click to browse
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    EDI X12 277 files (.edi or .txt) • Max 10MB
                                    per file
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Info Alert */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Each 277 file must contain a valid NPI. The system
                            will match files to agencies by NPI and parse claim
                            status information.
                        </AlertDescription>
                    </Alert>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">
                                    Selected Files ({selectedFiles.length})
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSelectedFiles}
                                    disabled={isUploading}
                                >
                                    Clear All
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                                {selectedFiles.map((file, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                                    >
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {(file.size / 1024).toFixed(
                                                        2
                                                    )}{" "}
                                                    KB
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeFile(index)}
                                            disabled={isUploading}
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Button */}
                    {selectedFiles.length > 0 && (
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="outline"
                                onClick={clearSelectedFiles}
                                disabled={isUploading}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload {selectedFiles.length} File(s)
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Upload Results */}
            {uploadResults && uploadResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Upload Results</CardTitle>
                                <CardDescription>
                                    {
                                        uploadResults.filter((r) => r.success)
                                            .length
                                    }{" "}
                                    successful,{" "}
                                    {
                                        uploadResults.filter((r) => !r.success)
                                            .length
                                    }{" "}
                                    failed
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {uploadResults.filter((r) => !r.success)
                                    .length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={retryAllFailed}
                                        disabled={
                                            retryingIndex !== null ||
                                            deletingIndex !== null
                                        }
                                    >
                                        <RotateCw className="mr-2 h-4 w-4" />
                                        Retry Failed Tasks
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearResults}
                                >
                                    Clear Results
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {uploadResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-lg border ${
                                        result.success
                                            ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                                            : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                                    }`}
                                >
                                    <div className="flex items-start space-x-3">
                                        {result.success ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                        )}
                                        <div className="flex-1 space-y-1">
                                            <p className="text-sm font-medium">
                                                {result.filename}
                                            </p>
                                            {result.success ? (
                                                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                                                    <p>
                                                        ✓ Agency:{" "}
                                                        {result.agency_name}
                                                    </p>
                                                    <p>✓ NPI: {result.npi}</p>
                                                    <p>
                                                        ✓ Task ID:{" "}
                                                        {result.task_id}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-red-600 dark:text-red-400">
                                                    {result.error}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            {!result.success && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleRetry(
                                                            result,
                                                            index
                                                        )
                                                    }
                                                    disabled={
                                                        retryingIndex ===
                                                            index ||
                                                        deletingIndex === index
                                                    }
                                                >
                                                    {retryingIndex === index ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <RotateCw className="mr-2 h-4 w-4" />
                                                            Retry
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    handleDelete(result, index)
                                                }
                                                disabled={
                                                    retryingIndex === index ||
                                                    deletingIndex === index
                                                }
                                            >
                                                {deletingIndex === index ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
