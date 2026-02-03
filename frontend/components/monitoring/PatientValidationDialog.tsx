"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { PatientValidationResult, EDIPatientData } from "@/types/monitoring";
import { PatientDataList } from "./PatientDataCard";

interface PatientValidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    results: PatientValidationResult[];
    ediPatients?: EDIPatientData[];
    raDate?: string;
}

/**
 * Dialog that displays patient validation results.
 * Now uses the unified PatientDataList component to show both EDI data and validation results.
 */
export function PatientValidationDialog({
    isOpen,
    onClose,
    results,
    ediPatients = [],
    raDate,
}: PatientValidationDialogProps) {
    const validCount = results.filter((r) => r.is_valid).length;
    const invalidCount = results.length - validCount;

    // Merge validation results with EDI patients if both are present
    // This ensures validation status (is_valid) is shown correctly
    let patients: EDIPatientData[] = [];

    if (ediPatients && ediPatients.length > 0) {
        // Start with EDI patients as base
        patients = [...ediPatients];

        // If we have validation results, merge them by patient_number
        if (results.length > 0) {
            const validationMap = new Map<string, PatientValidationResult>();
            results.forEach((result) => {
                if (result.patient_number) {
                    const patientNumber = String(result.patient_number).trim();
                    if (patientNumber) {
                        validationMap.set(patientNumber, result);
                    }
                }
            });

            // Update patients with validation data
            patients = patients.map((patient) => {
                const patientNumber = patient.patient_number
                    ? String(patient.patient_number).trim()
                    : null;

                if (patientNumber && validationMap.has(patientNumber)) {
                    const validation = validationMap.get(patientNumber)!;
                    return {
                        ...patient,
                        // Update claim_amount and paid_amount from validation if available
                        claim_amount:
                            validation.final_claim_amount ??
                            patient.claim_amount,
                        paid_amount:
                            validation.final_payment_amount ??
                            patient.paid_amount,
                        // Ensure is_valid is set from validation results
                        is_valid: validation.is_valid,
                    };
                }
                return patient;
            });
        }
    } else if (results.length > 0) {
        // No EDI patients, create from validation results
        patients = results.map((result) => ({
            patient_name: result.patient_name,
            patient_number: result.patient_number || "",
            claim_number: "",
            claim_amount: result.final_claim_amount,
            paid_amount: result.final_payment_amount,
            is_valid: result.is_valid,
        }));
    }

    // Determine if this is an already imported case (no validation results but has EDI patients)
    const isAlreadyImported = results.length === 0 && patients.length > 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Patient Validation Results</DialogTitle>
                    <DialogDescription>
                        {isAlreadyImported ? (
                            <>{patients.length} patient(s) (already imported)</>
                        ) : (
                            <>
                                {validCount} passed, {invalidCount} failed out
                                of {results.length} patient(s)
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                    <PatientDataList
                        patients={patients}
                        raDate={raDate}
                        showSummary={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
