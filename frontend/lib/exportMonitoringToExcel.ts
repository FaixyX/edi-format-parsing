import ExcelJS from "exceljs";
import { MonitoringEntryLight } from "@/types/monitoring";
import { format } from "date-fns";

interface ExcelRow {
    fileNo: number;
    raDate: string;
    postingDate: string;
    agencyName: string;
    ptName: string;
    mid: string;
    serviceDates: string;
    ptAndClaimNo: string;
    finalClaim: number | null;
    paidAmount: number;
    adjustmentAmount: number | null;
    status: string;
    remarks: string;
    sheets: string;
}

/**
 * Export monitoring data to Excel with proper formatting
 */
export async function exportMonitoringToExcel(
    entries: MonitoringEntryLight[]
): Promise<void> {
    const isAlreadyImportedMessage = (value: string): boolean => {
        const normalized = value.toLowerCase();
        return (
            normalized.includes("already been imported") ||
            normalized.includes("already imported")
        );
    };

    const isWrongAgencyMessage = (value: string): boolean => {
        const normalized = value.toLowerCase();
        return (
            normalized.includes("doesn't belong") ||
            normalized.includes("wrong agency") ||
            normalized.includes("not belong")
        );
    };

    const formatTaskFailedStatus = (message?: string): string => {
        const trimmed = (message || "").trim();
        return trimmed ? `Task Failed: ${trimmed}` : "Task Failed";
    };

    const toNumberOrNull = (value: unknown): number | null => {
        if (value === null || value === undefined) return null;
        // Handle empty strings and whitespace
        if (typeof value === "string" && value.trim() === "") return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    // Filter to only completed and failed tasks (exclude processing/pending)
    const filteredEntries = entries.filter(
        (entry) => entry.status === "completed" || entry.status === "failed"
    );

    if (filteredEntries.length === 0) {
        alert(
            "No data to export. Only completed or failed tasks are exported."
        );
        return;
    }

    // Build rows - each patient gets a row
    const rows: ExcelRow[] = [];
    let fileNo = 1;

    for (const entry of filteredEntries) {
        const raDate = entry.ra_date || "";
        // Posting date is when the task completed - only fill if task completed successfully
        const postingDate =
            entry.status === "completed" && entry.task_completed_at
                ? format(new Date(entry.task_completed_at + "Z"), "MM/dd/yyyy")
                : "";
        const agencyName = entry.agency_name || "";
        const remarks = entry.remarks || "";

        // Calculate sheets value (similar to SheetsCell component)
        let sheetsValue = "";
        if (entry.status === "completed" && entry.google_sheets_update_status) {
            const sheetsDetails = entry.google_sheets_update_details;
            if (sheetsDetails) {
                const successCount =
                    (sheetsDetails.updated || 0) + (sheetsDetails.skipped || 0);
                const totalCount =
                    sheetsDetails.total ||
                    successCount + (sheetsDetails.not_found || 0);
                if (totalCount > 0) {
                    sheetsValue = `${successCount}/${totalCount}`;
                }
            }
        }

        // Determine status based on error type
        // Handle both "completed" and "posted" status as "POSTED"
        let status = "POSTED";
        if (entry.status === "completed" || entry.status === "posted") {
            status = "POSTED";
        } else if (entry.status === "failed") {
            const errorMsg = (entry.error_message || "").trim();
            const errorMsgNormalized = errorMsg.toLowerCase();
            const alreadyImported =
                entry.already_imported ||
                isAlreadyImportedMessage(errorMsgNormalized);

            if (alreadyImported) {
                status = "Already Imported";
            }
            // Expected error: Wrong agency
            else if (isWrongAgencyMessage(errorMsgNormalized)) {
                status = errorMsg
                    ? `Error: ${errorMsg}`
                    : "Error: Wrong agency";
            } else {
                status = formatTaskFailedStatus(errorMsg);
            }
        }

        // Use only EDI patient data
        const hasEDIPatients =
            entry.edi_patients && entry.edi_patients.length > 0;

        if (hasEDIPatients && entry.edi_patients) {
            // Use EDI patient data (from file)
            for (const ediPatient of entry.edi_patients) {
                const rowStatus = entry.already_imported
                    ? "Already Imported"
                    : status;
                const ptNo = toNumberOrNull(ediPatient.patient_number);
                const claimNo = toNumberOrNull(ediPatient.claim_number);
                const ptAndClaimNo =
                    ptNo !== null && claimNo !== null
                        ? `${ptNo}-${claimNo}`
                        : ptNo !== null
                        ? String(ptNo)
                        : claimNo !== null
                        ? String(claimNo)
                        : "";
                // Format service period dates - combine into single string
                let serviceDates = "";
                if (
                    ediPatient.service_period_start ||
                    ediPatient.service_period_end
                ) {
                    const startDate = ediPatient.service_period_start
                        ? format(
                              new Date(
                                  ediPatient.service_period_start + "T00:00:00"
                              ),
                              "MM/dd/yyyy"
                          )
                        : "";
                    const endDate = ediPatient.service_period_end
                        ? format(
                              new Date(
                                  ediPatient.service_period_end + "T00:00:00"
                              ),
                              "MM/dd/yyyy"
                          )
                        : "";

                    if (startDate && endDate) {
                        serviceDates = `${startDate} - ${endDate}`;
                    } else if (startDate) {
                        serviceDates = startDate;
                    } else if (endDate) {
                        serviceDates = endDate;
                    }
                }

                rows.push({
                    fileNo,
                    raDate,
                    postingDate,
                    agencyName,
                    ptName: ediPatient.patient_name || "",
                    mid: ediPatient.mid || "",
                    serviceDates,
                    ptAndClaimNo,
                    finalClaim: ediPatient.claim_amount ?? null,
                    paidAmount: ediPatient.paid_amount ?? 0,
                    adjustmentAmount: ediPatient.adjustment_amount ?? null,
                    status: rowStatus,
                    remarks,
                    sheets: sheetsValue,
                });
            }
        } else {
            // No patient data available - add one row with file info only
            const rowStatus = entry.already_imported
                ? "Already Imported"
                : status;
            rows.push({
                fileNo,
                raDate,
                postingDate,
                agencyName,
                ptName: "",
                mid: "",
                serviceDates: "",
                ptAndClaimNo: "",
                finalClaim: null,
                paidAmount: 0,
                adjustmentAmount: null,
                status: rowStatus,
                remarks,
                sheets: sheetsValue,
            });
        }

        fileNo++;
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Monitoring Data");

    // Set column widths
    worksheet.columns = [
        { width: 7 }, // file no
        { width: 12 }, // RA Date
        { width: 12 }, // Posting date
        { width: 32 }, // Agency Name
        { width: 25 }, // PT Name
        { width: 18 }, // MID
        { width: 25 }, // Service Dates
        { width: 12 }, // PT No / Claim No (merged)
        { width: 12 }, // Final claim
        { width: 12 }, // Paid $
        { width: 12 }, // Adjustment $
        { width: 12 }, // 0-100
        { width: 12 }, // 100-300
        { width: 12 }, // 300+
        { width: 30 }, // Status
        { width: 40 }, // Remarks
        { width: 12 }, // Sheets
    ];

    // Add header row (starts at row 1)
    const headerRow = worksheet.addRow([
        "file no",
        "RA Date",
        "Posting date",
        "Agency Name",
        "PT Name",
        "MID",
        "Service Dates",
        "PT-Claim No",
        "Expected",
        "Paid $",
        "Adjustment $",
        "0-100",
        "100-300",
        "300+",
        "Status",
        "Remarks",
        "Sheets",
    ]);

    // Set fixed height for header row
    headerRow.height = 20;

    // Style header row
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FF000000" } };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
        };
    });

    // Freeze the header row so it stays visible when scrolling
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1, // Freeze first row
            topLeftCell: "A2", // Start view at first data row
            activeCell: "A2",
        },
    ];

    // Add data rows with styling
    let currentFileNo = -1;
    let isGrey = false;

    for (const row of rows) {
        // Check if this is a new file
        if (row.fileNo !== currentFileNo) {
            currentFileNo = row.fileNo;
            isGrey = !isGrey;
        }

        const hasClaimAmount = row.finalClaim != null && row.finalClaim !== 0;
        const finalClaimValue = row.finalClaim ?? 0;
        const diffValue = hasClaimAmount ? row.paidAmount - finalClaimValue : 0;
        const absDiff = Math.abs(diffValue);

        const dataRow = worksheet.addRow([
            row.fileNo,
            row.raDate,
            row.postingDate,
            row.agencyName,
            row.ptName,
            row.mid,
            row.serviceDates,
            row.ptAndClaimNo,
            row.finalClaim != null && row.finalClaim !== 0
                ? row.finalClaim
                : "",
            row.paidAmount,
            row.adjustmentAmount != null && row.adjustmentAmount !== 0
                ? row.adjustmentAmount
                : "",
            null, // 0-100
            null, // 101-400
            null, // 400+
            row.status,
            row.remarks,
            row.sheets,
        ]);

        const rowIndex = dataRow.number;
        let targetCol = 12; // default to 0-100 (column L, shifted by 1 due to MID and service dates)
        if (absDiff > 300) {
            targetCol = 14; // column N, 300+ (shifted by 1)
        } else if (absDiff > 100) {
            targetCol = 13; // column M, 100-300 (shifted by 1)
        }

        // Place difference value/formula in the correct column
        // Only calculate difference if finalClaim is available
        // Formula updated: J (Paid $) - I (Final claim) = difference
        const differenceCell = dataRow.getCell(targetCol);
        if (hasClaimAmount && typeof row.finalClaim === "number") {
            differenceCell.value = { formula: `J${rowIndex}-I${rowIndex}` };
        } else {
            differenceCell.value = "";
        }

        // Set fixed row height to prevent expansion from long remarks
        dataRow.height = 20; // Fixed height in points

        // Style each cell
        dataRow.eachCell((cell, colNumber) => {
            // Alternate rows: grey stripe and pure white
            cell.fill = isGrey
                ? {
                      type: "pattern",
                      pattern: "solid",
                      fgColor: { argb: "FFF0F0F0" },
                  }
                : {
                      type: "pattern",
                      pattern: "solid",
                      fgColor: { argb: "FFFFFFFF" }, // keep alternate rows pure white
                  };
            cell.alignment = { vertical: "middle" };
            cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            };

            // Format currency columns (I and J - Final claim and Paid $, shifted by 1 due to MID and service dates)
            if (colNumber === 9 || colNumber === 10) {
                cell.numFmt = "#0.00";
            }

            // Format difference columns (L, M, N - 0-100, 100-300, 300+, shifted by 1 due to MID and service dates)
            if (colNumber === 12 || colNumber === 13 || colNumber === 14) {
                cell.numFmt = "#0.00";
            }

            // Color code status column (O - column 15, shifted by 1 due to MID and service dates)
            if (colNumber === 15) {
                const statusValue = String(cell.value || "").toUpperCase();
                if (statusValue === "POSTED") {
                    cell.font = { color: { argb: "FF008000" }, bold: true };
                } else if (
                    statusValue.includes("ERROR") ||
                    statusValue.includes("FAILED")
                ) {
                    cell.font = { color: { argb: "FFFF0000" }, bold: true };
                }
            }

            // Set text wrapping for remarks column (P - column 16) to prevent row expansion
            if (colNumber === 16) {
                cell.alignment = {
                    ...cell.alignment,
                    wrapText: true,
                    vertical: "top", // Align to top when text wraps
                };
            }
        });

        // Explicitly style all three difference columns (L, M, N) to ensure empty cells are styled
        // Shifted by 1 due to MID and service dates column insertion
        const diffColumnNumbers = [12, 13, 14]; // L (0-100), M (100-300), N (300+)
        diffColumnNumbers.forEach((colNum) => {
            const diffCell = dataRow.getCell(colNum);
            // Ensure border and background are applied even if cell is empty
            diffCell.fill = isGrey
                ? {
                      type: "pattern",
                      pattern: "solid",
                      fgColor: { argb: "FFF0F0F0" },
                  }
                : {
                      type: "pattern",
                      pattern: "solid",
                      fgColor: { argb: "FFFFFFFF" },
                  };
            diffCell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
            };
            diffCell.numFmt = "#0.00";
            diffCell.alignment = { vertical: "middle" };
        });
    }

    // Conditional formatting for Difference columns to match sign
    const firstDataRow = 2; // data starts at row 2 (header is row 1)
    const lastRowNumber = worksheet.lastRow?.number || 0;
    if (lastRowNumber >= firstDataRow) {
        const diffColumns = ["L", "M", "N"]; // 0-100, 100-300, 300+ (shifted by 1 due to MID and service dates)
        diffColumns.forEach((col, idx) => {
            worksheet.addConditionalFormatting({
                ref: `${col}${firstDataRow}:${col}${lastRowNumber}`,
                rules: [
                    {
                        type: "cellIs",
                        operator: "greaterThan",
                        formulae: ["0"],
                        priority: idx * 2 + 1,
                        style: {
                            font: { color: { argb: "FF008000" }, bold: true },
                        },
                    },
                    {
                        type: "cellIs",
                        operator: "lessThan",
                        formulae: ["0"],
                        priority: idx * 2 + 2,
                        style: {
                            font: { color: { argb: "FFFF0000" }, bold: true },
                        },
                    },
                ],
            });
        });
    }

    // Apply auto filters to the header row
    const lastRow = worksheet.lastRow?.number || 1;
    if (lastRow > 1) {
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: lastRow, column: 17 }, // 17 columns total (A through Q)
        };
    }

    // Generate filename with current date
    const currentDate = format(new Date(), "MM/dd/yyyy");
    const filename = `EOB Report: ${currentDate}.xlsx`;

    // Create blob and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}
