"use client";

import { usePatientEpisodes } from "@/hooks/features/patient-episode/usePatientEpisodes";
import { usePublicPatientEpisodes } from "@/hooks/features/patient-episode/usePublicPatientEpisodes";
import { ComboboxField } from "@/components/ui/data-table/combobox-field";
import { RefreshButton } from "@/components/ui/data-table/refresh-button";

interface PatientEpisodeSelectorProps {
    agencyId: string | undefined;
    selectedEpisodeId: string;
    onSelectEpisode: (episodeId: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    usePublicApi?: boolean; // New prop to determine which API to use
}

export function PatientEpisodeSelector({
    agencyId,
    selectedEpisodeId,
    onSelectEpisode,
    label = "Patient Episode",
    placeholder = "Select a patient episode...",
    className,
    usePublicApi = false, // Default to authenticated API
}: PatientEpisodeSelectorProps) {
    console.log(`[PatientEpisodeSelector] Component rendered with:`, {
        agencyId,
        selectedEpisodeId,
        label,
        placeholder,
    });

    // Use public or authenticated API based on the prop
    const {
        episodes: publicEpisodes,
        episodeOptions: publicEpisodeOptions,
        isLoading: publicIsLoading,
        syncEpisodes: publicSyncEpisodes,
        isSyncing: publicIsSyncing,
    } = usePublicPatientEpisodes(agencyId);
    const {
        episodes: authEpisodes,
        episodeOptions: authEpisodeOptions,
        isLoading: authIsLoading,
        syncEpisodes: authSyncEpisodes,
        isSyncing: authIsSyncing,
    } = usePatientEpisodes(agencyId);

    // Use the appropriate data based on the API type
    const episodes = usePublicApi ? publicEpisodes : authEpisodes;
    const episodeOptions = usePublicApi
        ? publicEpisodeOptions
        : authEpisodeOptions;
    const isLoading = usePublicApi ? publicIsLoading : authIsLoading;
    const syncEpisodes = usePublicApi ? publicSyncEpisodes : authSyncEpisodes;
    const isSyncing = usePublicApi ? publicIsSyncing : authIsSyncing;

    console.log(`[PatientEpisodeSelector] usePatientEpisodes returned:`, {
        episodesLength: episodes.length,
        episodeOptionsLength: episodeOptions.length,
        isLoading,
    });

    const handleSelectEpisode = (value: string) => {
        console.log(`[PatientEpisodeSelector] Episode selected: ${value}`);
        console.log(
            `[PatientEpisodeSelector] Previous selection: ${selectedEpisodeId}`
        );
        onSelectEpisode(value);
    };

    return (
        <div className="flex items-end gap-2">
            <div className="flex-grow">
                <ComboboxField
                    label={label}
                    id="patient-episode"
                    value={selectedEpisodeId}
                    options={episodeOptions}
                    labelPosition="top"
                    onChange={handleSelectEpisode}
                    placeholder={
                        isLoading ? "Loading episodes..." : placeholder
                    }
                    searchPlaceholder="Search episodes..."
                    emptyMessage={
                        isLoading
                            ? "Loading episodes..."
                            : agencyId
                            ? "No episodes found"
                            : "Please select an agency first"
                    }
                    disabled={isLoading || !agencyId}
                    className={className}
                />
            </div>
            <RefreshButton
                onRefresh={syncEpisodes}
                tooltipText="Sync patient episodes"
                successMessage="Patient episodes synced successfully"
                errorMessage="Failed to sync patient episodes"
                disabled={!agencyId || isSyncing}
                showToasts={false}
            />
        </div>
    );
}
