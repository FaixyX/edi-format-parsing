"""
Custom exceptions for the services module.
"""

# Expected error types - errors that are known and should be shown to users as-is
EXPECTED_ERROR_TYPES = {
    "edi_already_imported",  # EDI file was already imported
    "edi_wrong_agency",  # EDI file doesn't belong to this agency
}


class PlaywrightError(Exception):
    """Custom exception for Playwright operations with structured error data."""

    def __init__(self, message: str, error_data: dict):
        super().__init__(message)
        self.error_data = error_data
        self.error_type = error_data.get("error_type", "unknown")

    def is_expected_error(self) -> bool:
        """Check if this is an expected error type that should be shown to users."""
        return self.error_type in EXPECTED_ERROR_TYPES

    def to_dict(self) -> dict:
        """Convert the exception to a dictionary for JSON serialization."""
        return {
            "error_type": self.error_type,
            "message": str(self),
            "error_data": self.error_data,
        }
