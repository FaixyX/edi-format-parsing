"use client";

import type { z } from "zod";
import { setCookie } from "cookies-next";
import { Backend } from "@/lib/helper";
import { LoginResponse } from "@/types/auth";
import { loginSchema } from "@/schema/auth-schema";
import { jwtDecode } from "jwt-decode";
import { TokenPayload } from "@/middleware";

export async function login(
    values: z.infer<typeof loginSchema>
): Promise<LoginResponse> {
    const validatedFields = loginSchema.safeParse(values);

    if (!validatedFields.success) {
        return {
            success: false,
            error: "Invalid fields",
        } as unknown as LoginResponse;
    }

    try {
        const login_data = validatedFields.data;

        console.info("[login] submitting credentials", {
            endpoint: "login",
            origin:
                typeof window !== "undefined"
                    ? window.location.origin
                    : "server",
        });

        const { data, status } = await Backend.post("login", {
            body: login_data,
            withCredentials: true,
        });

        if (status === 200) {
            const decoded = jwtDecode<TokenPayload>(data.token);
            const maxAge =
                decoded.exp && decoded.exp > 0
                    ? decoded.exp - Math.floor(Date.now() / 1000)
                    : 3600;

            setCookie("authToken", data.token, {
                path: "/",
                maxAge,
                httpOnly: false, // must remain client-readable to attach Authorization header
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });

            const targetUrl =
                decoded.type === "Member"
                    ? "/control-panel/agencies"
                    : "/control-panel";

            // Short-lived hint to force client refresh after auth
            setCookie("forceRefresh", "true", {
                path: "/",
                maxAge: 60,
                httpOnly: false,
            });

            return {
                success: true,
                ...data,
                redirectUrl: targetUrl,
            };
        }

        if (status === 401) {
            return {
                success: false,
                error: data.detail || "Invalid credentials",
            } as unknown as LoginResponse;
        }

        return {
            success: false,
            error: `Login failed with status: ${status}`,
        } as unknown as LoginResponse;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Login failed",
        } as unknown as LoginResponse;
    }
}
