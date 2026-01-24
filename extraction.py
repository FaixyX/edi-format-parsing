import json
from pyx12.x12file import X12Reader
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
    INPUT_EDI = "CHA075331-R20251220-27.edi"
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

    with open(edi_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by ~
    segments = [s.strip() for s in content.split("~") if s.strip()]

    for seg in segments:
        parts = seg.split("*")
        sid = parts[0]

        # Header date
        if sid == "DTP" and parts[1] == "050":
            result["header_date"] = format_date(parts[3])

        # Provider NPI
        if sid == "NM1" and parts[1] == "85":
            result["npi"] = parts[9]

        # New patient
        if sid == "HL" and len(parts) > 3 and parts[3] == "PT":
            current_patient = {
                "name": None,
                "member_id": None,
                "trace_number": None,
                "service_dates": None,
                "amount": None,
                "status": None,
                "claim_id": None,
                "tob": None
            }
            result["patients"].append(current_patient)
            continue

        if not current_patient:
            continue

        # Patient name & member ID
        if sid == "NM1" and parts[1] == "QC":
            current_patient["name"] = f"{parts[3]}, {parts[4]}"
            current_patient["member_id"] = parts[9]

        # Trace number
        if sid == "TRN" and parts[1] == "2":
            current_patient["trace_number"] = parts[2]

        # Claim status + amount
        if sid == "STC":
            current_patient["amount"] = parts[5] if len(parts) > 5 else None
            current_patient["status"] = f"ACCEPTED {parts[3]} [{parts[1]}]"

        # Claim ID
        if sid == "REF" and parts[1] == "1K":
            current_patient["claim_id"] = parts[2] if len(parts) > 2 else None

        # TOB
        if sid == "REF" and parts[1] == "BLT":
            current_patient["tob"] = f"TOB: {parts[2]}" if len(parts) > 2 else None

        # Service dates
        if sid == "DTP" and parts[1] == "472":
            current_patient["service_dates"] = parts[3] if len(parts) > 3 else None

    return result

# Main
if __name__ == "__main__":
    INPUT_EDI = "fixed.edi"
    OUTPUT_JSON = "output.json"

    data = parse_277_manual(INPUT_EDI)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("✅ JSON created successfully")