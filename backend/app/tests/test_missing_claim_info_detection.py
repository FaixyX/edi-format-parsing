"""
Test script to verify missing_claim_info error detection and retry prevention logic.
"""

import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.services.exceptions import PlaywrightError


def test_playwright_error_detection():
    """Test that PlaywrightError with missing_claim_info is detected correctly."""

    # Create a PlaywrightError with missing_claim_info error_type
    error_data = {
        "status": "error",
        "message": "Missing Claim Info: Unknown Patient Code 1619",
        "error_type": "missing_claim_info",
        "patient_message": "Unknown Patient Code 1619",
        "claim_message": "Unknown Claim Code 32",
        "patient_name": "ADJOUNIAN, GEORGE",
        "claim_range": "05/09/2025 - 06/05/2025",
        "timestamp": "2025-01-15T10:30:00",
    }

    error = PlaywrightError("Missing Claim Info: Unknown Patient Code 1619", error_data)

    # Test 1: Check error_type attribute
    print(f"Test 1 - error_type attribute: {error.error_type}")
    assert (
        error.error_type == "missing_claim_info"
    ), f"Expected 'missing_claim_info', got '{error.error_type}'"
    print("[PASS] Test 1 passed: error_type attribute is correct")

    # Test 2: Check error_data dict
    print(f"\nTest 2 - error_data dict: {error.error_data}")
    assert (
        error.error_data.get("error_type") == "missing_claim_info"
    ), "error_data dict should contain error_type"
    print("[PASS] Test 2 passed: error_data dict is correct")

    # Test 3: Simulate the detection logic from edi_billing_tasks.py
    print("\nTest 3 - Simulating detection logic:")
    structured_error_data = getattr(error, "error_data", None)
    error_type = getattr(error, "error_type", None)
    if not error_type and structured_error_data:
        error_type = structured_error_data.get("error_type")

    print(f"  - structured_error_data: {structured_error_data is not None}")
    print(f"  - error_type from attribute: {getattr(error, 'error_type', None)}")
    print(
        f"  - error_type from dict: {structured_error_data.get('error_type') if structured_error_data else None}"
    )
    print(f"  - final error_type: {error_type}")

    is_missing_claim_info = error_type == "missing_claim_info"
    print(f"  - is_missing_claim_info: {is_missing_claim_info}")

    assert is_missing_claim_info, "is_missing_claim_info should be True"
    print("[PASS] Test 3 passed: Detection logic works correctly")

    # Test 4: Check isinstance check
    print("\nTest 4 - isinstance check:")
    from app.services.playwright_bot_service import (
        PlaywrightError as ImportedPlaywrightError,
    )

    is_playwright_error = isinstance(error, ImportedPlaywrightError)
    print(f"  - isinstance(error, PlaywrightError): {is_playwright_error}")
    assert is_playwright_error, "Error should be instance of PlaywrightError"
    print("[PASS] Test 4 passed: isinstance check works")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)
    return True


def test_other_error_type():
    """Test that other error types are NOT detected as missing_claim_info."""

    error_data = {
        "status": "error",
        "message": "Login failed",
        "error_type": "login_failed",
        "timestamp": "2025-01-15T10:30:00",
    }

    error = PlaywrightError("Login failed", error_data)

    structured_error_data = getattr(error, "error_data", None)
    error_type = getattr(error, "error_type", None)
    if not error_type and structured_error_data:
        error_type = structured_error_data.get("error_type")

    is_missing_claim_info = error_type == "missing_claim_info"

    print(f"\nTest - Other error type detection:")
    print(f"  - error_type: {error_type}")
    print(f"  - is_missing_claim_info: {is_missing_claim_info}")

    assert (
        not is_missing_claim_info
    ), "login_failed should NOT be detected as missing_claim_info"
    assert error_type == "login_failed", "error_type should be login_failed"
    print("[PASS] Test passed: Other error types are correctly excluded")

    return True


if __name__ == "__main__":
    print("=" * 60)
    print("Testing missing_claim_info Error Detection Logic")
    print("=" * 60)

    try:
        test_playwright_error_detection()
        test_other_error_type()
        print("\n" + "=" * 60)
        print("[SUCCESS] ALL TESTS PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] ERROR RUNNING TESTS: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
