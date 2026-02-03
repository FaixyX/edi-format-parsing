"use client";
import { deleteCookie, setCookie } from "cookies-next";

export async function logout() {
    try {
        deleteCookie("authToken", { path: "/" });

        // Add a cookie to trigger client-side cache clearing
        setCookie("clearAuthCache", "true", {
            path: "/",
            maxAge: 60, // Short-lived cookie just for the redirect
            httpOnly: false,
        });

        return { redirect: "/login" };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error("Logout failed");
    }
}
