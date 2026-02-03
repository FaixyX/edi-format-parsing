import { BASE_API_URL } from "@/lib/constant";
import { LoginCredentials, LoginResponse } from "@/types/auth";

const API_CONFIG = {
    baseUrl: BASE_API_URL,
    endpoints: {
        login: "/login",
    },
} as const;

export const authApi = {
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        const response = await fetch(
            `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.login}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(credentials),
                credentials: "include", // Include cookies for CORS
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Login failed");
        }

        return data;
    },
};
