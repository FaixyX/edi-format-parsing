"use client";

import { jwtDecode } from "jwt-decode";
import { getAuthToken, removeToken } from "@/lib/auth";
import { Backend } from "@/lib/helper";

export type AuthCheckResult = {
    accessToken?: string;
    isAuthenticated: boolean;
    type?: string;
    username?: string;
    user_id?: number;
    error?: string;
};

interface DecodedToken {
    exp?: number;
    type?: string;
    sub?: string;
    user_id?: number;
    token_version?: number;
}

export async function checkAuthentication(): Promise<AuthCheckResult> {
    const authToken = getAuthToken();

    if (!authToken) {
        return {
            isAuthenticated: false,
            error: "No authentication token found",
        };
    }

    try {
        // First decode token to get basic info
        const decoded = jwtDecode<DecodedToken>(authToken);
        const { type, sub, user_id } = decoded;

        // Validate token with backend by calling /me endpoint
        // This ensures token_version matches and user is still enabled
        try {
            const response = await Backend.get("me", {
                withCredentials: true,
            });

            if (response.status === 200 && response.data) {
                return {
                    accessToken: authToken,
                    isAuthenticated: true,
                    type,
                    username: sub,
                    user_id: user_id || undefined,
                };
            } else {
                // Token is invalid, remove it
                removeToken();
                return {
                    isAuthenticated: false,
                    error: "Token validation failed",
                };
            }
        } catch (error: any) {
            // If we get a 401, token is invalid
            if (error?.status === 401) {
                removeToken();
                return {
                    isAuthenticated: false,
                    error: "Token has been invalidated. Please log in again.",
                };
            }
            throw error;
        }
    } catch (error) {
        return {
            isAuthenticated: false,
            error: "Error checking authentication status",
        };
    }
}
