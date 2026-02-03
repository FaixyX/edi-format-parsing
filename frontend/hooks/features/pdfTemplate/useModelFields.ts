import { useQuery } from "@tanstack/react-query";
import { getModelFields } from "@/services/pdfTemplateApi";

export function useModelFields(modelId: string | null) {
    const {
        data: fieldOptions = [],
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["modelFields", modelId],
        queryFn: () =>
            modelId ? getModelFields(modelId) : Promise.resolve([]),
        enabled: !!modelId,
    });

    return {
        fieldOptions,
        isLoading,
        error,
        refetch,
    };
}
