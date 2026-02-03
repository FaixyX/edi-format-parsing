import { useQuery } from "@tanstack/react-query";
import { getOpenAIModels } from "@/services/systemInstructionApi";

export function useOpenAIModels() {
    const {
        data: models = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ["openAIModels"],
        queryFn: getOpenAIModels,
    });

    // Transform models for dropdown
    const modelOptions = models.map((model) => ({
        value: model.id,
        label: model.id,
        // description: `Created: ${new Date(
        //     model.created * 1000
        // ).toLocaleDateString()}`,
    }));

    return {
        models,
        modelOptions,
        isLoading,
        isError,
        error,
        refetch,
    };
}
