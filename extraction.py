import json
from datetime import datetime

def fix_isa_line(edi_path: str, fixed_path: str):
    """
    Fixes the ISA segment to required fixed-width format
    and writes a corrected EDI file for pyx12 parsing.
    """
    with open(edi_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    if not lines or not lines[0].startswith("ISA"):
        raise ValueError("EDI file does not start with ISA segment")

    isa = lines[0].rstrip("~\n")
    parts = isa.split("*")

    # X12 fixed-width requirements
    parts[2] = parts[2].ljust(10)   # ISA02
    parts[4] = parts[4].ljust(10)   # ISA04
    parts[6] = parts[6].ljust(15)   # ISA06
    parts[8] = parts[8].ljust(15)   # ISA08

    lines[0] = "*".join(parts) + "~\n"

    with open(fixed_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
def preprocess_edi(input_file, output_file):
    """
    Preprocess EDI file:
    - Remove all newlines inside segments
    - Join broken segments (like TRN*1*141-\n1495~)
    - Trim spaces
    """
    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove line breaks
    content = content.replace("\r", "").replace("\n", "")

    # Split segments by ~ and trim
    segments = content.split("~")
    segments = [s.strip() for s in segments if s.strip()]

    # Optional: fix broken TRN values (join hyphenated numbers)
    fixed_segments = []
    for seg in segments:
        seg = seg.replace("\n", "").replace("\r", "")  # double safety
        fixed_segments.append(seg)

    # Reconstruct EDI
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("~\n".join(fixed_segments) + "~\n")


if __name__ == "__main__":
    INPUT_EDI = "CHA075331-R20251220-28.edi"
    FIXED_EDI = "fixed.edi"
    OUTPUT_JSON = "output.json"

    # Step 1: Fix ISA
    fix_isa_line(INPUT_EDI, FIXED_EDI)

    # Step 2: Clean broken segments
    preprocess_edi(FIXED_EDI, FIXED_EDI)

    print("✅ EDI fixed")


def format_date(yyyymmdd):
    return datetime.strptime(yyyymmdd, "%Y%m%d").strftime("%m/%d/%Y")

def parse_277_manual(edi_file):
    result = {
        "header_date": None,
        "npi": None,
        "patients": []
    }

    current_patient = None
    hl_level = None

    # 🔹 CLAIM-level buffers (for REF & AMT before HL*PT)
    claim_amount = None
    internal_claim_id = None
    external_claim_id = None
    tob = None

    # Read and split segments
    with open(edi_file, "r", encoding="utf-8") as f:
        segments = [s.strip() for s in f.read().replace("\n", "").split("~") if s.strip()]

    for seg in segments:
        parts = seg.split("*")
        sid = parts[0]

        # ---------------- HEADER ----------------
        if sid == "DTP" and parts[1] == "050":
            result["header_date"] = format_date(parts[3])

        if sid == "NM1" and parts[1] == "85":
            result["npi"] = parts[9]

        # ---------------- CLAIM LEVEL ----------------
        if sid == "AMT" and parts[1] == "YU":
            claim_amount = parts[2]

        # ---------------- REF handling ----------------
        if sid == "REF":
            qualifier = parts[1]
            value = parts[2]

            if current_patient:
                # Attach directly to current patient (after HL*PT)
                if qualifier == "1K":       # CAR
                    current_patient["internal_claim_id"] = value
                elif qualifier == "D9":     # Payer Claim ID
                    current_patient["claim_id"] = f"[{value}]"
                elif qualifier == "BLT":    # Type of Bill
                    current_patient["tob"] = f"TOB: {value}"
            else:
                # Buffer for claim-level data before HL*PT
                if qualifier == "1K":
                    internal_claim_id = value
                elif qualifier == "D9":
                    external_claim_id = value
                elif qualifier == "BLT":
                    tob = f"TOB: {value}"

        # ---------------- HL segment ----------------
        if sid == "HL":
            hl_level = parts[3] if len(parts) > 3 else None

            if hl_level == "PT":
                # 🔗 build claim_id once PT starts
                claim_id = None
                if internal_claim_id and external_claim_id:
                    claim_id = f"{internal_claim_id}[{external_claim_id}]"
                elif external_claim_id:
                    claim_id = f"[{external_claim_id}]"

                current_patient = {
                    "name": None,
                    "member_id": None,
                    "pt_claim": None,
                    "service_dates": None,
                    "amount": claim_amount,
                    "claim_id": claim_id,
                    "status": None,
                    "tob": tob,
                }

                result["patients"].append(current_patient)

            continue

        if not current_patient:
            continue

        # ---------------- PT-LEVEL TRN ----------------
        if sid == "TRN" and parts[1] == "2":
            current_patient["pt_claim"] = parts[2]
            continue


        # ---------------- PATIENT INFO ----------------
        if sid == "NM1" and parts[1] == "QC":
            last_name = parts[3] if len(parts) > 3 else None
            first_name = parts[4] if len(parts) > 4 else None
            current_patient["name"] = f"{last_name}, {first_name}" if last_name or first_name else None
            current_patient["member_id"] = parts[9] if len(parts) > 9 else None


        # Status
        if sid == "STC":
            code = parts[1]
            status_date = parts[2] if len(parts) > 2 else None
            readable = "ACCEPTED" if code.startswith("A") else "NOT ACCEPTED"
            current_patient["status"] = f"{readable} {status_date} [{code}]"

        # Service dates
        if sid == "DTP" and parts[1] == "472":
            current_patient["service_dates"] = parts[3]
    # 🔗 Merge internal_claim_id into claim_id
    for p in result["patients"]:
        if p.get("internal_claim_id"):
            suffix = p.get("claim_id") or ""
            p["claim_id"] = f"{p['internal_claim_id']}{suffix}"
        # Remove the old internal_claim_id field
        p.pop("internal_claim_id", None)


    return result

# Main
if __name__ == "__main__":
    INPUT_EDI = "fixed.edi"
    OUTPUT_JSON = "output.json"

    data = parse_277_manual(INPUT_EDI)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("✅ JSON created successfully")
