import { Assessment, AssessmentOption } from "@/types/assessment";

export function formatAssessmentsForTable(
    assessments: Assessment[]
): AssessmentOption[] {
    return assessments.map((assessment) => {
        const label = `${assessment.status_description.toUpperCase()} - ${
            assessment.status
        } (${assessment.effective_dates})`;

        return {
            value: assessment.id,
            label,
            status: assessment.status,
            status_description: assessment.status_description,
            effective_dates: assessment.effective_dates,
            oasis: assessment.oasis,
        };
    });
}
