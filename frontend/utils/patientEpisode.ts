import { PatientEpisode, PatientEpisodeOption } from "@/types/patientEpisode";
import { format, parseISO } from "date-fns";

export function formatPatientEpisodesForCombobox(
    episodes: PatientEpisode[]
): PatientEpisodeOption[] {
    return episodes.map((episode) => {
        const startOfCare = episode.start_of_care
            ? format(parseISO(episode.start_of_care), "MM/dd/yyyy")
            : null;

        const dischargeDate = episode.discharge_date
            ? format(parseISO(episode.discharge_date), "MM/dd/yyyy")
            : null;

        const label = `${episode.code} - ${episode.name} ${
            startOfCare ? `(SOC: ${startOfCare})` : ""
        }`;

        return {
            value: episode.id,
            label,
            code: episode.code,
            name: episode.name,
            start_of_care: startOfCare,
            discharge_date: dischargeDate,
            mrn: episode.mrn,
        };
    });
}
