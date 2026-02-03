"use client";

import { useQuery } from "@tanstack/react-query";
import { useAgencyFormHandlers } from "@/hooks/features/agency/useAgencyFormHandlers";
import { useAgencyDialogs } from "@/hooks/features/agency/useAgencyDialogs";
import { useAgencyHandlers } from "@/hooks/features/agency/useAgencyHandlers";
import { usePermissions } from "@/hooks/auth/usePermissions";
import { useAuth } from "@/context/auth-context";
import { UserRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { AgencyTable } from "@/components/agency/AgencyTable";
import { AddAgencyDialog } from "@/components/agency/AddAgencyDialog";
import { EditAgencyDialog } from "@/components/agency/EditAgencyDialog";
import { DeleteAgencyDialog } from "@/components/agency/DeleteAgencyDialog";
import { Agency } from "@/types/agency";
import { getAgencies } from "@/services/agencyApi";

export default function AgenciesPage() {
    const {
        refreshAuth,
        type: authType,
        loading: authLoading,
    } = useAuth();
    const { userRole } = usePermissions();

    // Force refresh auth state when component mounts
    useEffect(() => {
        if (refreshAuth) {
            refreshAuth();
        }
    }, [refreshAuth]);

    // Use the type from auth context as a fallback if userRole is not set
    const userRoleToUse = userRole || (authType as UserRole | null);

    const isAdmin = userRoleToUse === "Admin";
    const isMember = userRoleToUse === "Member";

    const {
        newAgency,
        editingAgency,
        setEditingAgency,
        handleInputChange,
        resetForm,
    } = useAgencyFormHandlers();

    const { dialogState, openDialog, closeDialog } = useAgencyDialogs();

    const {
        handleAddAgency,
        handleEditAgency,
        handleDeleteAgency,
        isAdding,
        isEditing,
        isDeleting,
        showPassword,
        togglePassword,
    } = useAgencyHandlers(
        editingAgency,
        editingAgency,
        () => closeDialog("add"),
        resetForm,
        () => closeDialog("edit"),
        () => closeDialog("delete"),
        setEditingAgency
    );

    // Fetch agencies
    const {
        data: agencies = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["agencies"],
        queryFn: getAgencies,
    });

    // Handlers
    const handleEdit = (agency: Agency) => {
        setEditingAgency(agency);
        openDialog("edit");
    };

    const handleDelete = (agency: Agency) => {
        setEditingAgency(agency);
        openDialog("delete");
    };

    const handleRefresh = async () => {
        await refetch();
    };

    // Only show sensitive data for Admin and Member
    const showSensitiveData = isAdmin || isMember;

    // Show loading state while auth is loading
    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AgencyTable
                agencies={agencies}
                isLoading={isLoading}
                error={error as Error | null}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRetry={() => refetch()}
                onAdd={() => openDialog("add")}
                showPassword={showPassword}
                onTogglePassword={togglePassword}
                showSensitiveData={showSensitiveData}
                userRole={userRoleToUse}
                onRefresh={handleRefresh}
            />

            <AddAgencyDialog
                isOpen={dialogState.add}
                onClose={() => closeDialog("add")}
                onSubmit={handleAddAgency}
                isSubmitting={isAdding}
                existingAgencies={agencies}
                showSensitiveData={showSensitiveData}
            />

            <EditAgencyDialog
                isOpen={dialogState.edit}
                onClose={() => closeDialog("edit")}
                onSubmit={handleEditAgency}
                isSubmitting={isEditing}
                agency={editingAgency}
                existingAgencies={agencies}
                showSensitiveData={showSensitiveData}
            />

            <DeleteAgencyDialog
                isOpen={dialogState.delete}
                onClose={() => closeDialog("delete")}
                onConfirm={handleDeleteAgency}
                isDeleting={isDeleting}
                agencyName={editingAgency?.name || ""}
            />
        </div>
    );
}
