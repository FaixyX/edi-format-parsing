from sqlalchemy.orm import Session
from app.models.agency import Agency
from app.schemas.agency import AgencyCreate, AgencyUpdate
from uuid import UUID
from datetime import datetime
import logging

# Configure logger for this module
logger = logging.getLogger(__name__)


def _get_phi_service():
    """Get PHI encryption service (lazy import to avoid circular imports)."""
    from app.services.crypto import get_phi_encryption_service

    return get_phi_encryption_service()


def _encrypt_agency_fields(data: dict) -> dict:
    """Encrypt sensitive agency fields before storage."""
    phi_crypto = _get_phi_service()
    result = dict(data)

    if "username" in result and result["username"]:
        result["username"] = phi_crypto.encrypt_agency_username(result["username"])
    if "password" in result and result["password"]:
        result["password"] = phi_crypto.encrypt_agency_password(result["password"])
    if "link" in result and result["link"]:
        result["link"] = phi_crypto.encrypt_agency_link(result["link"])

    return result


def _decrypt_agency(agency: Agency) -> Agency:
    """
    Decrypt sensitive agency fields for use.

    Note: This modifies the agency object in place but doesn't persist changes.
    The decrypted values should only be used in memory, not written back.
    """
    if not agency:
        return agency

    phi_crypto = _get_phi_service()

    # Decrypt fields (handles both encrypted and unencrypted data)
    agency._decrypted_username = phi_crypto.decrypt_agency_username(agency.username)
    agency._decrypted_password = phi_crypto.decrypt_agency_password(agency.password)
    agency._decrypted_link = phi_crypto.decrypt_agency_link(agency.link)

    return agency


def get_agency_decrypted_credentials(agency: Agency) -> dict:
    """
    Get decrypted credentials for an agency.

    Use this when you need the actual credentials (e.g., for bot login).

    Args:
        agency: Agency model instance

    Returns:
        Dictionary with decrypted username, password, link
    """
    phi_crypto = _get_phi_service()

    return {
        "username": phi_crypto.decrypt_agency_username(agency.username),
        "password": phi_crypto.decrypt_agency_password(agency.password),
        "link": phi_crypto.decrypt_agency_link(agency.link),
    }


def get_agencies(db: Session):
    return db.query(Agency).order_by(Agency.name).all()


def get_agency(db: Session, agency_id: str):
    try:
        # Convert string ID to UUID
        uuid_obj = UUID(agency_id)
        return db.query(Agency).filter(Agency.id == uuid_obj).first()
    except ValueError:
        # Handle case where ID can't be converted to UUID
        return None


def get_agency_by_npi(db: Session, npi: str):
    """Get an agency by NPI. Returns None if not found or if npi is None/empty."""
    if not npi:
        return None
    return db.query(Agency).filter(Agency.npi == npi).first()


def create_agency(db: Session, agency_data: AgencyCreate):
    # Check for duplicate NPI if provided
    if agency_data.npi:
        existing_agency = get_agency_by_npi(db, agency_data.npi)
        if existing_agency:
            raise ValueError(f"An agency with NPI '{agency_data.npi}' already exists")

    # Encrypt sensitive fields before storage
    data_dict = agency_data.dict()
    encrypted_data = _encrypt_agency_fields(data_dict)

    agency = Agency(**encrypted_data)
    db.add(agency)
    db.commit()
    db.refresh(agency)

    logger.info(f"Created agency '{agency.name}' with encrypted credentials")
    return agency


def update_agency(db: Session, db_agency: Agency, agency_data: AgencyUpdate):
    update_data = agency_data.dict(exclude_unset=True)

    # Check for duplicate NPI if NPI is being updated
    if "npi" in update_data and update_data["npi"]:
        existing_agency = get_agency_by_npi(db, update_data["npi"])
        if existing_agency and existing_agency.id != db_agency.id:
            raise ValueError(f"An agency with NPI '{update_data['npi']}' already exists")

    # Encrypt sensitive fields if they're being updated
    encrypted_data = _encrypt_agency_fields(update_data)

    for key, value in encrypted_data.items():
        setattr(db_agency, key, value)

    db.add(db_agency)
    db.commit()
    db.refresh(db_agency)

    logger.info(f"Updated agency '{db_agency.name}' with encrypted credentials")
    return db_agency


def delete_agency(db: Session, db_agency: Agency):
    db.delete(db_agency)
    db.commit()
    return True
