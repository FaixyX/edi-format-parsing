"use client";

import { checkAuthentication } from "@/utils/auth";
import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AuthCheckResult {
    isAuthenticated: boolean;
    accessToken?: string;
    type?: string;
    username?: string;
    user_id?: number;
    error?: string;
    loading?: boolean;
    refreshAuth?: () => void;
}

const AuthContext = createContext<AuthCheckResult>({
    isAuthenticated: false,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    // Use React Query to fetch and cache authentication data
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["auth"],
        queryFn: async () => {
            try {
                const result = await checkAuthentication();
                return result;
            } catch (error) {
                console.error("Failed to check authentication:", error);
                return {
                    isAuthenticated: false,
                    error: "Error checking auth",
                };
            }
        },
        staleTime: 0, // Always refetch on mount
        gcTime: 0, // Don't keep data in memory cache
        meta: {
            persist: false, // Tell the persister to skip this query
        },
    });

    // Clear auth data when component unmounts
    useEffect(() => {
        return () => {
            // Clean up auth data when the component unmounts
            queryClient.removeQueries({ queryKey: ["auth"] });
        };
    }, [queryClient]);

    // Function to force refresh auth state
    const refreshAuth = async () => {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        await refetch();
    };

    // Combine the data with loading state and ensure isAuthenticated is always a boolean
    const authState: AuthCheckResult = {
        ...(data || { isAuthenticated: false }),
        isAuthenticated: data?.isAuthenticated || false,
        loading: isLoading,
        refreshAuth,
    };

    return (
        <AuthContext.Provider value={authState}>
            {children}
        </AuthContext.Provider>
    );
}
