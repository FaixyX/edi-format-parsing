"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Settings, Info, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
    getEdiBillingConfiguration,
    bulkUpdateEdiBillingConfiguration,
} from "@/services/systemConfigurationApi";
import {
    getGoogleAccountStatus,
    initiateGoogleOAuth,
    unlinkGoogleAccount,
} from "@/services/googleAccountApi";
import { getUserRoleFromToken } from "@/lib/auth";

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
    const queryClient = useQueryClient();
    const [ediBillingMaxRetries, setEdiBillingMaxRetries] = useState<number>(3);
    const [ediBillingDelay, setEdiBillingDelay] = useState<number>(0);
    const isAdmin = getUserRoleFromToken() === "Admin";

    // Fetch EDI billing configuration
    const { data: ediBillingConfig, isLoading: isLoadingEdiBillingConfig } =
        useQuery({
            queryKey: ["ediBillingConfiguration"],
            queryFn: getEdiBillingConfiguration,
            enabled: isOpen,
        });

    // Fetch Google account status (admin only)
    const {
        data: googleAccountStatus,
        isLoading: isLoadingGoogleAccount,
        refetch: refetchGoogleAccount,
    } = useQuery({
        queryKey: ["googleAccountStatus"],
        queryFn: getGoogleAccountStatus,
        enabled: isOpen && isAdmin,
    });

    // Handle OAuth callback from URL params (works on any page, not just when dialog is open)
    useEffect(() => {
        if (!isAdmin) return;

        const urlParams = new URLSearchParams(window.location.search);
        const oauthStatus = urlParams.get("google_oauth");

        if (oauthStatus === "success") {
            const email = urlParams.get("email");
            toast.success(`Google account linked successfully: ${email}`);
            refetchGoogleAccount();
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
        } else if (oauthStatus === "error") {
            const error =
                urlParams.get("error") || "Failed to link Google account";
            toast.error(error);
            // Clean URL
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [isAdmin, refetchGoogleAccount]);

    // Unlink Google account mutation
    const unlinkGoogleAccountMutation = useMutation({
        mutationFn: unlinkGoogleAccount,
        onSuccess: () => {
            toast.success("Google account unlinked successfully");
            queryClient.invalidateQueries({
                queryKey: ["googleAccountStatus"],
            });
        },
        onError: (error: any) => {
            toast.error(
                error?.response?.data?.detail ||
                    "Failed to unlink Google account"
            );
        },
    });

    // Note: Token refresh happens automatically when needed via get_valid_credentials()

    // Update local state when data is fetched
    useEffect(() => {
        if (ediBillingConfig) {
            setEdiBillingMaxRetries(ediBillingConfig.edi_billing_max_retries);
            setEdiBillingDelay(ediBillingConfig.edi_billing_delay_seconds);
        }
    }, [ediBillingConfig]);

    // Bulk update EDI billing configuration mutation
    const bulkUpdateEdiBillingConfigMutation = useMutation({
        mutationFn: (bulkUpdate: {
            max_retries?: number;
            delay_seconds?: number;
        }) =>
            bulkUpdateEdiBillingConfiguration(
                bulkUpdate.max_retries,
                bulkUpdate.delay_seconds
            ),
        onSuccess: (data) => {
            const updatedFields = data.updated_fields;
            const fieldNames = {
                edi_billing_max_retries: "EDI billing max retries",
                edi_billing_delay_seconds: "EDI billing delay",
            };

            if (updatedFields.length === 1) {
                toast.success(
                    `${
                        fieldNames[updatedFields[0] as keyof typeof fieldNames]
                    } updated successfully`
                );
            } else if (updatedFields.length > 1) {
                toast.success(
                    `Updated ${updatedFields.length} EDI billing settings successfully`
                );
            }

            queryClient.invalidateQueries({
                queryKey: ["ediBillingConfiguration"],
            });
        },
        onError: (error: any) => {
            console.error(
                "Error bulk updating EDI billing configuration:",
                error
            );
            toast.error(
                error?.response?.data?.detail ||
                    "Failed to update EDI billing configuration"
            );
        },
    });

    const handleSave = () => {
        if (ediBillingMaxRetries < 1 || ediBillingMaxRetries > 10) {
            toast.error("EDI billing max retries must be between 1 and 10");
            return;
        }

        if (ediBillingDelay < 0 || ediBillingDelay > 3600) {
            toast.error("EDI billing delay must be between 0 and 3600 seconds");
            return;
        }

        // Prepare EDI billing bulk update object with only changed values
        const ediBillingBulkUpdate: {
            max_retries?: number;
            delay_seconds?: number;
        } = {};

        // Add EDI billing max retries if changed
        if (
            ediBillingConfig &&
            ediBillingMaxRetries !== ediBillingConfig.edi_billing_max_retries
        ) {
            ediBillingBulkUpdate.max_retries = ediBillingMaxRetries;
        }

        // Add EDI billing delay if changed
        if (
            ediBillingConfig &&
            ediBillingDelay !== ediBillingConfig.edi_billing_delay_seconds
        ) {
            ediBillingBulkUpdate.delay_seconds = ediBillingDelay;
        }

        // Make API call if there are changes
        const hasEdiBillingChanges =
            Object.keys(ediBillingBulkUpdate).length > 0;

        if (hasEdiBillingChanges) {
            bulkUpdateEdiBillingConfigMutation.mutate(ediBillingBulkUpdate);
        } else {
            toast.info("No changes to save");
        }
    };

    const handleClose = () => {
        // Reset form if there are unsaved changes
        if (ediBillingConfig) {
            setEdiBillingMaxRetries(ediBillingConfig.edi_billing_max_retries);
            setEdiBillingDelay(ediBillingConfig.edi_billing_delay_seconds);
        }
        onClose();
    };

    const hasUnsavedChanges =
        (ediBillingConfig &&
            ediBillingMaxRetries !==
                ediBillingConfig.edi_billing_max_retries) ||
        (ediBillingConfig &&
            ediBillingDelay !== ediBillingConfig.edi_billing_delay_seconds);

    const formatDelay = (seconds: number): string => {
        if (seconds === 0) {
            return "No delay";
        }
        if (seconds < 60) {
            return `${seconds} second${seconds !== 1 ? "s" : ""}`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (remainingSeconds === 0) {
            return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
        }
        return `${minutes}m ${remainingSeconds}s`;
    };

    return (
        <TooltipProvider delayDuration={0}>
            <Dialog
                open={isOpen}
                onOpenChange={(open) => !open && handleClose()}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader className="pb-4">
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Settings
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* EDI Billing Processing Section */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    EDI Billing Processing
                                </CardTitle>
                                <CardDescription>
                                    Configure retry attempts and processing
                                    delays for EDI billing file processing
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Max Retries */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="edi-billing-max-retries">
                                            Max Retries
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>
                                                    Maximum number of retry
                                                    attempts for failed EDI
                                                    billing file processing
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    {isLoadingEdiBillingConfig ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm text-muted-foreground">
                                                Loading...
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="edi-billing-max-retries"
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={ediBillingMaxRetries}
                                                onChange={(e) =>
                                                    setEdiBillingMaxRetries(
                                                        parseInt(
                                                            e.target.value
                                                        ) || 1
                                                    )
                                                }
                                                className="w-20"
                                                disabled={
                                                    bulkUpdateEdiBillingConfigMutation.isPending
                                                }
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                attempts
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Processing Delay */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="edi-billing-delay">
                                            Processing Delay
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>
                                                    Delay in seconds before
                                                    processing EDI billing file
                                                    tasks (0-3600 seconds)
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    {isLoadingEdiBillingConfig ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm text-muted-foreground">
                                                Loading...
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="edi-billing-delay"
                                                type="number"
                                                min="0"
                                                max="3600"
                                                value={ediBillingDelay}
                                                onChange={(e) =>
                                                    setEdiBillingDelay(
                                                        parseInt(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                                className="w-24"
                                                disabled={
                                                    bulkUpdateEdiBillingConfigMutation.isPending
                                                }
                                            />
                                            <span className="text-sm text-muted-foreground">
                                                seconds (
                                                {formatDelay(ediBillingDelay)})
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Google Account Integration Section (Admin Only) */}
                        {isAdmin && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <div className="flex items-center gap-2">
                                        <img
                                            src="https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png"
                                            alt="Google"
                                            className="h-8 w-8"
                                        />
                                        <div>
                                            <CardTitle className="text-base">
                                                Google Sheets Integration
                                            </CardTitle>
                                            {/* <CardDescription>
                                                Link a Google account for bot
                                                automation. The bot will use
                                                this account to update Google
                                                Sheets. Tokens refresh
                                                automatically when needed.
                                            </CardDescription> */}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {isLoadingGoogleAccount ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="text-sm text-muted-foreground">
                                                Loading...
                                            </span>
                                        </div>
                                    ) : googleAccountStatus?.linked ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-medium">
                                                        Linked Account
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        {
                                                            googleAccountStatus
                                                                .account?.email
                                                        }
                                                    </span>
                                                    {googleAccountStatus.account
                                                        ?.updated_at && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Last updated:{" "}
                                                            {new Date(
                                                                googleAccountStatus.account.updated_at
                                                            ).toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            await initiateGoogleOAuth();
                                                        } catch (error: any) {
                                                            toast.error(
                                                                error?.response
                                                                    ?.data
                                                                    ?.detail ||
                                                                    "Failed to initiate Google OAuth"
                                                            );
                                                        }
                                                    }}
                                                    className="flex-1"
                                                >
                                                    <Link2 className="mr-2 h-4 w-4" />
                                                    Change Account
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() =>
                                                        unlinkGoogleAccountMutation.mutate()
                                                    }
                                                    disabled={
                                                        unlinkGoogleAccountMutation.isPending
                                                    }
                                                    className="flex-1"
                                                >
                                                    <Unlink className="mr-2 h-4 w-4" />
                                                    Unlink
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground">
                                                No Google account linked. Link
                                                an account to enable Google
                                                Sheets automation.
                                            </p>
                                            <Button
                                                onClick={async () => {
                                                    try {
                                                        await initiateGoogleOAuth();
                                                    } catch (error: any) {
                                                        toast.error(
                                                            error?.response
                                                                ?.data
                                                                ?.detail ||
                                                                "Failed to initiate Google OAuth"
                                                        );
                                                    }
                                                }}
                                                className="w-full"
                                            >
                                                <Link2 className="mr-2 h-4 w-4" />
                                                Link Google Account
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Unsaved Changes Indicator */}
                        {hasUnsavedChanges && (
                            <div className="text-sm text-amber-600">
                                You have unsaved changes
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={
                                bulkUpdateEdiBillingConfigMutation.isPending ||
                                !hasUnsavedChanges ||
                                isLoadingEdiBillingConfig
                            }
                        >
                            {bulkUpdateEdiBillingConfigMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}
