from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.background_task import (
    BackgroundTaskCreate,
    BackgroundTaskOut,
)
from app.services.background_task_service import BackgroundTaskService
from typing import List
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/agencies/{agency_id}/background-tasks", response_model=List[BackgroundTaskOut]
)
def list_background_tasks(agency_id: str, db: Session = Depends(get_db)):
    """Get all background tasks for a specific agency"""
    try:
        uuid_obj = UUID(agency_id)
        return BackgroundTaskService.get_tasks_by_agency(db, uuid_obj)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agency ID format")


@router.get("/background-tasks/{task_id}", response_model=BackgroundTaskOut)
def read_background_task(task_id: str, db: Session = Depends(get_db)):
    """Get a specific background task by ID"""
    try:
        db_task = BackgroundTaskService.get_task_by_id(db, task_id)
        if db_task is None:
            raise HTTPException(status_code=404, detail="Background task not found")
        return db_task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/background-tasks", response_model=List[BackgroundTaskOut])
def list_all_background_tasks(
    skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)
):
    """Get all background tasks with optional filtering"""
    try:
        return BackgroundTaskService.get_all_tasks(db, skip, limit, status)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/form-submissions/{submission_id}/background-tasks",
    response_model=List[BackgroundTaskOut],
)
def list_tasks_by_submission(submission_id: str, db: Session = Depends(get_db)):
    """Get all background tasks for a specific form submission"""
    try:
        uuid_obj = UUID(submission_id)
        return BackgroundTaskService.get_tasks_by_submission(db, uuid_obj)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid submission ID format")


@router.delete("/background-tasks/{task_id}")
def delete_background_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a background task"""
    try:
        db_task = BackgroundTaskService.get_task_by_id(db, task_id)
        if db_task is None:
            raise HTTPException(status_code=404, detail="Background task not found")
        BackgroundTaskService.delete_task(db, db_task)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
