import csv
import io
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.agency import Agency
from app.models.user import User
from app.schemas.agency import AgencyCreate
import logging

logger = logging.getLogger(__name__)


class CSVImportService:
    """Service for importing agencies from CSV files"""

    @staticmethod
    def normalize_string(text: str) -> str:
        """Normalize string by removing extra spaces and converting to lowercase"""
        if not text:
            return ""
        return " ".join(text.strip().split()).lower()

    @staticmethod
    def find_user_by_name(db: Session, name: str) -> Optional[User]:
        """Find user by name with case-insensitive search and space normalization"""
        if not name:
            return None

        normalized_name = CSVImportService.normalize_string(name)

        # Search for users with matching normalized names
        users = db.query(User).all()
        for user in users:
            if CSVImportService.normalize_string(user.username) == normalized_name:
                return user

        return None

    @staticmethod
    def check_agency_exists(db: Session, agency_name: str) -> bool:
        """Check if agency already exists by name (case-insensitive, space-normalized)"""
        if not agency_name:
            return False

        normalized_name = CSVImportService.normalize_string(agency_name)

        agencies = db.query(Agency).all()
        for agency in agencies:
            if CSVImportService.normalize_string(agency.name) == normalized_name:
                return True

        return False

    @staticmethod
    def determine_agency_type(type_field: str) -> str:
        """Determine if agency is paper or online based on type field"""
        if not type_field:
            return "online"

        normalized_type = CSVImportService.normalize_string(type_field)
        # Check for "db" and "synegy" (note: CSV has "SYNEGY" not "SYNERGY")
        if "db" in normalized_type and "synegy" in normalized_type:
            return "paper"
        else:
            return "online"

    @staticmethod
    def parse_csv_content(csv_content: str) -> List[Dict[str, str]]:
        """Parse CSV content and return list of dictionaries"""
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        rows = []

        for row in csv_reader:
            # Clean up the row data
            cleaned_row = {}
            for key, value in row.items():
                # Remove extra whitespace from keys and values
                clean_key = key.strip() if key else ""
                clean_value = value.strip() if value else ""
                cleaned_row[clean_key] = clean_value
            rows.append(cleaned_row)

        return rows

    @staticmethod
    def import_agencies_from_csv(db: Session, csv_content: str) -> Dict[str, any]:
        """
        Import agencies from CSV content

        Args:
            db: Database session
            csv_content: CSV file content as string

        Returns:
            Dictionary with import results
        """
        try:
            # Parse CSV content
            rows = CSVImportService.parse_csv_content(csv_content)

            if not rows:
                return {
                    "success": False,
                    "message": "No data found in CSV file",
                    "imported_count": 0,
                    "skipped_count": 0,
                    "errors": [],
                    "skipped_details": [],
                    "missing_users": [],
                }

            imported_count = 0
            skipped_count = 0
            errors = []
            skipped_details = []
            missing_users = set()

            # First pass: collect all missing users to provide helpful guidance
            for row_num, row in enumerate(rows, start=2):
                coder_name = row.get("Coding", "").strip()
                qa_name = row.get("485", "").strip()

                if coder_name:
                    coder_user = CSVImportService.find_user_by_name(db, coder_name)
                    if not coder_user:
                        missing_users.add(f"Coder: {coder_name}")

                if qa_name:
                    qa_user = CSVImportService.find_user_by_name(db, qa_name)
                    if not qa_user:
                        missing_users.add(f"QA: {qa_name}")

            # Second pass: process each row
            for row_num, row in enumerate(
                rows, start=2
            ):  # Start at 2 because row 1 is header
                try:
                    # Extract data from CSV row
                    agency_name = row.get("RIGHTEOUS HH", "").strip()
                    type_field = row.get("TYPE", "").strip()
                    coder_name = row.get("Coding", "").strip()
                    qa_name = row.get("485", "").strip()
                    agency_id = row.get("ID/Name", "").strip()
                    username = row.get("User ID", "").strip()
                    password = row.get("PASSOWRD", "").strip()
                    agency_link = row.get("AGENCY LINK", "").strip()
                    additional_notes = row.get("Additional Notes", "").strip()
                    dropbox_link = row.get("DB LINK", "").strip()

                    # Validate required fields
                    if not agency_name:
                        errors.append(f"Row {row_num}: Agency name is required")
                        continue

                    if not agency_link:
                        errors.append(f"Row {row_num}: Agency link is required")
                        continue

                    # Check if agency already exists
                    if CSVImportService.check_agency_exists(db, agency_name):
                        skipped_count += 1
                        skipped_details.append(
                            {
                                "row": row_num,
                                "agency_name": agency_name,
                                "reason": "Agency already exists in database",
                            }
                        )
                        logger.info(f"Skipping existing agency: {agency_name}")
                        continue

                    # Find coder user
                    coder_user = None
                    if coder_name:
                        coder_user = CSVImportService.find_user_by_name(db, coder_name)
                        if not coder_user:
                            errors.append(
                                f"Row {row_num}: Coder '{coder_name}' not found in database. Please add this user first."
                            )
                            continue

                    # Find QA user
                    qa_user = None
                    if qa_name:
                        qa_user = CSVImportService.find_user_by_name(db, qa_name)
                        if not qa_user:
                            errors.append(
                                f"Row {row_num}: QA user '{qa_name}' not found in database. Please add this user first."
                            )
                            continue

                    # Determine agency type
                    agency_type = CSVImportService.determine_agency_type(type_field)

                    # Create agency data
                    agency_data = AgencyCreate(
                        name=agency_name,
                        type=agency_type,
                        link=agency_link,
                        dropbox_link=dropbox_link if dropbox_link else None,
                        agency_id=agency_id if agency_id else agency_name,
                        username=username,
                        password=password,
                        coder_id=coder_user.id if coder_user else None,
                        qa_id=qa_user.id if qa_user else None,
                        additional_notes=additional_notes if additional_notes else None,
                        additional_employees=[],  # Default empty list
                        credentials_invalid=False,  # Default to False
                    )

                    # Create agency in database
                    from app.services.agency_service import create_agency

                    created_agency = create_agency(db, agency_data)

                    imported_count += 1
                    logger.info(f"Successfully imported agency: {agency_name}")

                except Exception as e:
                    error_msg = f"Row {row_num}: Error processing agency '{agency_name}' - {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
                    continue

            # Prepare result with detailed information
            result = {
                "success": len(errors) == 0,
                "message": f"Import completed. {imported_count} agencies imported, {skipped_count} skipped",
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors,
                "skipped_details": skipped_details,
                "missing_users": list(missing_users),
            }

            if errors:
                result["message"] += f", {len(errors)} errors occurred"

                # Add helpful guidance for missing users
                if missing_users:
                    result[
                        "message"
                    ] += f". Missing users: {', '.join(missing_users)}. Please add these users to the database and try again."

            return result

        except Exception as e:
            logger.error(f"Error importing agencies from CSV: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to import agencies: {str(e)}",
                "imported_count": 0,
                "skipped_count": 0,
                "errors": [str(e)],
                "skipped_details": [],
                "missing_users": [],
            }
