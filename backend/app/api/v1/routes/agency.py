from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Body,
    UploadFile,
    File,
    Form,
)
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.agency import AgencyCreate, AgencyUpdate, AgencyOut
from app.services.agency_service import (
    get_agencies,
    get_agency,
    create_agency,
    update_agency,
    delete_agency,
    get_agency_decrypted_credentials,
)
from typing import Dict, Any, Optional, List
from uuid import UUID
import sqlalchemy.exc
import json
import base64
import redis
from datetime import datetime
import httpx
import os
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _decrypt_agency_for_response(agency) -> AgencyOut:
    """Decrypt agency credentials for API response."""
    from app.services.crypto import get_phi_encryption_service

    phi_crypto = get_phi_encryption_service()

    return AgencyOut(
        id=agency.id,
        name=agency.name,
        link=phi_crypto.decrypt_agency_link(agency.link),
        username=phi_crypto.decrypt_agency_username(agency.username),
        password=phi_crypto.decrypt_agency_password(agency.password),
        npi=agency.npi,
    )


def _decrypt_agencies_for_response(agencies) -> List[AgencyOut]:
    """Decrypt multiple agencies for API response."""
    return [_decrypt_agency_for_response(agency) for agency in agencies]


async def trigger_worker_wakeup():
    """
    Send HTTP request to worker service to wake it up from scale-to-zero.
    This allows the worker to process tasks that are queued in Redis.
    """
    worker_url = os.getenv("WORKER_SERVICE_URL", "http://localhost:8001")
    trigger_endpoint = f"{worker_url}/trigger"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(trigger_endpoint, json={"action": "wake_up"})
            if response.status_code == 200:
                print(f"✅ Worker wake-up triggered successfully")
                return True
            else:
                print(f"⚠️ Worker wake-up failed with status {response.status_code}")
                return False
    except Exception as e:
        print(f"⚠️ Failed to trigger worker wake-up: {str(e)}")
        # Don't fail the main request if worker trigger fails
        # The task will still be queued and processed when worker comes online
        return False


@router.get("/agencies", response_model=List[AgencyOut])
def list_agencies(db: Session = Depends(get_db)):
    agencies = get_agencies(db)
    return _decrypt_agencies_for_response(agencies)


@router.get("/agencies/{agency_id}", response_model=AgencyOut)
def read_agency(agency_id: str, db: Session = Depends(get_db)):
    db_agency = get_agency(db, agency_id)
    if db_agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    return _decrypt_agency_for_response(db_agency)


@router.post("/agencies", response_model=AgencyOut, status_code=status.HTTP_201_CREATED)
def create_new_agency(agency: AgencyCreate, db: Session = Depends(get_db)):
    try:
        new_agency = create_agency(db, agency)
        return _decrypt_agency_for_response(new_agency)
    except ValueError as e:
        # Handle duplicate NPI error
        if "NPI" in str(e) or "npi" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        raise
    except sqlalchemy.exc.IntegrityError as e:
        # Handle database unique constraint violation
        if "uq_agencies_npi" in str(e.orig) or "npi" in str(e.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An agency with this NPI already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred",
        )


@router.put("/agencies/{agency_id}", response_model=AgencyOut)
def update_existing_agency(
    agency_id: str, agency: AgencyUpdate, db: Session = Depends(get_db)
):
    db_agency = get_agency(db, agency_id)
    if db_agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    try:
        updated_agency = update_agency(db, db_agency, agency)
        return _decrypt_agency_for_response(updated_agency)
    except ValueError as e:
        # Handle duplicate NPI error
        if "NPI" in str(e) or "npi" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        raise
    except sqlalchemy.exc.IntegrityError as e:
        # Handle database unique constraint violation
        if "uq_agencies_npi" in str(e.orig) or "npi" in str(e.orig).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An agency with this NPI already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred",
        )


@router.delete("/agencies/{agency_id}")
def delete_existing_agency(agency_id: str, db: Session = Depends(get_db)):
    db_agency = get_agency(db, agency_id)
    if db_agency is None:
        raise HTTPException(status_code=404, detail="Agency not found")
    delete_agency(db, db_agency)
    return {"ok": True}
