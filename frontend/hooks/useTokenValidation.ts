"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { getAuthToken } from "@/lib/auth";
import { Backend } from "@/lib/helper";

/**
 * Hook that periodically validates the authentication token
 * to ensure it hasn't been invalidated (e.g., password changed, account deactivated)
 */
export function useTokenValidation() {
    const { isAuthenticated, refreshAuth } = useAuth();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Only validate if user is authenticated
        if (!isAuthenticated) {
            return;
        }

        // Validate token immediately on mount
        const validateToken = async () => {
            const token = getAuthToken();
            if (!token) {
                return;
            }

            try {
                // Call /me endpoint to validate token
                // This will return 401 if token is invalidated
                await Backend.get("me", {
                    withCredentials: true,
                });
            } catch (error: any) {
                // If we get a 401, the token is invalid
                // The Backend class will handle logout and redirect
                if (error?.status === 401) {
                    // Force refresh auth state to trigger logout
                    if (refreshAuth) {
                        refreshAuth();
                    }
                }
            }
        };

        // Validate immediately
        validateToken();

        // Set up periodic validation every 30 seconds
        intervalRef.current = setInterval(() => {
            validateToken();
        }, 30000); // 30 seconds

        // Cleanup interval on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isAuthenticated, refreshAuth]);
}
