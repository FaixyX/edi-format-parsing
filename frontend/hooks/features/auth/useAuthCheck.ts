import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTokenValid } from "@/lib/auth";
import { getCookie } from "cookies-next";

export function useAuthCheck() {
    const router = useRouter();

    useEffect(() => {
        const token = getCookie("authToken")?.toString() || null;
        if (token && isTokenValid(token)) {
            router.push("/control-panel");
        }
    }, [router]);
}
