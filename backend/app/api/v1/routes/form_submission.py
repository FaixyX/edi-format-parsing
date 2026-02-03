from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.form_submission import (
    FormSubmissionCreate,
    FormSubmissionOut,
)
from app.services.form_submission_service import FormSubmissionService
from typing import List
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/agencies/{agency_id}/form-submissions", response_model=List[FormSubmissionOut]
)
def list_form_submissions(agency_id: str, db: Session = Depends(get_db)):
    """Get all form submissions for a specific agency"""
    try:
        uuid_obj = UUID(agency_id)
        return FormSubmissionService.get_form_submissions_by_agency(db, uuid_obj)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agency ID format")


@router.get("/form-submissions/{submission_id}", response_model=FormSubmissionOut)
def read_form_submission(submission_id: str, db: Session = Depends(get_db)):
    """Get a specific form submission by ID"""
    try:
        uuid_obj = UUID(submission_id)
        db_submission = FormSubmissionService.get_form_submission(db, uuid_obj)
        if db_submission is None:
            raise HTTPException(status_code=404, detail="Form submission not found")
        return db_submission
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")


@router.get("/form-submissions", response_model=List[FormSubmissionOut])
def list_all_form_submissions(
    skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)
):
    """Get all form submissions with optional filtering"""
    try:
        return FormSubmissionService.get_all_form_submissions(db, skip, limit, status)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/form-submissions/{submission_id}")
def delete_form_submission(submission_id: str, db: Session = Depends(get_db)):
    """Delete a form submission"""
    try:
        uuid_obj = UUID(submission_id)
        db_submission = FormSubmissionService.get_form_submission(db, uuid_obj)
        if db_submission is None:
            raise HTTPException(status_code=404, detail="Form submission not found")
        FormSubmissionService.delete_form_submission(db, db_submission)
        return {"ok": True}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")
