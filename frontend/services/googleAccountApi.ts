import { Backend } from "@/lib/helper";
import { BASE_API_URL } from "@/lib/constant";

const API_BASE = `${BASE_API_URL}/settings/google`;

export interface GoogleAccountStatus {
    linked: boolean;
    account: {
        email: string;
        is_active: boolean;
        has_tokens: boolean;
        created_at: string | null;
        updated_at: string | null;
    } | null;
}

/**
 * Get the status of the linked Google account
 */
export async function getGoogleAccountStatus(): Promise<GoogleAccountStatus> {
    const response = await Backend.get("settings/google/status", {
        withCredentials: true,
    });
    return response.data;
}

/**
 * Initiate Google OAuth flow
 * This will redirect to Google's authorization page
 */
export async function initiateGoogleOAuth(): Promise<void> {
    try {
        const response = await Backend.get("settings/google/authorize", {
            withCredentials: true,
        });
        // Redirect to Google's OAuth page
        window.location.href = response.data.authorization_url;
    } catch (error: any) {
        console.error("Failed to initiate Google OAuth:", error);
        throw error;
    }
}

/**
 * Unlink the Google account
 */
export async function unlinkGoogleAccount(): Promise<{ success: boolean; message: string }> {
    const response = await Backend.post("settings/google/unlink", {
        body: {},
        withCredentials: true,
    });
    return response.data;
}

/**
 * Manually refresh the Google access token
 */
export async function refreshGoogleToken(): Promise<{ success: boolean; message: string }> {
    const response = await Backend.post("settings/google/refresh-token", {
        body: {},
        withCredentials: true,
    });
    return response.data;
}

