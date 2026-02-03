import { useQuery } from "@tanstack/react-query";
import { getSystemInstructions } from "@/services/systemInstructionApi";

export function useSystemInstructionQuery() {
    const {
        data: systemInstructions = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["systemInstructions"],
        queryFn: getSystemInstructions,
    });

    return {
        systemInstructions,
        isLoading,
        isError,
        error,
        refetch,
    };
}
