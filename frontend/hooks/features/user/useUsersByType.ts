import { useQuery } from "@tanstack/react-query";
import { getUsersByType } from "@/services/userApi";
import { UserType } from "@/types/user";

export function useUsersByType(type: UserType) {
    const {
        data: users,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["usersByType", type],
        queryFn: () => getUsersByType(type),
    });

    // Ensure users is always an array and handle potential errors
    const safeUsers = Array.isArray(users) ? users : [];

    // Convert users to options format for combobox
    const userOptions = safeUsers.map((user) => ({
        value: user.id, // This is a number
        label: user.username,
    }));

    return {
        userOptions,
        isLoading,
        error,
        refetch,
    };
}
