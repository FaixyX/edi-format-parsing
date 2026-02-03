import * as React from "react";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { myFetch } from "@/lib/api";
interface DownloadButtonProps {
    taskId: string;
    filename: string;
    tooltipText?: string;
    className?: string;
}

const DownloadButton = React.forwardRef<HTMLButtonElement, DownloadButtonProps>(
    (
        {
            taskId,
            filename,
            tooltipText = "Download file",
            className,
            ...props
        },
        ref
    ) => {
        const [isDownloading, setIsDownloading] = useState(false);

        const handleDownload = async () => {
            setIsDownloading(true);

            try {
                console.log(
                    "Starting download for task:",
                    taskId,
                    "filename:",
                    filename
                );

                // Fetch with authentication using myFetch helper
                const response = await myFetch(
                    "GET",
                    `monitoring/${taskId}/pdf`,
                    {
                        withCredentials: true,
                    }
                );

                if (!response.ok) {
                    throw new Error(`Download failed: ${response.statusText}`);
                }

                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                // Create a direct download link
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = filename;
                a.style.display = "none";

                document.body.appendChild(a);
                console.log("Triggering download...");
                a.click();

                // Cleanup
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                console.log("Download triggered successfully");

                // Show success toast
                toast.success("File download started successfully");
            } catch (error) {
                console.error("Download error:", error);
                toast.error(
                    `Failed to start download: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`
                );
            } finally {
                setIsDownloading(false);
            }
        };

        return (
            <TooltipButton
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                tooltipText={tooltipText}
                className={cn(className)}
                ref={ref}
                disabled={isDownloading}
                {...props}
            >
                {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Download className="h-4 w-4" />
                )}
            </TooltipButton>
        );
    }
);
DownloadButton.displayName = "DownloadButton";

export { DownloadButton };
