"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Info, Search } from "lucide-react";
import { EDIPatientData, PatientValidationResult } from "@/types/monitoring";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { CopyableText } from "@/components/ui/data-table/copyable-text";

interface PatientDataCardProps {
    patient: EDIPatientData;
    raDate?: string;
    index: number;
}

/**
 * Unified component that displays both EDI patient data and validation results
 * in a single card. This merges the previously separate "EDI File Patient Data"
 * and "Validation Results" sections into one cohesive view.
 */
export function PatientDataCard({
    patient,
    raDate,
    index,
}: PatientDataCardProps) {
    // Use claim amount from patient data (already matched and stored by backend)
    const claimAmount = patient.claim_amount;
    const hasClaimAmount = claimAmount != null && claimAmount !== 0;

    const paidAmount = patient.paid_amount ?? 0;

    // Calculate difference
    const difference = hasClaimAmount ? paidAmount - claimAmount : 0;

    // Use validation status from patient data (already matched and stored by backend)
    const isValid = patient.is_valid ?? null;
    // Note: validationMessage and validationError are no longer needed since is_valid is in patient data
    const validationMessage =
        isValid !== null
            ? isValid
                ? "Payment >= Claim"
                : "Payment < Claim"
            : null;
    const validationError = null;

    // Choose border and background color based on validation status
    let cardClassName = "p-4 rounded-lg border ";
    if (isValid === true) {
        cardClassName +=
            "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
    } else if (isValid === false) {
        cardClassName +=
            "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
    } else {
        // No validation result yet
        cardClassName += "bg-muted/50 border-border";
    }

    return (
        <div className={cardClassName}>
            <div className="space-y-3">
                {/* Header: Patient name + validation status */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                        {/* Validation icon */}
                        {isValid === true && (
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        )}
                        {isValid === false && (
                            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        {isValid === null && (
                            <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        )}

                        <h5 className="font-semibold flex items-center gap-2 flex-wrap">
                            <span>
                                {patient.patient_name || `Patient ${index + 1}`}
                            </span>
                            {patient.patient_number && patient.claim_number && (
                                <span className="text-muted-foreground font-normal">
                                    <CopyableText
                                        text={`${patient.patient_number}-${patient.claim_number}`}
                                        displayText={`${patient.patient_number} - ${patient.claim_number}`}
                                        className="font-normal"
                                    />
                                </span>
                            )}
                        </h5>
                    </div>
                </div>

                {/* Patient identifiers */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    {patient.mid && (
                        <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">MID:</span>
                        <CopyableText
                            text={`${patient.mid}`}
                            displayText={`${patient.mid}`}
                            className="font-medium"
                        />
                      </div>
                    )}
                    {patient.service_period_start &&
                        patient.service_period_end && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">
                                    Service Period:
                                </span>{" "}
                                <span className="font-medium">
                                    {new Date(
                                        patient.service_period_start +
                                            "T00:00:00"
                                    ).toLocaleDateString()}{" "}
                                    -{" "}
                                    {new Date(
                                        patient.service_period_end + "T00:00:00"
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                </div>

                {/* Dates - RA Date removed from cards as it's the same for all patients */}
                {/* Claim Received - Hidden per user request, may be added back in the future */}
                {/* {patient.claim_received_date && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">
                                Claim Received:
                            </span>{" "}
                            <span className="font-medium">
                                {new Date(
                                    patient.claim_received_date + "T00:00:00"
                                ).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                )} */}

                {/* Service period */}

                {/* Financial data */}
                <div
                    className={`grid grid-cols-4 gap-4 pt-2 border-t ${
                        isValid === true
                            ? "border-green-200 dark:border-green-900"
                            : isValid === false
                            ? "border-red-200 dark:border-red-900"
                            : "border-border"
                    }`}
                >
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">
                            Claim Amount
                        </div>
                        <div className="text-sm font-semibold">
                            {hasClaimAmount ? (
                                `$${claimAmount.toFixed(2)}`
                            ) : (
                                <span className="text-muted-foreground">
                                    N/A
                                </span>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">
                            Paid Amount
                        </div>
                        <div className="text-sm font-semibold">
                            ${paidAmount.toFixed(2)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">
                            Adjustment
                        </div>
                        <div className="text-sm font-semibold">
                            {patient.adjustment_amount != null &&
                            patient.adjustment_amount !== 0 ? (
                                <span className="text-orange-600">
                                    ${patient.adjustment_amount.toFixed(2)}
                                </span>
                            ) : (
                                <span className="text-muted-foreground">
                                    N/A
                                </span>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground mb-1">
                            Difference
                        </div>
                        <div
                            className={`text-sm font-semibold ${
                                hasClaimAmount
                                    ? difference >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                    : "text-muted-foreground"
                            }`}
                        >
                            {hasClaimAmount ? (
                                `$${difference.toFixed(2)}`
                            ) : (
                                <span className="text-muted-foreground">
                                    N/A
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Validation error if any */}
                {validationError && (
                    <div className="mt-2 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4 mt-0.5" />
                        <span>{validationError}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

interface PatientDataListProps {
    patients: EDIPatientData[];
    validationResults?: PatientValidationResult[];
    raDate?: string;
    showSummary?: boolean;
}

/**
 * Component that displays a list of patient cards with optional summary totals.
 */
export function PatientDataList({
    patients,
    validationResults = [],
    raDate,
    showSummary = true,
}: PatientDataListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    console.log("validation results", validationResults);

    // Note: No longer need to match validation_results - all data (claim_amount, is_valid)
    // is now stored directly in edi_patients by the backend after validation

    // Filter patients based on search query
    const filteredPatients = patients.filter((patient) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const patientName = (patient.patient_name || "").toLowerCase();
        const patientNumber = (patient.patient_number || "").toLowerCase();
        const claimNumber = (patient.claim_number || "").toLowerCase();
        const mid = (patient.mid || "").toLowerCase();

        return (
            patientName.includes(query) ||
            patientNumber.includes(query) ||
            claimNumber.includes(query) ||
            mid.includes(query)
        );
    });

    // Calculate summary totals based on filtered patients
    // All data is now stored in edi_patients (matched by backend), no need to match validation_results
    const totalClaim = filteredPatients.reduce((sum, p) => {
        const claimAmount = p.claim_amount;
        return sum + (claimAmount && claimAmount !== 0 ? claimAmount : 0);
    }, 0);

    const totalPaid = filteredPatients.reduce((sum, p) => {
        return sum + (p.paid_amount ?? 0);
    }, 0);

    const totalDifference = totalPaid - totalClaim;

    const hasAnyClaimAmount = filteredPatients.some((p) => {
        const claimAmount = p.claim_amount;
        return claimAmount != null && claimAmount !== 0;
    });

    // Format RA date for display
    const formattedRaDate = raDate
        ? new Date(raDate + "T00:00:00").toLocaleDateString()
        : null;

    return (
        <div className="space-y-4">
            {/* Header with search */}
            <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-medium flex items-center gap-1">
                    <Info className="h-4 w-4 text-blue-500" />
                    Patient Data ({filteredPatients.length}
                    {searchQuery && ` of ${patients.length}`})
                    {formattedRaDate && ` - RA Date: ${formattedRaDate}`}
                </h4>

                {/* Search input */}
                {patients.length > 1 && (
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-sm"
                        />
                    </div>
                )}
            </div>

            {/* Patient cards */}
            {filteredPatients.length > 0 ? (
                <div className="space-y-3">
                    {filteredPatients.map((patient, index) => {
                        return (
                            <PatientDataCard
                                key={index}
                                patient={patient}
                                raDate={raDate}
                                index={index}
                            />
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                        No patients found matching &quot;{searchQuery}&quot;
                    </p>
                </div>
            )}

            {/* Summary totals */}
            {showSummary && filteredPatients.length > 1 && (
                <div className="mt-4 p-4 rounded-lg border bg-primary/5">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">
                                Total Claim
                            </div>
                            <div className="text-lg font-bold">
                                {hasAnyClaimAmount ? (
                                    `$${totalClaim.toFixed(2)}`
                                ) : (
                                    <span className="text-muted-foreground">
                                        N/A
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">
                                Total Paid
                            </div>
                            <div className="text-lg font-bold">
                                ${totalPaid.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">
                                Total Difference
                            </div>
                            <div
                                className={`text-lg font-bold ${
                                    hasAnyClaimAmount
                                        ? totalDifference >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {hasAnyClaimAmount ? (
                                    `$${totalDifference.toFixed(2)}`
                                ) : (
                                    <span className="text-muted-foreground">
                                        N/A
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
