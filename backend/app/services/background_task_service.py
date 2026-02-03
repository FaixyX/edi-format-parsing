from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.background_task import BackgroundTask
from app.schemas.background_task import BackgroundTaskCreate, BackgroundTaskOut
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def _get_phi_service():
    """Get PHI encryption service (lazy import to avoid circular imports)."""
    from app.services.crypto import get_phi_encryption_service

    return get_phi_encryption_service()


def _encrypt_result_data(result_data: dict) -> dict:
    """
    Encrypt PHI in result_data before storage.

    Encrypts validation_results which contain patient_name (ePHI).
    """
    if not result_data:
        return result_data

    result = dict(result_data)

    # Encrypt validation_results if present (contains patient_name)
    if "validation_results" in result and result["validation_results"]:
        phi_crypto = _get_phi_service()
        # Encrypt the entire validation_results as JSON
        import json

        json_str = json.dumps(result["validation_results"])
        result["validation_results"] = phi_crypto._encrypt_to_string(
            "background_task.result_data.validation_results", json_str
        )
        result["_validation_results_encrypted"] = True

    return result


def decrypt_result_data(result_data: dict) -> dict:
    """
    Decrypt PHI in result_data for use.

    Decrypts validation_results which contain patient_name (ePHI).
    Public function for use by monitoring_service.
    """
    if not result_data:
        return result_data

    result = dict(result_data)

    # Decrypt validation_results if encrypted
    if result.get("_validation_results_encrypted") or (
        "validation_results" in result and isinstance(result["validation_results"], str)
    ):
        phi_crypto = _get_phi_service()
        validation_str = result.get("validation_results", "[]")

        # Check if it's encrypted
        if isinstance(validation_str, str) and phi_crypto.is_data_encrypted(
            validation_str
        ):
            import json

            decrypted = phi_crypto._decrypt_from_string(
                "background_task.result_data.validation_results", validation_str
            )
            result["validation_results"] = json.loads(decrypted)
            result.pop("_validation_results_encrypted", None)
        elif isinstance(validation_str, str):
            # Try to parse as JSON (migration compatibility)
            try:
                import json

                result["validation_results"] = json.loads(validation_str)
            except:
                result["validation_results"] = []

    return result


class BackgroundTaskService:
    @staticmethod
    def create_background_task(
        db: Session, task_data: BackgroundTaskCreate
    ) -> BackgroundTask:
        """Create a new background task record"""
        try:
            db_task = BackgroundTask(**task_data.dict())
            db.add(db_task)
            db.commit()
            db.refresh(db_task)
            return db_task
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating background task: {str(e)}")
            raise

    @staticmethod
    def get_task_by_id(db: Session, task_id: str) -> Optional[BackgroundTask]:
        """Get a background task by Dramatiq task ID"""
        return (
            db.query(BackgroundTask).filter(BackgroundTask.task_id == task_id).first()
        )

    @staticmethod
    def update_task_status(
        db: Session,
        task_id: str,
        status: str,
        error_message: Optional[str] = None,
        result_data: Optional[dict] = None,
    ) -> BackgroundTask:
        """Update task status and related fields. Encrypts PHI in result_data."""
        try:
            task = (
                db.query(BackgroundTask)
                .filter(BackgroundTask.task_id == task_id)
                .first()
            )
            if task:
                task.status = status
                # Note: retry_count is now managed by Dramatiq callbacks (update_retry_count, mark_task_failed)
                if error_message:
                    task.error_message = error_message
                if result_data:
                    # Encrypt PHI in result_data before storage
                    task.result_data = _encrypt_result_data(result_data)
                if status == "processing" and not task.started_at:
                    task.started_at = datetime.utcnow()
                elif status in ["completed", "failed"]:
                    task.completed_at = datetime.utcnow()
                db.commit()
                db.refresh(task)
            return task
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating task status: {str(e)}")
            raise

    @staticmethod
    def get_tasks_by_agency(db: Session, agency_id: UUID) -> List[BackgroundTask]:
        """Get all background tasks for a specific agency"""
        return (
            db.query(BackgroundTask)
            .filter(BackgroundTask.agency_id == agency_id)
            .order_by(BackgroundTask.created_at.desc())
            .all()
        )

    @staticmethod
    def get_all_tasks(
        db: Session, skip: int = 0, limit: int = 100, status: str = None
    ) -> List[BackgroundTask]:
        """Get all background tasks with optional filtering"""
        query = db.query(BackgroundTask)
        if status:
            query = query.filter(BackgroundTask.status == status)
        return (
            query.order_by(BackgroundTask.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def delete_task(db: Session, task: BackgroundTask) -> bool:
        """Delete a background task"""
        try:
            db.delete(task)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting background task: {str(e)}")
            raise
