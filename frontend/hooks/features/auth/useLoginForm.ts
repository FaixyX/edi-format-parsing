import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthMutations } from "./useAuthMutations";
import { loginSchema } from "@/schema/auth-schema";


export type LoginFormValues = z.infer<typeof loginSchema>;

export function useLoginForm() {
    const [showPassword, setShowPassword] = useState(false);
    const { loginMutation } = useAuthMutations();

    // Initialize the form
    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            username: "",
            password: "",
            keepLoggedIn: false,
        },
    });

    // Handle form submission
    const onSubmit = (values: LoginFormValues) => {
        loginMutation.mutate(values);
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return {
        form,
        showPassword,
        togglePasswordVisibility,
        onSubmit,
        isLoading: loginMutation.isPending,
    };
}
