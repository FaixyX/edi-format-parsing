// app/control-panel/layout.tsx
"use client";

import type React from "react";
import { Sidebar } from "@/components/sidebar";
import {
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderTitle } from "@/components/header-title";
import { AuthProvider } from "@/context/auth-context";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTokenValidation } from "@/hooks/useTokenValidation";

function ControlPanelLayout({ children }: { children: React.ReactNode }) {
    const { refreshAuth, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    // Periodically validate token to catch invalidations
    useTokenValidation();

    // Check for the forceRefresh cookie and refresh auth state if found
    useEffect(() => {
        // Check for the forceRefresh cookie
        const cookies = document.cookie.split(";");
        const forceRefreshCookie = cookies.find((cookie) =>
            cookie.trim().startsWith("forceRefresh=")
        );

        if (forceRefreshCookie) {
            // Clear the cookie
            document.cookie = "forceRefresh=; path=/; max-age=0";

            // Force refresh auth state
            if (refreshAuth) {
                refreshAuth();
            }
        }
    }, [refreshAuth]);

    // Redirect to login if not authenticated (after loading completes)
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push("/login");
        }
    }, [loading, isAuthenticated, router]);

    // Show loading spinner while determining user role
    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Don't render layout if not authenticated (redirect will happen)
    if (!isAuthenticated) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Both Admins and Members use the same layout with sidebar
    // The only difference is Admins can access /users page (handled by middleware)
    return (
        <SidebarProvider>
            <Sidebar />
            <SidebarInset className="overflow-hidden">
                <header className="h-14 border-b flex items-center px-4 flex-shrink-0">
                    <SidebarTrigger />
                    <div className="text-lg font-medium ml-2">
                        <HeaderTitle />
                    </div>
                </header>
                <main className="p-4 flex-1 overflow-auto min-h-0">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function ControlPanelLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthProvider>
            <ControlPanelLayout>{children}</ControlPanelLayout>
        </AuthProvider>
    );
}
