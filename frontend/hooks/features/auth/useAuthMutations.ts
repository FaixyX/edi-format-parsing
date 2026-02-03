import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LoginCredentials, LoginResponse } from "@/types/auth";
import { UserRole } from "@/lib/auth";
import { login } from "@/actions/login";
import { useAuth } from "@/context/auth-context";
import { useQueryClient } from "@tanstack/react-query";

export function useAuthMutations() {
    const router = useRouter();
    const { refreshAuth } = useAuth();
    const queryClient = useQueryClient();

    const loginMutation = useMutation<LoginResponse, Error, LoginCredentials>({
        mutationFn: login,
        onSuccess: (response) => {
            if (!response.success) {
                toast.error("Login Failed", {
                    description:
                        response.error || "Unable to log in. Please try again.",
                });
                return;
            }

            // Clear any existing auth data from the cache
            queryClient.removeQueries({ queryKey: ["auth"] });

            // Force a complete page refresh to ensure all state is reset
            if (response.redirectUrl) {
                // Use window.location for a hard refresh
                window.location.href = response.redirectUrl;
            } else {
                // Fallback to router.push if no redirectUrl
                router.push("/control-panel");
            }

            toast.success("Login Successful", {
                description: `Welcome back, ${response.user?.username}!`,
            });
        },
        onError: (error: Error) => {
            const errorMessage =
                error.message || "Unable to log in. Please try again.";
            toast.error("Login Failed", {
                description: errorMessage,
            });
        },
    });

    return {
        loginMutation,
    };
}
