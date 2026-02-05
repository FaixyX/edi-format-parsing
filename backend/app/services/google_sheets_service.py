"""
Service for interacting with Google Sheets API.
Used by the bot to read and write data to Google Sheets.
"""

import logging
import time
from typing import Optional, List, Dict, Any, Callable
from sqlalchemy.orm import Session
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from app.services.google_oauth_service import GoogleOAuthService
from app.services.google_account_service import GoogleAccountService
from app.db.session import get_db
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Admin Source of Truth spreadsheet name
ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME = "BillUp Admin Source of Truth"

# Rate limiting constants
# Google Sheets API limits: 300 read and 300 write requests per minute
# Exponential backoff: 7 retries starting from 1 second, max 128 seconds
MAX_RETRIES = 7  # 7 retries = 8 total attempts (1 initial + 7 retries)
INITIAL_RETRY_DELAY = 1  # seconds
MAX_RETRY_DELAY = 128  # seconds (maximum backoff time)


class GoogleSheetsService:
    """Service for Google Sheets API operations"""

    # Cache for spreadsheet metadata to avoid repeated API calls
    _metadata_cache: Dict[str, Dict[str, Any]] = {}

    # Cache for spreadsheet listing to avoid repeated Drive API calls
    _spreadsheet_list_cache: Optional[Dict[str, Any]] = None
    _spreadsheet_list_cache_timestamp: Optional[datetime] = None
    _spreadsheet_list_cache_ttl: timedelta = timedelta(minutes=5)  # Cache for 5 minutes

    @staticmethod
    def clear_metadata_cache(spreadsheet_id: Optional[str] = None):
        """
        Clear the metadata cache for a specific spreadsheet or all spreadsheets.

        Args:
            spreadsheet_id: Optional spreadsheet ID to clear. If None, clears all cache.
        """
        if spreadsheet_id:
            if spreadsheet_id in GoogleSheetsService._metadata_cache:
                del GoogleSheetsService._metadata_cache[spreadsheet_id]
                logger.debug(f"Cleared metadata cache for spreadsheet {spreadsheet_id}")
        else:
            GoogleSheetsService._metadata_cache.clear()
            logger.debug("Cleared all metadata cache")

    @staticmethod
    def clear_spreadsheet_list_cache():
        """Clear the spreadsheet list cache."""
        GoogleSheetsService._spreadsheet_list_cache = None
        GoogleSheetsService._spreadsheet_list_cache_timestamp = None
        logger.debug("Cleared spreadsheet list cache")

    @staticmethod
    def _retry_with_backoff(func: Callable, *args, **kwargs) -> Any:
        """
        Retry a function with exponential backoff on rate limit errors (429).

        Args:
            func: Function to retry
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns: Result of the function call
        """
        last_exception = None
        delay = INITIAL_RETRY_DELAY

        for attempt in range(MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except HttpError as e:
                # Check if it's a rate limit error (429)
                # Handle both e.resp.status and checking error message for "429"
                is_rate_limit = False
                try:
                    if hasattr(e, "resp") and hasattr(e.resp, "status"):
                        is_rate_limit = e.resp.status == 429
                    elif "429" in str(e) or "RATE_LIMIT_EXCEEDED" in str(e):
                        is_rate_limit = True
                except Exception:
                    # If we can't determine, check the error message
                    if "429" in str(e) or "RATE_LIMIT_EXCEEDED" in str(e):
                        is_rate_limit = True

                if is_rate_limit:
                    last_exception = e
                    if attempt < MAX_RETRIES - 1:
                        wait_time = min(delay * (2**attempt), MAX_RETRY_DELAY)
                        logger.warning(
                            f"Rate limit exceeded (429). Retrying in {wait_time} seconds... "
                            f"(Attempt {attempt + 1}/{MAX_RETRIES})"
                        )
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(
                            f"Rate limit exceeded after {MAX_RETRIES} attempts. Giving up."
                        )
                        raise
                else:
                    # Not a rate limit error, re-raise immediately
                    raise
            except Exception as e:
                # Non-HTTP errors, re-raise immediately
                raise

        # Should never reach here, but just in case
        if last_exception:
            raise last_exception
        raise Exception("Unexpected error in retry logic")

    @staticmethod
    def _get_cached_metadata(
        db: Session, spreadsheet_id: str, force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Get spreadsheet metadata with caching to avoid repeated API calls.

        Args:
            db: Database session
            spreadsheet_id: The ID of the spreadsheet
            force_refresh: If True, bypass cache and fetch fresh data

        Returns: Spreadsheet metadata dictionary
        """
        cache_key = spreadsheet_id

        if not force_refresh and cache_key in GoogleSheetsService._metadata_cache:
            logger.debug(f"Using cached metadata for spreadsheet {spreadsheet_id}")
            return GoogleSheetsService._metadata_cache[cache_key]

        def _fetch_metadata():
            service = GoogleSheetsService.get_sheets_service(db)
            return service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()

        metadata = GoogleSheetsService._retry_with_backoff(_fetch_metadata)
        GoogleSheetsService._metadata_cache[cache_key] = metadata
        return metadata

    @staticmethod
    def is_google_account_linked(db: Session = None) -> bool:
        """Check if Google account is linked"""
        if db is None:
            db = next(get_db())
            try:
                return GoogleAccountService.is_account_linked(db)
            finally:
                db.close()
        else:
            return GoogleAccountService.is_account_linked(db)

    @staticmethod
    def get_sheets_service(db: Session):
        """
        Get authenticated Google Sheets API service.
        Returns: Google Sheets API service object
        """
        credentials = GoogleOAuthService.get_valid_credentials(db)
        if not credentials:
            raise ValueError(
                "No valid Google credentials available. Please link a Google account."
            )

        return build("sheets", "v4", credentials=credentials)

    @staticmethod
    def list_spreadsheets(
        db: Session, force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        """
        List all spreadsheets in the Google account.
        Uses caching to avoid repeated Drive API calls.

        Args:
            db: Database session
            force_refresh: If True, bypass cache and fetch fresh data

        Returns: List of spreadsheet metadata
        """
        try:
            # Check cache first
            now = datetime.now()
            if (
                not force_refresh
                and GoogleSheetsService._spreadsheet_list_cache is not None
                and GoogleSheetsService._spreadsheet_list_cache_timestamp is not None
                and (now - GoogleSheetsService._spreadsheet_list_cache_timestamp)
                < GoogleSheetsService._spreadsheet_list_cache_ttl
            ):
                logger.debug("Using cached spreadsheet list")
                return GoogleSheetsService._spreadsheet_list_cache.copy()

            drive_service = build(
                "drive", "v3", credentials=GoogleOAuthService.get_valid_credentials(db)
            )

            all_spreadsheets = []
            page_token = None

            # Fetch all spreadsheets with pagination (Google Drive API max pageSize is 1000)
            while True:
                request_params = {
                    "q": "mimeType='application/vnd.google-apps.spreadsheet'",
                    "fields": "files(id, name, createdTime, modifiedTime), nextPageToken",
                    "pageSize": 1000,  # Maximum allowed by Google Drive API
                }

                if page_token:
                    request_params["pageToken"] = page_token

                results = drive_service.files().list(**request_params).execute()

                spreadsheets = results.get("files", [])
                all_spreadsheets.extend(spreadsheets)

                # Check if there are more pages
                page_token = results.get("nextPageToken")
                if not page_token:
                    break

            logger.info(f"Found {len(all_spreadsheets)} spreadsheets")

            # Update cache
            GoogleSheetsService._spreadsheet_list_cache = all_spreadsheets.copy()
            GoogleSheetsService._spreadsheet_list_cache_timestamp = now

            return all_spreadsheets


        except HttpError as e:
            error_details = str(e)
            # Check for insufficient permissions error
            if (
                "insufficientPermissions" in error_details
                or "insufficient authentication scopes" in error_details.lower()
            ):
                logger.error(
                    f"Failed to list spreadsheets: Insufficient permissions. "
                    f"The Google account needs to be re-authenticated with Drive API scope. "
                    f"Please unlink and re-link your Google account in the settings."
                )
                raise ValueError(
                    "Insufficient permissions: Google account needs to be re-authenticated. "
                    "Please unlink and re-link your Google account in the settings to grant Drive API access."
                ) from e
            logger.error(f"Failed to list spreadsheets: {error_details}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error listing spreadsheets: {str(e)}")
            raise

    @staticmethod
    def read_sheet(
        db: Session, spreadsheet_id: str, range_name: str
    ) -> List[List[Any]]:
        """
        Read data from a sheet with automatic retry on rate limits.

        Args:
            spreadsheet_id: The ID of the spreadsheet
            range_name: A1 notation range (e.g., "Sheet1!A1:C10")

        Returns: 2D list of values
        """
        try:

            def _read():
                service = GoogleSheetsService.get_sheets_service(db)
                return (
                    service.spreadsheets()
                    .values()
                    .get(spreadsheetId=spreadsheet_id, range=range_name)
                    .execute()
                )

            result = GoogleSheetsService._retry_with_backoff(_read)
            values = result.get("values", [])
            logger.info(f"Read {len(values)} rows from {range_name}")
            return values

        except HttpError as e:
            logger.error(f"Failed to read sheet: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error reading sheet: {str(e)}")
            raise

    @staticmethod
    def write_to_sheet(
        db: Session,
        spreadsheet_id: str,
        range_name: str,
        values: List[List[Any]],
        value_input_option: str = "RAW",
    ) -> Dict[str, Any]:
        """
        Write data to a sheet with automatic retry on rate limits.

        Args:
            spreadsheet_id: The ID of the spreadsheet
            range_name: A1 notation range (e.g., "Sheet1!A1")
            values: 2D list of values to write
            value_input_option: "RAW" or "USER_ENTERED"

        Returns: Update response
        """
        try:

            def _write():
                service = GoogleSheetsService.get_sheets_service(db)
                body = {"values": values}
                return (
                    service.spreadsheets()
                    .values()
                    .update(
                        spreadsheetId=spreadsheet_id,
                        range=range_name,
                        valueInputOption=value_input_option,
                        body=body,
                    )
                    .execute()
                )

            result = GoogleSheetsService._retry_with_backoff(_write)
            logger.info(f"Updated {result.get('updatedCells')} cells in {range_name}")
            return result

        except HttpError as e:
            logger.error(f"Failed to write to sheet: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error writing to sheet: {str(e)}")
            raise

    @staticmethod
    def append_to_sheet(
        db: Session,
        spreadsheet_id: str,
        range_name: str,
        values: List[List[Any]],
        value_input_option: str = "RAW",
    ) -> Dict[str, Any]:
        """
        Append data to a sheet with automatic retry on rate limits.

        Args:
            spreadsheet_id: The ID of the spreadsheet
            range_name: A1 notation range (e.g., "Sheet1!A1:G1")
            values: 2D list of values to append
            value_input_option: "RAW" or "USER_ENTERED"

        Returns: Append response
        """
        try:

            def _append():
                service = GoogleSheetsService.get_sheets_service(db)
                body = {"values": values}
                return (
                    service.spreadsheets()
                    .values()
                    .append(
                        spreadsheetId=spreadsheet_id,
                        range=range_name,
                        valueInputOption=value_input_option,
                        insertDataOption="INSERT_ROWS",
                        body=body,
                    )
                    .execute()
                )

            result = GoogleSheetsService._retry_with_backoff(_append)
            logger.info(f"Appended {len(values)} rows to {range_name}")
            return result

        except HttpError as e:
            logger.error(f"Failed to append to sheet: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error appending to sheet: {str(e)}")
            raise

    @staticmethod
    def batch_update(
        db: Session,
        spreadsheet_id: str,
        updates: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Perform batch update operations on a sheet with automatic retry on rate limits.

        Args:
            spreadsheet_id: The ID of the spreadsheet
            updates: List of update requests (see Google Sheets API docs)

        Returns: Batch update response
        """
        try:

            def _batch_update():
                service = GoogleSheetsService.get_sheets_service(db)
                body = {"requests": updates}
                return (
                    service.spreadsheets()
                    .batchUpdate(spreadsheetId=spreadsheet_id, body=body)
                    .execute()
                )

            result = GoogleSheetsService._retry_with_backoff(_batch_update)
            logger.info(f"Performed batch update with {len(updates)} requests")
            return result

        except HttpError as e:
            logger.error(f"Failed to batch update sheet: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in batch update: {str(e)}")
            raise

    @staticmethod
    def find_spreadsheet_by_name_pattern(
        db: Session, name_pattern: str
    ) -> Optional[Dict[str, Any]]:
        """
        Find a spreadsheet by name pattern and return the first sheet tab.
        The pattern can appear anywhere in the spreadsheet name (beginning, middle, or end).

        This method searches the spreadsheet NAME (not sheet tab names) and uses the first sheet tab.

        Args:
            db: Database session
            name_pattern: Pattern to match in spreadsheet name (e.g., "1750587804" or "-1750587804")

        Returns: Dictionary with spreadsheet_id and sheet_name (first tab), or None if not found
        """
        try:
            spreadsheets = GoogleSheetsService.list_spreadsheets(db)

            for spreadsheet in spreadsheets:
                spreadsheet_id = spreadsheet.get("id")
                spreadsheet_name = spreadsheet.get("name", "")

                if not spreadsheet_id:
                    continue

                # Check if spreadsheet name contains the pattern anywhere
                if name_pattern in spreadsheet_name:
                    # Get all sheets in this spreadsheet using cached metadata
                    spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                        db, spreadsheet_id
                    )

                    sheets = spreadsheet_metadata.get("sheets", [])
                    if not sheets:
                        logger.warning(
                            f"Spreadsheet '{spreadsheet_name}' ({spreadsheet_id}) has no sheets"
                        )
                        continue

                    # Use the first sheet tab
                    first_sheet = sheets[0]
                    sheet_properties = first_sheet.get("properties", {})
                    sheet_name = sheet_properties.get("title", "")

                    logger.info(
                        f"Found spreadsheet '{spreadsheet_name}' ({spreadsheet_id}) with first sheet '{sheet_name}' matching pattern '{name_pattern}'"
                    )
                    return {
                        "spreadsheet_id": spreadsheet_id,
                        "sheet_name": sheet_name,
                    }

            logger.warning(
                f"No spreadsheet found with name containing '{name_pattern}'"
            )
            return None

        except ValueError as e:
            # Re-raise ValueError (e.g., insufficient permissions) with helpful message
            logger.error(f"Failed to find spreadsheet by pattern: {str(e)}")
            raise
        except HttpError as e:
            logger.error(f"Failed to find spreadsheet by pattern: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error finding spreadsheet: {str(e)}")
            raise

    @staticmethod
    def find_row_by_column_value(
        db: Session,
        spreadsheet_id: str,
        sheet_name: str,
        column: str,
        search_value: str,
        pre_read_values: Optional[List[List[Any]]] = None,
    ) -> Optional[int]:
        """
        Search for a value in a specific column and return the row number (1-indexed).
        Can use pre-read values to avoid additional API calls.

        Args:
            db: Database session
            spreadsheet_id: The ID of the spreadsheet
            sheet_name: Name of the sheet
            column: Column letter (e.g., "C")
            search_value: Value to search for
            pre_read_values: Optional pre-read column values to avoid API call

        Returns: Row number (1-indexed) if found, None otherwise
        """
        try:
            # Use pre-read values if provided, otherwise read from API
            if pre_read_values is not None:
                values = pre_read_values
                logger.debug(f"Using pre-read values for column {column} search")
            else:
                # Read all values from the column
                range_name = f"{sheet_name}!{column}:{column}"
                values = GoogleSheetsService.read_sheet(db, spreadsheet_id, range_name)

            # Search for the value (case-insensitive, trimmed)
            search_value_clean = str(search_value).strip().lower()
            for index, row in enumerate(values, start=1):
                if row and len(row) > 0:
                    cell_value = str(row[0]).strip().lower()
                    if cell_value == search_value_clean:
                        logger.info(
                            f"Found '{search_value}' in column {column} at row {index}"
                        )
                        return index

            logger.debug(f"Value '{search_value}' not found in column {column}")
            return None

        except HttpError as e:
            logger.error(f"Failed to search column for value: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error searching column: {str(e)}")
            raise

    @staticmethod
    def _batch_update_cells_with_fill(
        db: Session,
        spreadsheet_id: str,
        sheet_name: str,
        updates: List[Dict[str, Any]],
    ) -> bool:
        """
        Batch update multiple cells with values and fill colors using a single API call.
        Uses updateCells to update both values and formatting in one request.

        Args:
            db: Database session
            spreadsheet_id: The ID of the spreadsheet
            sheet_name: Name of the sheet
            updates: List of dicts with keys: row (int), column (str), value (Any), fill_color (dict)

        Returns: True if successful
        """
        if not updates:
            return True

        try:
            service = GoogleSheetsService.get_sheets_service(db)

            # Get sheet ID from cached metadata
            spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                db, spreadsheet_id
            )

            sheet_id = None
            for sheet in spreadsheet_metadata.get("sheets", []):
                if sheet.get("properties", {}).get("title") == sheet_name:
                    sheet_id = sheet.get("properties", {}).get("sheetId")
                    break

            if sheet_id is None:
                logger.warning(
                    f"Sheet '{sheet_name}' not found in spreadsheet, cannot batch update"
                )
                return False

            # Build updateCells requests - one per cell, but all in a single batchUpdate call
            # This allows us to update both value and formatting in one API call
            update_requests = []
            for update in updates:
                row = update["row"]
                column = update["column"]
                value = update["value"]
                fill_color = update.get("fill_color")
                col_index = ord(column.upper()) - ord("A")

                # Build cell data with both value and formatting
                cell_data = {}

                # Add value
                if value is not None:
                    # Convert value to appropriate type for Google Sheets API
                    if isinstance(value, (int, float)):
                        cell_data["userEnteredValue"] = {"numberValue": value}
                    elif isinstance(value, bool):
                        cell_data["userEnteredValue"] = {"boolValue": value}
                    elif isinstance(value, str):
                        cell_data["userEnteredValue"] = {"stringValue": value}
                    else:
                        # Default to string representation
                        cell_data["userEnteredValue"] = {"stringValue": str(value)}

                # Add formatting if fill_color is provided
                if fill_color:
                    cell_data["userEnteredFormat"] = {
                        "backgroundColor": fill_color,
                    }

                # Determine which fields to update
                fields = []
                if "userEnteredValue" in cell_data:
                    fields.append("userEnteredValue")
                if "userEnteredFormat" in cell_data:
                    fields.append("userEnteredFormat.backgroundColor")

                # Create updateCells request for this cell
                update_requests.append(
                    {
                        "updateCells": {
                            "range": {
                                "sheetId": sheet_id,
                                "startRowIndex": row - 1,  # Convert to 0-based
                                "endRowIndex": row,
                                "startColumnIndex": col_index,
                                "endColumnIndex": col_index + 1,
                            },
                            "rows": [{"values": [cell_data]}],
                            "fields": ",".join(fields),
                        }
                    }
                )

            if update_requests:

                def _batch_update_cells():
                    return (
                        service.spreadsheets()
                        .batchUpdate(
                            spreadsheetId=spreadsheet_id,
                            body={"requests": update_requests},
                        )
                        .execute()
                    )

                GoogleSheetsService._retry_with_backoff(_batch_update_cells)
                logger.info(
                    f"Batch updated {len(updates)} cells (values and formatting) in sheet '{sheet_name}' with 1 API call"
                )

            return True

        except Exception as e:
            logger.error(f"Failed to batch update cells: {str(e)}")
            return False

    @staticmethod
    def update_cell_with_green_fill(
        db: Session,
        spreadsheet_id: str,
        sheet_name: str,
        row: int,
        column: str,
        value: Any,
    ) -> bool:
        """
        Update a cell value and set its fill color based on the value.
        - Green if paid amount is non-zero
        - Orange if paid amount is zero
        Uses cached metadata to avoid repeated API calls.
        Returns True if the value was updated (even if color formatting fails).

        Args:
            db: Database session
            spreadsheet_id: The ID of the spreadsheet
            sheet_name: Name of the sheet
            row: Row number (1-indexed)
            column: Column letter (e.g., "D")
            value: Value to set in the cell (paid amount)

        Returns: True if value was updated successfully (color formatting is best-effort)
        """
        value_updated = False
        try:
            service = GoogleSheetsService.get_sheets_service(db)

            # First, update the cell value with retry logic
            def _update_cell():
                cell_range = f"{sheet_name}!{column}{row}"
                body = {"values": [[value]]}
                return (
                    service.spreadsheets()
                    .values()
                    .update(
                        spreadsheetId=spreadsheet_id,
                        range=cell_range,
                        valueInputOption="USER_ENTERED",
                        body=body,
                    )
                    .execute()
                )

            GoogleSheetsService._retry_with_backoff(_update_cell)
            value_updated = True  # Mark that value update succeeded

            # Determine color based on value: orange for $0, green for non-zero
            try:
                # Convert value to float to check if it's zero
                is_zero = False
                try:
                    value_float = float(value)
                    is_zero = value_float == 0.0
                except (ValueError, TypeError):
                    # If value can't be converted to float, check string representation
                    value_str = str(value).strip()
                    is_zero = value_str == "" or value_str == "0" or value_str == "0.0"

                # Orange color for $0, green for non-zero
                # Orange in RGB: (1, 0.65, 0) normalized to 0-1 range
                # Green color in RGB: (0, 1, 0) normalized to 0-1 range
                if is_zero:
                    fill_color = {"red": 1.0, "green": 0.65, "blue": 0.0}  # Orange
                    color_name = "orange"
                else:
                    fill_color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green
                    color_name = "green"

            except Exception as e:
                # If we can't determine the value, default to green
                logger.warning(
                    f"Could not determine if value '{value}' is zero, defaulting to green: {str(e)}"
                )
                fill_color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green
                color_name = "green"

            # Then, set the fill color (best-effort, don't fail if this fails)
            try:
                # Use cached metadata to avoid repeated API calls
                spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                    db, spreadsheet_id
                )

                sheet_id = None
                for sheet in spreadsheet_metadata.get("sheets", []):
                    if sheet.get("properties", {}).get("title") == sheet_name:
                        sheet_id = sheet.get("properties", {}).get("sheetId")
                        break

                if sheet_id is None:
                    logger.warning(
                        f"Sheet '{sheet_name}' not found in spreadsheet, skipping color formatting"
                    )
                    # Value was updated, so return True
                    return True

                # Create batch update request for formatting
                requests = [
                    {
                        "repeatCell": {
                            "range": {
                                "sheetId": sheet_id,
                                "startRowIndex": row - 1,  # 0-indexed
                                "endRowIndex": row,
                                "startColumnIndex": ord(column.upper())
                                - ord("A"),  # Convert column letter to index
                                "endColumnIndex": ord(column.upper()) - ord("A") + 1,
                            },
                            "cell": {
                                "userEnteredFormat": {
                                    "backgroundColor": fill_color,
                                }
                            },
                            "fields": "userEnteredFormat.backgroundColor",
                        }
                    }
                ]

                def _batch_update():
                    return (
                        service.spreadsheets()
                        .batchUpdate(
                            spreadsheetId=spreadsheet_id, body={"requests": requests}
                        )
                        .execute()
                    )

                GoogleSheetsService._retry_with_backoff(_batch_update)
                logger.info(
                    f"Updated cell {column}{row} with value '{value}' and {color_name} fill color"
                )
            except Exception as color_error:
                # Color formatting failed, but value was updated
                logger.warning(
                    f"Updated cell {column}{row} with value '{value}', but failed to set {color_name} fill: {str(color_error)}"
                )
                # Still return True since the value was updated successfully

            return True

        except HttpError as e:
            if value_updated:
                # Value was updated but something else failed
                logger.warning(
                    f"Cell value was updated but encountered error: {str(e)}"
                )
                return True
            logger.error(f"Failed to update cell with fill color: {str(e)}")
            raise
        except Exception as e:
            if value_updated:
                # Value was updated but something else failed
                logger.warning(
                    f"Cell value was updated but encountered error: {str(e)}"
                )
                return True
            logger.error(f"Unexpected error updating cell: {str(e)}")
            raise

    @staticmethod
    def update_patient_paid_amounts_in_sheet(
        db: Session,
        npi: str,
        patients: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Update Google Sheets with paid amounts for patients.

        For each patient:
        1. Find spreadsheet with name containing the NPI value (searches spreadsheet name, not sheet tab name)
        2. Use the first sheet tab in that spreadsheet
        3. Search column C for "{patient_number}-{claim_number}"
        4. Update column E with paid_amount and set green fill color
        5. Skip patients with non-empty adjustment_amount

        Args:
            db: Database session
            npi: Agency NPI (e.g., "1750587804")
            patients: List of patient dictionaries with:
                - patient_number
                - claim_number
                - paid_amount
                - adjustment_amount (optional)

        Returns: Dictionary with update statistics
        """
        try:
            # Find spreadsheet by name pattern (spreadsheet name, not sheet tab name)
            # Search for NPI value anywhere in the spreadsheet name
            name_pattern = str(npi)
            spreadsheet_info = GoogleSheetsService.find_spreadsheet_by_name_pattern(
                db, name_pattern
            )

            if not spreadsheet_info:
                logger.warning(
                    f"No spreadsheet found with name containing '{name_pattern}'"
                )
                return {
                    "success": False,
                    "message": f"No spreadsheet found with name containing '{name_pattern}'",
                    "updated": 0,
                    "skipped": 0,
                    "not_found": 0,
                }

            spreadsheet_id = spreadsheet_info["spreadsheet_id"]
            sheet_name = spreadsheet_info["sheet_name"]

            updated_count = 0
            skipped_count = 0
            not_found_count = 0

            # OPTIMIZATION: Read column C once for all patients instead of per-patient reads
            logger.info(
                f"Reading column C from sheet '{sheet_name}' once for batch processing"
            )
            range_name = f"{sheet_name}!C:C"
            column_c_values = GoogleSheetsService.read_sheet(
                db, spreadsheet_id, range_name
            )

            # Collect all updates to batch process
            batch_updates = []

            # Process each patient and collect updates
            for patient in patients:
                # Skip if adjustment_amount is not empty
                # Handle various zero representations: 0, 0.0, "0", "0.0", etc.
                adjustment_amount = patient.get("adjustment_amount")
                should_skip = False
                if adjustment_amount is not None:
                    # Convert to float if possible to handle string "0" cases
                    try:
                        adj_float = float(adjustment_amount)
                        should_skip = adj_float != 0.0
                    except (ValueError, TypeError):
                        # If not numeric, check if it's a non-empty string
                        if isinstance(adjustment_amount, str):
                            should_skip = (
                                adjustment_amount.strip() != ""
                                and adjustment_amount.strip() != "0"
                            )
                        else:
                            # For other types, skip if truthy
                            should_skip = bool(adjustment_amount)

                if should_skip:
                    logger.debug(
                        f"Skipping patient {patient.get('patient_number')} - has adjustment_amount: {adjustment_amount}"
                    )
                    skipped_count += 1
                    continue

                patient_number = patient.get("patient_number", "")
                claim_number = patient.get("claim_number", "")
                paid_amount = patient.get("paid_amount")

                if not patient_number or not claim_number:
                    logger.warning(
                        f"Skipping patient - missing patient_number or claim_number"
                    )
                    skipped_count += 1
                    continue

                # Search for "{patient_number}-{claim_number}" in column C using pre-read values
                search_value = f"{patient_number}-{claim_number}"
                row = GoogleSheetsService.find_row_by_column_value(
                    db,
                    spreadsheet_id,
                    sheet_name,
                    "C",
                    search_value,
                    pre_read_values=column_c_values,
                )

                if not row:
                    logger.warning(
                        f"Patient {search_value} not found in column C of sheet '{sheet_name}'"
                    )
                    not_found_count += 1
                    continue

                # Determine fill color based on paid_amount value
                try:
                    # Convert value to float to check if it's zero
                    is_zero = False
                    try:
                        value_float = float(paid_amount)
                        is_zero = value_float == 0.0
                    except (ValueError, TypeError):
                        # If value can't be converted to float, check string representation
                        value_str = str(paid_amount).strip()
                        is_zero = (
                            value_str == "" or value_str == "0" or value_str == "0.0"
                        )

                    # Orange color for $0, green for non-zero
                    if is_zero:
                        fill_color = {"red": 1.0, "green": 0.65, "blue": 0.0}  # Orange
                    else:
                        fill_color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green
                except Exception:
                    # Default to green if we can't determine
                    fill_color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green

                # Add to batch updates
                batch_updates.append(
                    {
                        "row": row,
                        "column": "E",
                        "value": paid_amount,
                        "fill_color": fill_color,
                        "patient_info": search_value,  # For logging
                    }
                )

            # OPTIMIZATION: Batch update all cells in 2 API calls instead of 2N calls
            if batch_updates:
                try:
                    success = GoogleSheetsService._batch_update_cells_with_fill(
                        db, spreadsheet_id, sheet_name, batch_updates
                    )
                    if success:
                        updated_count = len(batch_updates)
                        logger.info(
                            f"Batch updated {updated_count} patients in sheet '{sheet_name}' "
                            f"(reduced from {updated_count * 2} API calls to 2 API calls)"
                        )
                    else:
                        # Fallback to individual updates if batch fails
                        logger.warning(
                            f"Batch update failed, falling back to individual updates"
                        )
                        for update in batch_updates:
                            try:
                                success = (
                                    GoogleSheetsService.update_cell_with_green_fill(
                                        db,
                                        spreadsheet_id,
                                        sheet_name,
                                        update["row"],
                                        update["column"],
                                        update["value"],
                                    )
                                )
                                if success:
                                    updated_count += 1
                                else:
                                    not_found_count += 1
                            except Exception as e:
                                logger.error(
                                    f"Failed to update patient {update.get('patient_info')} at row {update['row']}: {str(e)}"
                                )
                                not_found_count += 1
                except Exception as e:
                    logger.error(f"Failed to batch update patients: {str(e)}")
                    # Fallback to individual updates
                    for update in batch_updates:
                        try:
                            success = GoogleSheetsService.update_cell_with_green_fill(
                                db,
                                spreadsheet_id,
                                sheet_name,
                                update["row"],
                                update["column"],
                                update["value"],
                            )
                            if success:
                                updated_count += 1
                            else:
                                not_found_count += 1
                        except Exception as fallback_error:
                            logger.error(
                                f"Failed to update patient {update.get('patient_info')} at row {update['row']}: {str(fallback_error)}"
                            )
                            not_found_count += 1

            result = {
                "success": True,
                "spreadsheet_id": spreadsheet_id,
                "sheet_name": sheet_name,
                "updated": updated_count,
                "skipped": skipped_count,
                "not_found": not_found_count,
                "total": len(patients),
            }

            logger.info(
                f"Updated Google Sheets: {updated_count} updated, {skipped_count} skipped, {not_found_count} not found"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to update patient paid amounts in sheet: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "updated": 0,
                "skipped": 0,
                "not_found": 0,
            }

    @staticmethod
    def update_billing_task_sheet(
        db: Session,
        spreadsheet_id: str,
        sheet_name: str,
        task_data: Dict[str, Any],
    ) -> bool:
        """
        Update the billing tasks tracking sheet with new task data.
        This is a convenience method for the bot to log task results.

        Args:
            spreadsheet_id: The ID of the spreadsheet
            sheet_name: Name of the sheet (e.g., "Sheet1")
            task_data: Dictionary with task information

        Returns: True if successful
        """
        try:
            # Prepare row data
            row_data = [
                task_data.get("task_id", ""),
                task_data.get("agency_name", ""),
                task_data.get("filename", ""),
                task_data.get("status", ""),
                task_data.get("completed_at", ""),
                task_data.get("patient_count", ""),
                task_data.get("total_amount", ""),
                task_data.get("notes", ""),
            ]

            # Append to sheet
            range_name = f"{sheet_name}!A:H"  # Columns A through H
            GoogleSheetsService.append_to_sheet(
                db=db,
                spreadsheet_id=spreadsheet_id,
                range_name=range_name,
                values=[row_data],
                value_input_option="USER_ENTERED",
            )

            logger.info(
                f"Updated billing task sheet for task: {task_data.get('task_id')}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to update billing task sheet: {str(e)}")
            return False

    @staticmethod
    def create_spreadsheet(db: Session, title: str) -> Optional[str]:
        """
        Create a new Google Spreadsheet with the given title.

        Args:
            db: Database session
            title: The title/name of the spreadsheet

        Returns: Spreadsheet ID if successful, None otherwise
        """
        try:
            credentials = GoogleOAuthService.get_valid_credentials(db)
            if not credentials:
                raise ValueError(
                    "No valid Google credentials available. Please link a Google account."
                )

            # Use Drive API to create the spreadsheet
            drive_service = build("drive", "v3", credentials=credentials)

            # Create spreadsheet metadata
            file_metadata = {
                "name": title,
                "mimeType": "application/vnd.google-apps.spreadsheet",
            }

            # Create the spreadsheet
            file = (
                drive_service.files()
                .create(body=file_metadata, fields="id, name")
                .execute()
            )

            spreadsheet_id = file.get("id")
            logger.info(f"Created new spreadsheet '{title}' with ID: {spreadsheet_id}")

            # Clear spreadsheet list cache since we added a new spreadsheet
            GoogleSheetsService.clear_spreadsheet_list_cache()

            return spreadsheet_id

        except HttpError as e:
            error_details = str(e)
            # Check for insufficient permissions error
            if (
                "insufficientPermissions" in error_details
                or "insufficient authentication scopes" in error_details.lower()
            ):
                logger.error(
                    f"Failed to create spreadsheet: Insufficient permissions. "
                    f"The Google account needs to be re-authenticated with Drive API write scope. "
                    f"Please unlink and re-link your Google account in the settings."
                )
                raise ValueError(
                    "Insufficient permissions: Google account needs to be re-authenticated with Drive API write access. "
                    "Please unlink and re-link your Google account in the settings."
                ) from e
            logger.error(f"Failed to create spreadsheet: {error_details}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating spreadsheet: {str(e)}")
            raise

    @staticmethod
    def find_or_get_admin_spreadsheet(db: Session) -> Optional[str]:
        """
        Find the admin source of truth spreadsheet by name, or create it if it doesn't exist.
        Returns the spreadsheet ID if found or created, None otherwise.

        Args:
            db: Database session

        Returns: Spreadsheet ID or None
        """
        try:
            spreadsheets = GoogleSheetsService.list_spreadsheets(db)

            for spreadsheet in spreadsheets:
                spreadsheet_name = spreadsheet.get("name", "")
                if spreadsheet_name == ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME:
                    spreadsheet_id = spreadsheet.get("id")
                    logger.info(
                        f"Found admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}' with ID: {spreadsheet_id}"
                    )
                    return spreadsheet_id

            # Spreadsheet not found, create it
            logger.info(
                f"Admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}' not found. Creating it now..."
            )
            try:
                spreadsheet_id = GoogleSheetsService.create_spreadsheet(
                    db, ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME
                )
                if spreadsheet_id:
                    logger.info(
                        f"Successfully created admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}' with ID: {spreadsheet_id}"
                    )
                    return spreadsheet_id
                else:
                    logger.error(
                        f"Failed to create admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}'"
                    )
                    return None
            except Exception as create_error:
                logger.error(
                    f"Failed to create admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}': {str(create_error)}"
                )
                return None

        except Exception as e:
            logger.error(f"Failed to find or create admin spreadsheet: {str(e)}")
            return None

    @staticmethod
    def get_week_range(date: datetime) -> str:
        """
        Get the week range string for a given date (e.g., "09/01-09/07").
        Week starts on Monday and ends on Sunday.

        Args:
            date: The date to get the week range for

        Returns: Week range string in format "MM/DD-MM/DD"
        """
        # Get Monday of the week (weekday 0 = Monday)
        days_since_monday = date.weekday()
        monday = date - timedelta(days=days_since_monday)
        sunday = monday + timedelta(days=6)

        # Format as MM/DD-MM/DD
        return f"{monday.strftime('%m/%d')}-{sunday.strftime('%m/%d')}"

    @staticmethod
    def get_or_create_weekly_sheet(
        db: Session, spreadsheet_id: str, date: datetime
    ) -> str:
        """
        Get or create a weekly sheet tab for the given date.
        Sheet name format: "09/01-09/07" (MM/DD-MM/DD)

        Args:
            db: Database session
            spreadsheet_id: The ID of the spreadsheet
            date: The date to get/create the sheet for

        Returns: Sheet name (tab name)
        """
        try:
            service = GoogleSheetsService.get_sheets_service(db)
            sheet_name = GoogleSheetsService.get_week_range(date)

            # Get spreadsheet metadata to check existing sheets (use cached if available)
            spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                db, spreadsheet_id
            )

            sheets = spreadsheet_metadata.get("sheets", [])

            # Check if sheet already exists
            for sheet in sheets:
                existing_sheet_name = sheet.get("properties", {}).get("title", "")
                if existing_sheet_name == sheet_name:
                    logger.info(f"Weekly sheet '{sheet_name}' already exists")
                    return sheet_name

            # Sheet doesn't exist, create it
            logger.info(f"Creating new weekly sheet '{sheet_name}'")

            # Create the new sheet
            requests = [{"addSheet": {"properties": {"title": sheet_name}}}]

            def _create_sheet():
                return (
                    service.spreadsheets()
                    .batchUpdate(
                        spreadsheetId=spreadsheet_id, body={"requests": requests}
                    )
                    .execute()
                )

            GoogleSheetsService._retry_with_backoff(_create_sheet)

            # Invalidate cache after creating new sheet
            cache_key = spreadsheet_id
            if cache_key in GoogleSheetsService._metadata_cache:
                del GoogleSheetsService._metadata_cache[cache_key]

            # Initialize header row if this is a new sheet
            # Task ID is the first column to prevent duplicates when retrying tasks
            header_row = [
                "Task ID",
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
            ]

            GoogleSheetsService.write_to_sheet(
                db=db,
                spreadsheet_id=spreadsheet_id,
                range_name=f"{sheet_name}!A1:R1",
                values=[header_row],
                value_input_option="USER_ENTERED",
            )

            logger.info(f"Created weekly sheet '{sheet_name}' with headers")
            return sheet_name

        except HttpError as e:
            logger.error(f"Failed to get or create weekly sheet: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error getting/creating weekly sheet: {str(e)}")
            raise

    @staticmethod
    def update_admin_source_of_truth(
        db: Session,
        task_data: Dict[str, Any],
        edi_patients: List[Dict[str, Any]],
        validation_results: Optional[List[Dict[str, Any]]] = None,
        task_completed_at: Optional[datetime] = None,
        google_sheets_update: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Update the admin source of truth spreadsheet with task data.
        Creates weekly sheets automatically and appends task data in the same format as Excel export.

        Args:
            db: Database session
            task_data: Dictionary containing task information:
                - task_id
                - agency_name
                - ra_date (YYYY-MM-DD format, optional)
                - status ("completed" or "failed")
                - error_message (optional, for failed tasks)
                - already_imported (optional, boolean)
                - remarks (optional)
            edi_patients: List of EDI patient data dictionaries
            validation_results: Optional list of validation results (takes priority over edi_patients)
            task_completed_at: Optional datetime when task completed (for posting date)
            google_sheets_update: Optional dictionary with Google Sheets update status and details

        Returns: Dictionary with update status
        """
        try:
            # Find admin spreadsheet
            spreadsheet_id = GoogleSheetsService.find_or_get_admin_spreadsheet(db)
            if not spreadsheet_id:
                return {
                    "success": False,
                    "message": f"Admin spreadsheet '{ADMIN_SOURCE_OF_TRUTH_SPREADSHEET_NAME}' not found. Please create it in the linked Google account.",
                    "rows_added": 0,
                }

            # Determine which date to use for weekly sheet
            # Use task_completed_at if available, otherwise use current date
            if task_completed_at:
                sheet_date = task_completed_at
            else:
                sheet_date = datetime.now()

            # Get or create weekly sheet
            sheet_name = GoogleSheetsService.get_or_create_weekly_sheet(
                db, spreadsheet_id, sheet_date
            )

            # Get task_id for duplicate checking
            task_id = task_data.get("task_id")
            if not task_id:
                logger.warning("No task_id provided, cannot check for duplicates")
                return {
                    "success": False,
                    "message": "task_id is required",
                    "rows_added": 0,
                }

            # OPTIMIZATION: Read columns A and B in one request to check for duplicates and calculate file_no
            rows_to_delete = []
            file_no = 1
            service = None
            sheet_id = None
            existing_data = None  # Initialize for use in batch update section

            try:
                # Read columns A:B in one request (A for duplicates, B for file_no)
                existing_data = GoogleSheetsService.read_sheet(
                    db, spreadsheet_id, f"{sheet_name}!A:B"
                )

                if (
                    existing_data and len(existing_data) > 1
                ):  # Has header + at least one data row
                    # Check if header has "Task ID" in column A (new format)
                    has_task_id_column = False
                    if existing_data[0] and len(existing_data[0]) > 0:
                        header_cell = str(existing_data[0][0]).strip().lower()
                        has_task_id_column = header_cell == "task id"

                    if has_task_id_column:
                        # Find ALL rows with matching task_id (column A)
                        # This works even if the task's rows are in the middle of the table,
                        # surrounded by other tasks' rows
                        for i, row in enumerate(
                            existing_data[1:], start=2
                        ):  # Start from row 2 (skip header)
                            if row and len(row) > 0:
                                existing_task_id = str(row[0]).strip() if row[0] else ""
                                if existing_task_id == str(task_id):
                                    rows_to_delete.append(i)

                    # Calculate file_no from column B
                    if existing_data[0] and len(existing_data[0]) > 1:
                        first_cell_b = (
                            str(existing_data[0][1]).strip().lower()
                            if len(existing_data[0]) > 1
                            else ""
                        )
                        if first_cell_b == "file no":
                            # Header exists, start file_no from max existing + 1
                            file_nos = []
                            for row in existing_data[1:]:  # Skip header
                                if row and len(row) > 1 and row[1]:
                                    try:
                                        file_no_val = int(row[1])
                                        file_nos.append(file_no_val)
                                    except (ValueError, TypeError):
                                        pass
                            if file_nos:
                                file_no = max(file_nos) + 1
                        else:
                            # No header, count all rows
                            file_no = len(existing_data)
                    else:
                        file_no = len(existing_data)
                else:
                    file_no = 1

                # Get service and sheet_id for batch operations
                service = GoogleSheetsService.get_sheets_service(db)
                spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                    db, spreadsheet_id
                )
                for sheet in spreadsheet_metadata.get("sheets", []):
                    if sheet.get("properties", {}).get("title") == sheet_name:
                        sheet_id = sheet.get("properties", {}).get("sheetId")
                        break

                if rows_to_delete:
                    logger.info(
                        f"Found {len(rows_to_delete)} existing row(s) with task_id {task_id} "
                        f"in sheet '{sheet_name}'. Will delete and replace with new data."
                    )
                else:
                    logger.info(
                        f"No existing rows found with task_id {task_id} in sheet '{sheet_name}'. "
                        f"Will add new rows."
                    )

            except Exception as e:
                logger.warning(
                    f"Could not read existing data for task_id {task_id}: {str(e)}. Continuing to add new rows."
                )
                # Try to get service and sheet_id anyway for writing
                try:
                    service = GoogleSheetsService.get_sheets_service(db)
                    spreadsheet_metadata = GoogleSheetsService._get_cached_metadata(
                        db, spreadsheet_id
                    )
                    for sheet in spreadsheet_metadata.get("sheets", []):
                        if sheet.get("properties", {}).get("title") == sheet_name:
                            sheet_id = sheet.get("properties", {}).get("sheetId")
                            break
                except Exception:
                    pass

            # Prepare data rows (same format as Excel export)
            rows_to_add = []

            # Prepare common task data
            ra_date = task_data.get("ra_date", "")
            if ra_date:
                # Format RA date from YYYY-MM-DD to MM/DD/YYYY
                try:
                    ra_date_obj = datetime.strptime(ra_date, "%Y-%m-%d")
                    ra_date = ra_date_obj.strftime("%m/%d/%Y")
                except (ValueError, TypeError):
                    pass  # Keep original format if parsing fails

            posting_date = ""
            # Set posting date if task completed (same logic as Excel export)
            # Excel export: entry.status === "completed" && entry.task_completed_at
            if task_data.get("status") == "completed" and task_completed_at:
                posting_date = task_completed_at.strftime("%m/%d/%Y")

            agency_name = task_data.get("agency_name", "")
            remarks = task_data.get("remarks", "")

            # Calculate sheets value (same logic as Excel export)
            # Excel: entry.status === "completed" && entry.google_sheets_update_status
            sheets_value = ""
            if task_data.get("status") == "completed" and google_sheets_update:
                sheets_status = google_sheets_update.get("status")
                # Check if status exists (equivalent to checking google_sheets_update_status in Excel)
                if sheets_status:
                    sheets_details = google_sheets_update.get("details")
                    if sheets_details and isinstance(sheets_details, dict):
                        # Calculate success count (updated + skipped are both successful)
                        success_count = (sheets_details.get("updated") or 0) + (
                            sheets_details.get("skipped") or 0
                        )
                        # Calculate total count
                        total_count = sheets_details.get("total") or (
                            success_count + (sheets_details.get("not_found") or 0)
                        )
                        if total_count > 0:
                            sheets_value = f"{success_count}/{total_count}"

            # Determine status
            status = "POSTED"
            if task_data.get("status") == "failed":
                error_msg = (task_data.get("error_message") or "").strip()
                already_imported = task_data.get("already_imported", False)

                if already_imported or "already imported" in error_msg.lower():
                    status = "Already Imported"
                elif (
                    "doesn't belong" in error_msg.lower()
                    or "wrong agency" in error_msg.lower()
                ):
                    status = (
                        f"Error: {error_msg}" if error_msg else "Error: Wrong agency"
                    )
                else:
                    status = f"Task Failed: {error_msg}" if error_msg else "Task Failed"

            # Always use edi_patients as primary source (same as Excel export)
            # If validation_results is available, merge claim_amount and paid_amount by patient_number
            patients_to_process = []

            if edi_patients:
                # Create a lookup map from validation_results by patient_number
                validation_map = {}
                if validation_results:
                    for vr in validation_results:
                        patient_number = vr.get("patient_number")
                        if patient_number:
                            # Normalize patient_number for matching
                            patient_number_str = str(patient_number).strip()
                            if patient_number_str:
                                validation_map[patient_number_str] = {
                                    "final_claim_amount": vr.get("final_claim_amount"),
                                    "final_payment_amount": vr.get(
                                        "final_payment_amount"
                                    ),
                                }

                # Process edi_patients and merge validation data if available
                for edi_patient in edi_patients:
                    patient = edi_patient.copy()  # Start with all EDI patient data

                    # Try to merge validation results by patient_number
                    patient_number = edi_patient.get("patient_number")
                    if patient_number and validation_map:
                        patient_number_str = str(patient_number).strip()
                        if patient_number_str in validation_map:
                            validation_data = validation_map[patient_number_str]
                            # Update claim_amount and paid_amount from validation if available
                            if validation_data.get("final_claim_amount") is not None:
                                patient["claim_amount"] = validation_data[
                                    "final_claim_amount"
                                ]
                            if validation_data.get("final_payment_amount") is not None:
                                patient["paid_amount"] = validation_data[
                                    "final_payment_amount"
                                ]

                    patients_to_process.append(patient)
            else:
                # No patient data - add one row with file info only
                rows_to_add.append(
                    [
                        task_id,  # Task ID (first column)
                        file_no,
                        ra_date,
                        posting_date,
                        agency_name,
                        "",  # PT Name
                        "",  # MID
                        "",  # Service Dates
                        "",  # PT-Claim No
                        "",  # Expected
                        0,  # Paid $
                        "",  # Adjustment $
                        "",  # 0-100
                        "",  # 100-300
                        "",  # 300+
                        status,
                        remarks,
                        sheets_value,
                    ]
                )

            # Process each patient
            for patient in patients_to_process:
                pt_no = patient.get("patient_number")
                claim_no = patient.get("claim_number")

                # Build PT-Claim No
                pt_and_claim_no = ""
                if pt_no is not None and claim_no is not None:
                    pt_and_claim_no = f"{pt_no}-{claim_no}"
                elif pt_no is not None:
                    pt_and_claim_no = str(pt_no)
                elif claim_no is not None:
                    pt_and_claim_no = str(claim_no)

                # Format service dates
                service_dates = ""
                start_date = patient.get("service_period_start")
                end_date = patient.get("service_period_end")
                if start_date or end_date:
                    try:
                        if start_date:
                            start_obj = datetime.strptime(start_date, "%Y-%m-%d")
                            start_str = start_obj.strftime("%m/%d/%Y")
                        else:
                            start_str = ""

                        if end_date:
                            end_obj = datetime.strptime(end_date, "%Y-%m-%d")
                            end_str = end_obj.strftime("%m/%d/%Y")
                        else:
                            end_str = ""

                        if start_str and end_str:
                            service_dates = f"{start_str} - {end_str}"
                        elif start_str:
                            service_dates = start_str
                        elif end_str:
                            service_dates = end_str
                    except (ValueError, TypeError):
                        pass

                final_claim = patient.get("claim_amount")
                paid_amount = patient.get("paid_amount", 0)
                adjustment_amount = patient.get("adjustment_amount")

                # Determine difference column (0-100, 100-300, 300+)
                diff_col_0_100 = ""
                diff_col_100_300 = ""
                diff_col_300_plus = ""

                if final_claim is not None and final_claim != 0:
                    diff_value = paid_amount - final_claim
                    abs_diff = abs(diff_value)

                    if abs_diff <= 100:
                        diff_col_0_100 = diff_value
                    elif abs_diff <= 300:
                        diff_col_100_300 = diff_value
                    else:
                        diff_col_300_plus = diff_value

                # Adjust status for already_imported
                row_status = status
                if task_data.get("already_imported"):
                    row_status = "Already Imported"

                rows_to_add.append(
                    [
                        task_id,  # Task ID (first column)
                        file_no,
                        ra_date,
                        posting_date,
                        agency_name,
                        patient.get("patient_name", ""),
                        patient.get("mid", ""),
                        service_dates,
                        pt_and_claim_no,
                        (
                            final_claim
                            if final_claim is not None and final_claim != 0
                            else ""
                        ),
                        paid_amount,
                        (
                            adjustment_amount
                            if adjustment_amount is not None and adjustment_amount != 0
                            else ""
                        ),
                        diff_col_0_100,
                        diff_col_100_300,
                        diff_col_300_plus,
                        row_status,
                        remarks,
                        sheets_value,
                    ]
                )

            # OPTIMIZATION: Batch all operations (delete duplicates + write new rows) in one API call
            if rows_to_add and service and sheet_id is not None:
                try:
                    # Get current row count from the data we already read
                    # existing_data contains A:B, so len(existing_data) is the current row count
                    current_row_count = len(existing_data) if existing_data else 1

                    # Calculate where to write: after the last row
                    # In batchUpdate, deletions are processed first, then writes
                    # So we need to calculate the write position accounting for deletions
                    # If we delete rows, the last row position shifts up
                    # Formula: start_write_row = current_row_count - (deleted rows at or after current_row_count) + 1
                    # But simpler: if we delete any rows, the last row becomes current_row_count - deletions_at_end
                    start_write_row = (
                        current_row_count + 1
                    )  # Default: write after last row

                    if rows_to_delete:
                        # Count how many rows we're deleting that are at or near the end
                        # If we delete the last row(s), the new last row is earlier
                        max_deleted_row = max(rows_to_delete) if rows_to_delete else 0
                        if max_deleted_row >= current_row_count:
                            # We're deleting the last row(s), so adjust
                            # After deletion, last row is: current_row_count - (rows deleted at end)
                            rows_deleted_at_end = sum(
                                1 for r in rows_to_delete if r >= current_row_count
                            )
                            start_write_row = (
                                current_row_count - rows_deleted_at_end + 1
                            )
                        # If deletions are before the end, start_write_row stays the same

                    # Ensure we don't write before row 2 (header is row 1)
                    if start_write_row < 2:
                        start_write_row = 2

                    # Prepare batch update requests
                    batch_requests = []

                    # 1. Delete duplicate rows (if any) - do this first
                    if rows_to_delete:
                        # Sort row indices in descending order for deletion
                        rows_to_delete_sorted = sorted(rows_to_delete, reverse=True)
                        for row_index in rows_to_delete_sorted:
                            batch_requests.append(
                                {
                                    "deleteDimension": {
                                        "range": {
                                            "sheetId": sheet_id,
                                            "dimension": "ROWS",
                                            "startIndex": row_index
                                            - 1,  # 0-based index
                                            "endIndex": row_index,  # End index is exclusive
                                        }
                                    }
                                }
                            )

                    # 2. Write new rows using updateCells
                    # Convert rows_to_add to the format needed for updateCells
                    rows_data = []
                    for row_data in rows_to_add:
                        cells = []
                        for col_idx, cell_value in enumerate(row_data):
                            cell = {}

                            # Add value (include empty strings as empty cells)
                            if cell_value is not None:
                                if isinstance(cell_value, (int, float)):
                                    cell["userEnteredValue"] = {
                                        "numberValue": cell_value
                                    }
                                elif isinstance(cell_value, bool):
                                    cell["userEnteredValue"] = {"boolValue": cell_value}
                                elif isinstance(cell_value, str):
                                    if cell_value:  # Only add non-empty strings
                                        cell["userEnteredValue"] = {
                                            "stringValue": cell_value
                                        }
                                    # Empty strings are represented as empty cell (no userEnteredValue)
                                else:
                                    cell["userEnteredValue"] = {
                                        "stringValue": str(cell_value)
                                    }

                            cells.append(cell)
                        rows_data.append({"values": cells})

                    if rows_data:
                        # Calculate the range for writing (columns A to R, which is indices 0-17)
                        batch_requests.append(
                            {
                                "updateCells": {
                                    "range": {
                                        "sheetId": sheet_id,
                                        "startRowIndex": start_write_row - 1,  # 0-based
                                        "endRowIndex": start_write_row
                                        - 1
                                        + len(rows_data),
                                        "startColumnIndex": 0,  # Column A
                                        "endColumnIndex": 18,  # Column R (0-17, so end is 18)
                                    },
                                    "rows": rows_data,
                                    "fields": "userEnteredValue",
                                }
                            }
                        )

                    # Execute all operations in one batchUpdate call
                    if batch_requests:

                        def _batch_update_all():
                            return (
                                service.spreadsheets()
                                .batchUpdate(
                                    spreadsheetId=spreadsheet_id,
                                    body={"requests": batch_requests},
                                )
                                .execute()
                            )

                        GoogleSheetsService._retry_with_backoff(_batch_update_all)

                        # Invalidate cache after updates
                        cache_key = spreadsheet_id
                        if cache_key in GoogleSheetsService._metadata_cache:
                            del GoogleSheetsService._metadata_cache[cache_key]

                        logger.info(
                            f"Batch updated admin source of truth sheet '{sheet_name}' for task {task_data.get('task_id')}: "
                            f"deleted {len(rows_to_delete)} duplicate row(s), added {len(rows_to_add)} new row(s) in 1 API call"
                        )

                        return {
                            "success": True,
                            "spreadsheet_id": spreadsheet_id,
                            "sheet_name": sheet_name,
                            "rows_added": len(rows_to_add),
                        }
                    else:
                        logger.warning(
                            f"No operations to perform for task {task_data.get('task_id')}"
                        )
                        return {
                            "success": False,
                            "message": "No operations to perform",
                            "rows_added": 0,
                        }

                except Exception as batch_error:
                    logger.error(
                        f"Failed to batch update admin source of truth: {str(batch_error)}. "
                        f"Falling back to individual operations."
                    )
                    # Fallback to original append method if batch fails
                    try:
                        range_name = f"{sheet_name}!A:R"
                        GoogleSheetsService.append_to_sheet(
                            db=db,
                            spreadsheet_id=spreadsheet_id,
                            range_name=range_name,
                            values=rows_to_add,
                            value_input_option="USER_ENTERED",
                        )
                        logger.info(
                            f"Added {len(rows_to_add)} row(s) to admin source of truth sheet '{sheet_name}' for task {task_data.get('task_id')} (fallback method)"
                        )
                        return {
                            "success": True,
                            "spreadsheet_id": spreadsheet_id,
                            "sheet_name": sheet_name,
                            "rows_added": len(rows_to_add),
                        }
                    except Exception as fallback_error:
                        logger.error(
                            f"Fallback append also failed: {str(fallback_error)}"
                        )
                        raise
            elif rows_to_add:
                # Fallback if service or sheet_id not available
                range_name = f"{sheet_name}!A:R"
                GoogleSheetsService.append_to_sheet(
                    db=db,
                    spreadsheet_id=spreadsheet_id,
                    range_name=range_name,
                    values=rows_to_add,
                    value_input_option="USER_ENTERED",
                )
                logger.info(
                    f"Added {len(rows_to_add)} row(s) to admin source of truth sheet '{sheet_name}' for task {task_data.get('task_id')}"
                )
                return {
                    "success": True,
                    "spreadsheet_id": spreadsheet_id,
                    "sheet_name": sheet_name,
                    "rows_added": len(rows_to_add),
                }
            else:
                logger.warning(f"No rows to add for task {task_data.get('task_id')}")
                return {
                    "success": False,
                    "message": "No patient data available",
                    "rows_added": 0,
                }

        except Exception as e:
            logger.error(f"Failed to update admin source of truth: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "rows_added": 0,
            }

    @staticmethod
    def update_277_patient_data_in_sheet(
        db: Session,
        npi: str,
        header_date: str,
        patients: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Update Google Sheets with 277 claim status patient data.
        
        For 277 files:
        1. Find spreadsheet with name containing the NPI value
        2. Use the first sheet tab in that spreadsheet
        3. Find the last entered line in the sheet
        4. Skip a row
        5. Put the header_date in column A
        6. Skip one more row
        7. Start entering patient values row by row
        
        Args:
            db: Database session
            npi: Agency NPI (e.g., "1750587804")
            header_date: Date from 277 header (YYYY-MM-DD format)
            patients: List of patient dictionaries with:
                - patient_number (or member_id)
                - claim_number (or pt_claim)
                - patient_name (or name)
                - claim_amount (or amount)
                - extra: dict with claim_id, status, tob, service_dates
                
        Returns: Dictionary with update statistics
        """
        try:
            # Find spreadsheet by name pattern (spreadsheet name, not sheet tab name)
            name_pattern = str(npi)
            spreadsheet_info = GoogleSheetsService.find_spreadsheet_by_name_pattern(
                db, name_pattern
            )
            
            if not spreadsheet_info:
                logger.warning(
                    f"No spreadsheet found with NPI [{npi}]"
                )
                return {
                    "success": False,
                    "message": f"No spreadsheet found with NPI [{npi}]",
                    "updated": 0,
                    "skipped": 0,
                    "not_found": 0,
                    "total": len(patients),
                }
            
            spreadsheet_id = spreadsheet_info["spreadsheet_id"]
            sheet_name = spreadsheet_info["sheet_name"]
            
            logger.info(
                f"Found spreadsheet {spreadsheet_id} with sheet '{sheet_name}' for NPI {npi}"
            )
            
            # Read the entire sheet to find the last entered line
            range_name = f"{sheet_name}!A:Z"
            sheet_values = GoogleSheetsService.read_sheet(db, spreadsheet_id, range_name)
            
            # Find last non-empty row
            last_row = 0
            if sheet_values:
                for i, row in enumerate(sheet_values):
                    # Check if row has any non-empty cells
                    if any(cell for cell in row if cell):
                        last_row = i + 1  # 1-indexed
            
            logger.info(f"Last entered row in sheet: {last_row}")
            
            # Prepare rows to append:
            # 1. Empty row (skip a row)
            # 2. Date row in column A
            # 3. Empty row (skip another row)
            # 4. Patient data rows
            
            rows_to_append = []
            
            # Empty row
            rows_to_append.append([])
            
            # Date row (column A only) - prefix with ' to force text format
            # This prevents Google Sheets from converting "12/22/2025" to serial number 46013
            date_value = f"'{header_date}" if header_date else ""
            rows_to_append.append([date_value])
            
            # Empty row
            rows_to_append.append([])
            
            # Patient data rows
            # Columns: A=Name, B=Member ID, C=Claim#, D=Service Dates, E=Amount, F=Claim ID, G=Status, H=TOB
            for patient in patients:
                patient_number = patient.get("patient_number") or patient.get("mid") or ""
                claim_number = patient.get("claim_number") or patient.get("pt_claim") or ""
                patient_name = patient.get("patient_name") or patient.get("name") or ""
                claim_amount = patient.get("claim_amount") or patient.get("amount") or 0
                
                # Get extra 277 fields
                extra = patient.get("extra", {})
                claim_id = extra.get("claim_id", "")
                status = extra.get("status", "")
                tob = extra.get("tob", "")
                service_dates = extra.get("service_dates", "")
                
                # Build row data in correct column order
                row = [
                    patient_name,       # Column A: Patient name (e.g., "GREWAL, JAMES")
                    patient_number,     # Column B: Member ID (e.g., "7K11T84XX77")
                    claim_number,       # Column C: Claim number (e.g., "141-1495")
                    service_dates,      # Column D: Service dates (e.g., "20251005-20251028")
                    claim_amount,       # Column E: Amount (e.g., "480.01")
                    claim_id,           # Column F: Claim ID (e.g., "22535600585207CAR [01NS25337000V]")
                    status,             # Column G: Status (e.g., "ACCEPTED 20251220 [A2/20/PR]")
                    tob,                # Column H: Type of Bill (e.g., "TOB: 329")
                ]
                rows_to_append.append(row)
            
            # Append all rows to the sheet
            if rows_to_append:
                append_range = f"{sheet_name}!A:Z"
                GoogleSheetsService.append_to_sheet(
                    db=db,
                    spreadsheet_id=spreadsheet_id,
                    range_name=append_range,
                    values=rows_to_append,
                    value_input_option="USER_ENTERED",
                )
                
                updated_count = len(patients)  # Number of actual patient rows
                logger.info(
                    f"Appended {updated_count} patient rows (plus 3 formatting rows) to sheet '{sheet_name}'"
                )
                
                return {
                    "success": True,
                    "spreadsheet_id": spreadsheet_id,
                    "sheet_name": sheet_name,
                    "updated": updated_count,
                    "skipped": 0,
                    "not_found": 0,
                    "total": len(patients),
                }
            else:
                logger.warning(f"No patient data to append for NPI {npi}")
                return {
                    "success": False,
                    "message": "No patient data available",
                    "updated": 0,
                    "skipped": 0,
                    "not_found": 0,
                    "total": len(patients),
                }
                
        except Exception as e:
            logger.error(f"Failed to update 277 patient data in sheet: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "updated": 0,
                "skipped": 0,
                "not_found": 0,
                "total": len(patients) if patients else 0,
            }
