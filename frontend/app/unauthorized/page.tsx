"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
// import { removeToken } from "@/lib/auth";
import { Shield } from "lucide-react";

export default function UnauthorizedPage() {
    const router = useRouter();

    // const handleLogout = () => {
    //     removeToken();
    //     router.push("/login");
    // };
    const handleHome = () => {
        router.push("/");
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center space-y-6">
                <Shield className="mx-auto h-16 w-16 text-red-500" />
                <h1 className="text-3xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">
                    You do not have permission to access this page.
                    <br />
                    Please contact an administrator if you believe this is an error.
                </p>
                <div className="flex justify-center gap-4">
                    <Button onClick={handleHome}>Go to Home</Button>
                </div>
            </div>
        </div>
    );
}
