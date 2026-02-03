export interface PatientEpisode {
    id: string; // UUID string
    agency_id: string; // UUID string
    code: string;
    name: string;
    start_of_care: string | null; // ISO date string
    discharge_date: string | null; // ISO date string
    mrn: string; // Medical Record Number like 000000485-001
    last_synced: string; // ISO datetime string
}

export interface PatientEpisodeOption {
    value: string; // ID of the episode
    label: string; // Display text for the combo box
    code: string; // For filtering/searching
    name: string; // For filtering/searching
    start_of_care: string | null; // For display/filtering
    discharge_date: string | null; // For display/filtering
    mrn: string; // Hidden from UI but used for filtering
}

export type NewPatientEpisode = Omit<PatientEpisode, "id" | "last_synced">;
