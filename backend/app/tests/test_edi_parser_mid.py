"""
Test script to verify EDI parser extracts MID correctly
"""

import sys
import os

# Add parent directory to path to import edi_parser
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.utils.edi_parser import parse_edi_file_complete

# Test file path
test_file_path = os.path.join(
    os.path.dirname(__file__), "06014-20251208-07  ATTENTIVE (1) (1).edi"
)


def test_edi_parser():
    """Test EDI parser on the provided test file"""
    print("=" * 80)
    print("Testing EDI Parser - MID Extraction")
    print("=" * 80)
    print()

    # Read the test file
    try:
        with open(test_file_path, "r", encoding="utf-8") as f:
            file_content = f.read()
    except FileNotFoundError:
        print(f"ERROR: Test file not found at: {test_file_path}")
        return False
    except Exception as e:
        print(f"ERROR: Failed to read test file: {e}")
        return False

    print(f"[OK] Successfully read test file: {os.path.basename(test_file_path)}")
    print(f"  File size: {len(file_content)} characters")
    print()

    # Parse the file
    try:
        result = parse_edi_file_complete(file_content)
    except Exception as e:
        print(f"ERROR: Failed to parse EDI file: {e}")
        import traceback

        traceback.print_exc()
        return False

    # Verify basic file info
    print("=" * 80)
    print("FILE INFORMATION")
    print("=" * 80)
    print(f"NPI: {result.get('npi', 'N/A')}")
    print(f"Provider Name: {result.get('provider_name', 'N/A')}")
    print(f"Transaction Type: {result.get('transaction_type', 'N/A')}")
    print(f"RA Date: {result.get('ra_date', 'N/A')}")
    print(f"Bank/Check: {result.get('bank_check', 'N/A')}")
    print(f"Valid: {result.get('valid', False)}")
    print()

    # Verify patients
    patients = result.get("patients", [])
    print("=" * 80)
    print(f"PATIENT INFORMATION ({len(patients)} patients found)")
    print("=" * 80)
    print()

    # Expected patients with their MIDs (from manual inspection of the file)
    expected_patients = [
        {"name": "ABEDIAN ESMAEIL, MARI", "mid": "8R90U06VN28", "claim": "842-11846"},
        {"name": "ALVAREZ RUANO, MARIA", "mid": "3NP5Q65RP81", "claim": "963-11992"},
        {"name": "ASADI, ZARRIN", "mid": "6NQ9M14TP52", "claim": "867-11988"},
        {"name": "KHALILI, EVLINE", "mid": "5N45QX2VC64", "claim": "946-11785"},
        {
            "name": "MAKI, SUSAN",
            "mid": "1P11JD8KK28",
            "claim": "923-11985",
        },  # Adjustment
        {
            "name": "MAKI, SUSAN",
            "mid": "1P11JD8KK28",
            "claim": "923-11985",
        },  # Regular claim
        {"name": "SARKISS, ALBERT", "mid": "7AX5M03EM66", "claim": "936-11933"},
    ]

    all_tests_passed = True

    for i, patient in enumerate(patients, 1):
        print(f"Patient {i}:")
        print(f"  Name: {patient.get('patient_name', 'N/A')}")
        print(f"  Patient Number: {patient.get('patient_number', 'N/A')}")
        print(f"  Claim Number: {patient.get('claim_number', 'N/A')}")
        print(f"  MID: {patient.get('mid', 'N/A')}")
        print(f"  Paid Amount: ${patient.get('paid_amount', 0):.2f}")
        print(f"  Service Period Start: {patient.get('service_period_start', 'N/A')}")
        print(f"  Service Period End: {patient.get('service_period_end', 'N/A')}")
        print(f"  Claim Received Date: {patient.get('claim_received_date', 'N/A')}")
        print(f"  Adjustment Amount: {patient.get('adjustment_amount', 'N/A')}")

        # Verify MID is present
        mid = patient.get("mid")
        if mid:
            print(f"  [OK] MID extracted: {mid}")
        else:
            print(f"  [FAIL] MID MISSING!")
            all_tests_passed = False

        # Verify patient name is present
        name = patient.get("patient_name")
        if not name:
            print(f"  [FAIL] Patient name MISSING!")
            all_tests_passed = False

        # Verify service dates are present
        service_start = patient.get("service_period_start")
        service_end = patient.get("service_period_end")
        if service_start and service_end:
            print(f"  [OK] Service dates: {service_start} to {service_end}")
        elif service_start or service_end:
            print(
                f"  [WARN] Partial service dates: start={service_start}, end={service_end}"
            )
        else:
            print(f"  [WARN] Service dates not found")

        print()

    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total patients parsed: {len(patients)}")
    print(f"Expected patients: {len(expected_patients)}")

    # Check if all expected MIDs are found
    found_mids = {p.get("mid") for p in patients if p.get("mid")}
    expected_mids = {ep["mid"] for ep in expected_patients}

    print(f"\nMID Extraction:")
    print(f"  Expected unique MIDs: {len(expected_mids)}")
    print(f"  Found unique MIDs: {len(found_mids)}")

    if found_mids == expected_mids:
        print("  [OK] All expected MIDs found!")
    else:
        missing = expected_mids - found_mids
        extra = found_mids - expected_mids
        if missing:
            print(f"  [FAIL] Missing MIDs: {missing}")
            all_tests_passed = False
        if extra:
            print(f"  [WARN] Extra MIDs found: {extra}")

    # Verify all patients have required fields
    required_fields = ["patient_name", "patient_number", "claim_number", "paid_amount"]
    for i, patient in enumerate(patients, 1):
        for field in required_fields:
            if field not in patient or patient[field] is None:
                print(f"  [FAIL] Patient {i} missing required field: {field}")
                all_tests_passed = False

    if all_tests_passed:
        print("\n[SUCCESS] ALL TESTS PASSED!")
    else:
        print("\n[FAILURE] SOME TESTS FAILED!")

    return all_tests_passed


if __name__ == "__main__":
    success = test_edi_parser()
    sys.exit(0 if success else 1)


