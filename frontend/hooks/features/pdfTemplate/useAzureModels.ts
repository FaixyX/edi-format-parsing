import { useQuery } from "@tanstack/react-query";
import { getAzureModels } from "@/services/pdfTemplateApi";
import { AzureModelOption } from "@/types/pdfTemplate";

export function useAzureModels() {
    const {
        data: modelOptions = [],
        isLoading,
        error,
        refetch,
    } = useQuery<AzureModelOption[], Error>({
        queryKey: ["azureModels"],
        queryFn: getAzureModels,
    });

    return {
        modelOptions,
        isLoading,
        error,
        refetch,
    };
}
