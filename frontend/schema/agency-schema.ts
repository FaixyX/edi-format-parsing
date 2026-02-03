import { z } from "zod";
import { Agency } from "@/types/agency";

/**
 * Creates a zod schema for agency form validation with NPI uniqueness check
 * @param existingAgencies - List of existing agencies to check NPI against
 * @param excludeAgencyId - Optional agency ID to exclude from NPI check (for edit mode)
 */
export const createAgencySchema = (
    existingAgencies: Agency[],
    excludeAgencyId?: string
) => {
    const existingNpis = existingAgencies
        .filter((agency) => {
            // Exclude the current agency if editing
            if (excludeAgencyId && agency.id === excludeAgencyId) {
                return false;
            }
            // Only include agencies with non-empty NPI
            return agency.npi && agency.npi.trim() !== "";
        })
        .map((agency) => agency.npi!.toLowerCase().trim());

    return z.object({
        name: z.string().optional(),
        link: z.string().optional(),
        npi: z
            .string()
            .min(1, { message: "NPI is required" })
            .refine(
                (val) => {
                    // Check if NPI is not empty
                    if (!val || val.trim() === "") {
                        return false;
                    }
                    // Check if NPI is unique (case-insensitive)
                    const normalizedNpi = val.toLowerCase().trim();
                    return !existingNpis.includes(normalizedNpi);
                },
                {
                    message: "An agency with this NPI already exists",
                }
            ),
        username: z.string().optional(),
        password: z.string().optional(),
    });
};

export type AgencyFormValues = z.infer<
    ReturnType<typeof createAgencySchema>
>;

