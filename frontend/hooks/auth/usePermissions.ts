import { useEffect, useState } from "react";
import { UserRole, TAB_PERMISSIONS, getUserRoleFromToken } from "@/lib/auth";

export function usePermissions() {
    const [userRole, setUserRole] = useState<UserRole | null>(null);

    useEffect(() => {
        const role = getUserRoleFromToken();
        setUserRole(role);
    }, []);

    const canAccessTab = (tabName: keyof typeof TAB_PERMISSIONS): boolean => {
        if (!userRole) return false;
        return TAB_PERMISSIONS[tabName].includes(userRole);
    };

    const canManageUsers = (): boolean => {
        return userRole === "Admin";
    };

    const canManageAgencies = (): boolean => {
        return userRole === "Admin";
    };

    const canEditAgency = (): boolean => {
        return userRole === "Admin" || userRole === "Member";
    };

    const canAddAgency = (): boolean => {
        return userRole === "Admin";
    };

    const canDeleteAgency = (): boolean => {
        return userRole === "Admin";
    };

    const canViewAssignedUsers = (): boolean => {
        return userRole === "Admin";
    };

    const canEditAssignedUsers = (): boolean => {
        return userRole === "Admin";
    };

    return {
        userRole,
        canAccessTab,
        canManageUsers,
        canManageAgencies,
        canEditAgency,
        canAddAgency,
        canDeleteAgency,
        canViewAssignedUsers,
        canEditAssignedUsers,
        isAdmin: () => userRole === "Admin",
        isMember: () => userRole === "Member",
    };
}
