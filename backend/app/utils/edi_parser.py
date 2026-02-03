"""
EDI X12 Parser Utility
Extracts NPI and other relevant information from X12 EDI files (835 Remittance Advice)
"""

import re
import logging
from typing import Optional, Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)


def extract_npi_from_edi(file_content: str) -> Optional[str]:
    """
    Extract NPI from X12 EDI 835 file.

    The NPI is typically in the N1*PE segment (Payee/Provider):
    Format: N1*PE*PROVIDER NAME*XX*NPI_NUMBER

    Where:
    - N1 = Party Identification segment
    - PE = Payee (the healthcare provider)
    - XX = NPI qualifier

    Args:
        file_content: Raw EDI file content as string

    Returns:
        NPI as string or None if not found
    """
    try:
        # Pattern to match N1*PE segment with NPI
        # N1*PE*[Name]*XX*[NPI]
        pattern = r"N1\*PE\*[^*]+\*XX\*(\d{10})"

        match = re.search(pattern, file_content)
        if match:
            npi = match.group(1)
            logger.info(f"Extracted NPI: {npi}")
            return npi

        # Fallback: Try to find any XX qualifier followed by 10 digits (NPI format)
        fallback_pattern = r"\*XX\*(\d{10})"
        fallback_match = re.search(fallback_pattern, file_content)
        if fallback_match:
            npi = fallback_match.group(1)
            logger.warning(f"Extracted NPI using fallback pattern: {npi}")
            return npi

        logger.warning("No NPI found in EDI file")
        return None

    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error extracting NPI from EDI file: {type(e).__name__}")
        return None


def parse_edi_file(file_content: str) -> Dict[str, Optional[str]]:
    """
    Parse EDI file and extract key information.

    Args:
        file_content: Raw EDI file content as string

    Returns:
        Dictionary with extracted information
    """
    result = {
        "npi": None,
        "provider_name": None,
        "transaction_type": None,
        "valid": False,
    }

    try:
        # Check if it's a valid X12 file (should start with ISA)
        if not file_content.startswith("ISA"):
            logger.error("Invalid EDI file: Does not start with ISA segment")
            return result

        # Extract NPI
        result["npi"] = extract_npi_from_edi(file_content)

        # Extract provider name from N1*PE segment
        provider_pattern = r"N1\*PE\*([^*]+)\*"
        provider_match = re.search(provider_pattern, file_content)
        if provider_match:
            result["provider_name"] = provider_match.group(1).strip()

        # Extract transaction type from ST segment
        # ST*835 indicates Healthcare Claim Payment/Advice (Remittance)
        transaction_pattern = r"ST\*(\d{3})"
        transaction_match = re.search(transaction_pattern, file_content)
        if transaction_match:
            result["transaction_type"] = transaction_match.group(1)

        # Mark as valid if we found NPI
        result["valid"] = result["npi"] is not None

        return result

    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error parsing EDI file: {type(e).__name__}")
        return result


def validate_edi_file(file_content: str) -> tuple[bool, str]:
    """
    Validate EDI file structure and required fields.

    Args:
        file_content: Raw EDI file content as string

    Returns:
        Tuple of (is_valid: bool, error_message: str)
    """
    try:
        # Check if file starts with ISA
        if not file_content.startswith("ISA"):
            return False, "Invalid EDI file: Must start with ISA segment"

        # Check if file ends properly
        if not "IEA" in file_content:
            return False, "Invalid EDI file: Missing IEA segment"

        # Check for NPI
        npi = extract_npi_from_edi(file_content)
        if not npi:
            return (
                False,
                "Cannot extract NPI from file. Ensure file contains N1*PE segment with XX qualifier.",
            )

        # Validate NPI format (10 digits)
        if not re.match(r"^\d{10}$", npi):
            return False, f"Invalid NPI format: {npi}. NPI must be 10 digits."

        return True, "Valid EDI file"

    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error validating EDI file: {type(e).__name__}")
        return False, f"Validation error: {str(e)}"


def parse_date_from_edi(edi_date: str) -> Optional[str]:
    """
    Parse EDI date format (YYMMDD or CCYYMMDD) to YYYY-MM-DD format.

    Args:
        edi_date: Date string in EDI format

    Returns:
        Date string in YYYY-MM-DD format or None if invalid
    """
    try:
        if not edi_date or len(edi_date) < 6:
            return None

        # Handle YYMMDD format (6 digits)
        if len(edi_date) == 6:
            year = int(edi_date[:2])
            # Assume years 00-50 are 2000-2050, 51-99 are 1951-1999
            if year <= 50:
                year += 2000
            else:
                year += 1900
            month = edi_date[2:4]
            day = edi_date[4:6]
            return f"{year}-{month}-{day}"

        # Handle CCYYMMDD format (8 digits)
        if len(edi_date) == 8:
            return f"{edi_date[:4]}-{edi_date[4:6]}-{edi_date[6:8]}"

        return None
    except Exception as e:
        # Note: Not logging date value to protect ePHI (dates can be patient service dates)
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.warning(f"Error parsing date: {type(e).__name__}")
        return None


def extract_ra_date(file_content: str) -> Optional[str]:
    """
    Extract RA (Remittance Advice) Date from BPR segment (field 16 - Effective Entry Date).

    The BPR segment contains the effective entry date in field 16 (YYYYMMDD format).
    This is the date the payment is effective, which is the correct RA date.

    Format: BPR*...*YYYYMMDD (field 16)

    Falls back to DTM*405 segment if BPR date is not available.

    Args:
        file_content: Raw EDI file content as string

    Returns:
        RA date in YYYY-MM-DD format or None if not found
    """
    try:
        # First, try to extract from BPR segment (field 16 - Effective Entry Date)
        bpr_match = re.search(r"BPR\*([^\~]+)", file_content)
        if bpr_match:
            bpr_segment = bpr_match.group(0)
            bpr_fields = bpr_segment.split("*")
            # BPR field 16 (index 16) contains the effective entry date
            if len(bpr_fields) >= 17:
                edi_date = bpr_fields[16].strip().replace("~", "")
                # Validate it's a date format (8 digits)
                if edi_date and len(edi_date) == 8 and edi_date.isdigit():
                    parsed_date = parse_date_from_edi(edi_date)
                    if parsed_date:
                        logger.info(
                            f"Extracted RA Date from BPR segment: {parsed_date}"
                        )
                        return parsed_date

        # Fallback: Try DTM*405 segment (check/effective date)
        pattern = r"DTM\*405\*(\d{6,8})"
        match = re.search(pattern, file_content)
        if match:
            edi_date = match.group(1)
            parsed_date = parse_date_from_edi(edi_date)
            if parsed_date:
                logger.info(f"Extracted RA Date from DTM*405 segment: {parsed_date}")
                return parsed_date

        logger.warning("No RA Date found in EDI file")
        return None
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error extracting RA Date from EDI file: {type(e).__name__}")
        return None


def extract_bank_and_check(file_content: str) -> Dict[str, Optional[str]]:
    """
    Extract bank account (from BPR segment) and check/EFT number (from TRN).

    Returns a dict with:
    - bank_account: Receiving account number from the last DA qualifier in BPR
    - check_number: Reference number from TRN02
    - bank_check: Combined string "bank/check" when both exist, otherwise the
      single available value.
    """
    result = {
        "bank_account": None,
        "check_number": None,
        "bank_check": None,
    }

    try:
        # BPR segment contains bank routing/account data
        bpr_match = re.search(r"BPR\*([^\~]+)", file_content)
        if bpr_match:
            bpr_segment = bpr_match.group(0)
            bpr_fields = bpr_segment.split("*")
            da_indices = [idx for idx, val in enumerate(bpr_fields) if val == "DA"]
            if da_indices:
                last_da = da_indices[-1]
                if last_da + 1 < len(bpr_fields):
                    bank_account = bpr_fields[last_da + 1].strip().replace("~", "")
                    # Remove the last digit
                    bank_account = bank_account[:-1]
                    result["bank_account"] = bank_account or None

        # TRN segment holds the payment reference / check or EFT number
        trn_match = re.search(r"TRN\*([^\~]+)", file_content)
        if trn_match:
            trn_segment = trn_match.group(0)
            trn_fields = trn_segment.split("*")
            if len(trn_fields) >= 3:
                check_number = trn_fields[2].strip().replace("~", "")
                result["check_number"] = check_number or None

        bank = result["bank_account"]
        check = result["check_number"]
        if bank and check:
            result["bank_check"] = f"{bank}/{check}"
        elif bank:
            result["bank_check"] = bank
        elif check:
            result["bank_check"] = check

        return result
    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(
            f"Error extracting bank/check info from EDI file: {type(e).__name__}"
        )
        return result


def extract_patients_from_edi(file_content: str) -> List[Dict[str, any]]:
    """
    Extract all patient information from EDI file.

    Each CLP segment represents a patient claim. We extract:
    - Patient/Claim Number (CLP field 1)
    - Paid Amount (CLP field 4)
    - Patient Name (from following NM1*QC segment)
    - Service Period Start Date (DTM*232)
    - Service Period End Date (DTM*233)
    - Claim Received Date (DTM*050)

    Special handling for adjustments:
    - CLP segments with status code 22 or negative amounts are adjustments/reversals
    - These are merged with their corresponding claim entries (matched by patient name)
    - Adjustment amounts are stored separately in the adjustment_amount field

    Note: The final/expected claim amount is not reliably present in the EDI
    file. We leave `claim_amount` empty so it can be filled during the
    validation phase (Playwright bot) when the value is read from the website.

    Args:
        file_content: Raw EDI file content as string

    Returns:
        List of dictionaries containing patient information (with adjustments merged)
    """
    raw_patients = []

    try:
        # Split file by segment delimiter (~)
        segments = file_content.split("~")

        i = 0
        while i < len(segments):
            segment = segments[i].strip()

            # Look for CLP segment (Claim Payment/Remittance)
            # Format: CLP*claim_number*claim_status*claim_amount*paid_amount*...
            if segment.startswith("CLP*"):
                try:
                    clp_fields = segment.split("*")
                    if len(clp_fields) >= 5:
                        claim_number = clp_fields[1] if len(clp_fields) > 1 else ""
                        claim_status = clp_fields[2] if len(clp_fields) > 2 else ""
                        paid_amount_str = clp_fields[4] if len(clp_fields) > 4 else "0"

                        # Parse amounts
                        try:
                            paid_amount = (
                                float(paid_amount_str) if paid_amount_str else 0.0
                            )
                        except ValueError:
                            paid_amount = 0.0

                        # Split patient/control number if it encodes both patient and claim (e.g., "1619-3262")
                        patient_number = claim_number
                        parsed_claim_number = claim_number

                        if claim_number and (
                            "-" in claim_number or "/" in claim_number
                        ):
                            for sep in ("-", "/"):
                                if sep in claim_number:
                                    parts = claim_number.split(sep, 1)
                                    left = parts[0].strip()
                                    right = parts[1].strip() if len(parts) > 1 else ""

                                    if left:
                                        patient_number = left
                                    if right:
                                        parsed_claim_number = right
                                    break

                        # Initialize patient data
                        patient_data = {
                            "patient_number": patient_number,
                            "claim_number": parsed_claim_number,
                            "claim_status": claim_status,  # Store status code
                            # Final/expected claim amount is sourced from the portal,
                            # not the EDI file.
                            "claim_amount": None,
                            "paid_amount": paid_amount,
                            "patient_name": "",
                            "mid": None,  # Member ID from NM1*QC segment
                            "service_period_start": None,
                            "service_period_end": None,
                            "claim_received_date": None,
                            "adjustment_amount": None,  # For adjustments/reversals
                        }

                        # Look ahead for NM1*QC segment (Patient Name)
                        # NM1*QC*1*LASTNAME*FIRSTNAME*...
                        j = i + 1
                        while (
                            j < len(segments) and j < i + 10
                        ):  # Look up to 10 segments ahead
                            next_segment = segments[j].strip()
                            if next_segment.startswith("NM1*QC*"):
                                nm1_fields = next_segment.split("*")
                                if len(nm1_fields) >= 5:
                                    last_name = (
                                        nm1_fields[3] if len(nm1_fields) > 3 else ""
                                    )
                                    first_name = (
                                        nm1_fields[4] if len(nm1_fields) > 4 else ""
                                    )
                                    # Format: "LASTNAME, FIRSTNAME" or "FIRSTNAME LASTNAME"
                                    if last_name and first_name:
                                        patient_data["patient_name"] = (
                                            f"{last_name}, {first_name}"
                                        )
                                    elif last_name:
                                        patient_data["patient_name"] = last_name
                                    elif first_name:
                                        patient_data["patient_name"] = first_name

                                    # Extract MID (Member ID) from field after MI qualifier
                                    # Format: NM1*QC*1*LASTNAME*FIRSTNAME****MI*MID
                                    # Note: When splitting by *, consecutive empty fields collapse,
                                    # so **** becomes one empty field, making MI at index 8 and MID at index 9
                                    if len(nm1_fields) >= 9:
                                        # Check if field 8 (index 8) is "MI"
                                        if (
                                            nm1_fields[8].strip() == "MI"
                                            and len(nm1_fields) > 9
                                        ):
                                            mid = nm1_fields[9].strip()
                                            if mid:
                                                patient_data["mid"] = mid
                                break
                            # Stop if we hit another CLP (next patient)
                            if next_segment.startswith("CLP*"):
                                break
                            j += 1

                        # Look ahead for DTM segments (dates)
                        j = i + 1
                        while (
                            j < len(segments) and j < i + 20
                        ):  # Look up to 20 segments ahead
                            next_segment = segments[j].strip()

                            # Service period start (232)
                            if next_segment.startswith("DTM*232*"):
                                dtm_fields = next_segment.split("*")
                                if len(dtm_fields) >= 3:
                                    date_str = dtm_fields[2]
                                    patient_data["service_period_start"] = (
                                        parse_date_from_edi(date_str)
                                    )

                            # Service period end (233)
                            elif next_segment.startswith("DTM*233*"):
                                dtm_fields = next_segment.split("*")
                                if len(dtm_fields) >= 3:
                                    date_str = dtm_fields[2]
                                    patient_data["service_period_end"] = (
                                        parse_date_from_edi(date_str)
                                    )

                            # Claim received date (050)
                            elif next_segment.startswith("DTM*050*"):
                                dtm_fields = next_segment.split("*")
                                if len(dtm_fields) >= 3:
                                    date_str = dtm_fields[2]
                                    patient_data["claim_received_date"] = (
                                        parse_date_from_edi(date_str)
                                    )

                            # Stop if we hit another CLP (next patient)
                            if next_segment.startswith("CLP*"):
                                break
                            j += 1

                        raw_patients.append(patient_data)
                        # Note: Patient name and claim number intentionally not logged to protect ePHI
                        logger.debug(f"Extracted patient record {len(raw_patients)}")

                except Exception as e:
                    # Note: Only logging error type to protect ePHI that might be in error message
                    logger.warning(f"Error parsing CLP segment: {type(e).__name__}")

            i += 1

        logger.info(f"Extracted {len(raw_patients)} raw patient records from EDI file")

        # Merge adjustments with their corresponding claims
        patients = _merge_adjustments_with_claims(raw_patients)
        logger.info(f"After merging adjustments: {len(patients)} unique patients")

        return patients

    except Exception as e:
        # Note: Only logging error type to protect potential ePHI in exception message
        logger.error(f"Error extracting patients from EDI file: {type(e).__name__}")
        return []


def _merge_adjustments_with_claims(
    raw_patients: List[Dict[str, any]],
) -> List[Dict[str, any]]:
    """
    Merge adjustment/reversal entries with their corresponding claim entries.

    Adjustments are identified by:
    - Status code 22 (reversal/void)
    - Negative paid_amount values

    When an adjustment is found, we try to match it with a claim for the same patient
    and merge the adjustment amount into the claim's adjustment_amount field.

    Args:
        raw_patients: List of raw patient data with both claims and adjustments

    Returns:
        List of patient data with adjustments merged into their corresponding claims
    """
    # Separate claims and adjustments
    claims = []
    adjustments = []

    for patient in raw_patients:
        paid_amount = patient.get("paid_amount", 0.0)
        claim_status = patient.get("claim_status", "")

        # Check if this is an adjustment/reversal
        # Status code 22 = Reversal of a previous payment
        # Or negative amount indicates reversal
        is_adjustment = claim_status == "22" or paid_amount < 0

        if is_adjustment:
            adjustments.append(patient)
        else:
            claims.append(patient)

    # Match adjustments with their corresponding claims
    for adjustment in adjustments:
        adj_patient_name = adjustment.get("patient_name", "").strip().lower()
        adj_amount = adjustment.get("paid_amount", 0.0)

        # Find matching claim by patient name
        matching_claim = None
        for claim in claims:
            claim_patient_name = claim.get("patient_name", "").strip().lower()
            if claim_patient_name and claim_patient_name == adj_patient_name:
                matching_claim = claim
                break

        if matching_claim:
            # Merge adjustment into the claim
            # Add adjustment amount (could be multiple adjustments for same patient)
            # Store as positive value (absolute value)
            current_adj = matching_claim.get("adjustment_amount") or 0.0
            matching_claim["adjustment_amount"] = current_adj + abs(adj_amount)
            logger.debug(f"Merged adjustment for patient (amount: {abs(adj_amount)})")
        else:
            # No matching claim found - treat as standalone entry
            # This could happen if adjustment is for a previous file's claim
            logger.warning(
                f"Adjustment entry found with no matching claim - treating as standalone"
            )
            # Convert it to a regular entry (store adjustment as positive)
            adjustment["adjustment_amount"] = abs(adj_amount)
            adjustment["paid_amount"] = (
                0.0  # Zero out paid amount for standalone adjustments
            )
            claims.append(adjustment)

    return claims


def parse_edi_file_complete(file_content: str) -> Dict[str, any]:
    """
    Parse EDI file and extract all relevant information including patient data.

    Args:
        file_content: Raw EDI file content as string

    Returns:
        Dictionary with extracted information including:
        - npi: Provider NPI
        - provider_name: Provider name
        - transaction_type: Transaction type (e.g., "835")
        - ra_date: RA/Check date
        - patients: List of patient information
        - valid: Whether file is valid
    """
    result = {
        "npi": None,
        "provider_name": None,
        "transaction_type": None,
        "ra_date": None,
        "bank_account": None,
        "check_number": None,
        "bank_check": None,
        "patients": [],
        "valid": False,
    }

    try:
        # Check if it's a valid X12 file (should start with ISA)
        if not file_content.startswith("ISA"):
            logger.error("Invalid EDI file: Does not start with ISA segment")
            return result

        # Extract basic info
        result["npi"] = extract_npi_from_edi(file_content)

        # Extract provider name from N1*PE segment
        provider_pattern = r"N1\*PE\*([^*]+)\*"
        provider_match = re.search(provider_pattern, file_content)
        if provider_match:
            result["provider_name"] = provider_match.group(1).strip()

        # Extract transaction type from ST segment
        transaction_pattern = r"ST\*(\d{3})"
        transaction_match = re.search(transaction_pattern, file_content)
        if transaction_match:
            result["transaction_type"] = transaction_match.group(1)

        # Extract RA date
        result["ra_date"] = extract_ra_date(file_content)

        # Extract bank/check info
        bank_info = extract_bank_and_check(file_content)
        result["bank_account"] = bank_info.get("bank_account")
        result["check_number"] = bank_info.get("check_number")
        result["bank_check"] = bank_info.get("bank_check")

        # Extract patient information
        result["patients"] = extract_patients_from_edi(file_content)

        # Mark as valid if we found NPI
        result["valid"] = result["npi"] is not None

        return result

    except Exception as e:
        # Note: Only logging error type to protect ePHI that might be in error message
        logger.error(f"Error parsing EDI file: {type(e).__name__}")
        return result
