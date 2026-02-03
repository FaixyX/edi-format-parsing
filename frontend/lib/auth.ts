// lib/auth.ts
import { jwtDecode } from "jwt-decode";
import { getCookie, deleteCookie } from "cookies-next";

export type UserRole = "Admin" | "Member";

interface TokenPayload {
    sub: string;
    exp: number;
    type?: string;
    user_id?: number;
    token_version?: number;
}

export interface TabPermissions {
    agencies: UserRole[];
    monitoring: UserRole[];
    users: UserRole[];
    "billing-files": UserRole[];
}

export const TAB_PERMISSIONS: TabPermissions = {
    agencies: ["Admin", "Member"],
    monitoring: ["Admin", "Member"],
    users: ["Admin"],
    "billing-files": ["Admin", "Member"],
};

export interface User {
    id: string;
    username: string;
    type: UserRole;
}

export const isTokenValid = (token: string | null): boolean => {
    if (!token) return false;

    try {
        const decoded = jwtDecode<TokenPayload>(token);
        return decoded.exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

export const removeToken = () => {
    // Remove client-side accessible cookies
    deleteCookie("authToken");
};

export const getAuthToken = (): string | null => {
    const token = getCookie("authToken")?.toString() || null;
    return isTokenValid(token) ? token : null;
};

export const getUserFromToken = (): User | null => {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const decoded = jwtDecode<TokenPayload>(token);
        if (!decoded.sub || !decoded.type) return null;

        return {
            id: decoded.user_id?.toString() || "",
            username: decoded.sub,
            type: decoded.type as UserRole,
        };
    } catch {
        return null;
    }
};

export const getUserRoleFromToken = (): UserRole | null => {
    try {
        const user = getUserFromToken();
        return user ? user.type : null;
    } catch {
        return null;
    }
};
