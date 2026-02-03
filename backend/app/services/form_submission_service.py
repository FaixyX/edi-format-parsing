from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.form_submission import FormSubmission
from app.schemas.form_submission import FormSubmissionCreate, FormSubmissionOut
import logging

logger = logging.getLogger(__name__)


def _get_phi_service():
    """Get PHI encryption service (lazy import to avoid circular imports)."""
    from app.services.crypto import get_phi_encryption_service

    return get_phi_encryption_service()


class FormSubmissionService:
    @staticmethod
    def create_form_submission(
        db: Session, submission_data: FormSubmissionCreate
    ) -> FormSubmission:
        """Create a new form submission record with encrypted ePHI data"""
        try:
            # Validate PDF data before storing
            if (
                not submission_data.pdf_file_data
                or len(submission_data.pdf_file_data.strip()) == 0
            ):
                # Avoid logging PDF filenames (may contain patient identifiers)
                logger.error("Attempted to create form submission with empty PDF data")
                raise ValueError("PDF file data cannot be empty")

            # Validate PDF filename
            if (
                not submission_data.pdf_filename
                or len(submission_data.pdf_filename.strip()) == 0
            ):
                # Avoid logging PDF filenames (may contain patient identifiers)
                logger.error(
                    "Attempted to create form submission with empty PDF filename"
                )
                raise ValueError("PDF filename cannot be empty")

            # Log PDF data size for monitoring
            # Log only size to avoid leaking potentially sensitive filenames
            logger.info(
                f"Creating form submission with PDF data size: {len(submission_data.pdf_file_data)} characters"
            )

            # Encrypt ePHI data before storage
            phi_crypto = _get_phi_service()
            submission_dict = submission_data.dict()

            # Encrypt PDF file data
            submission_dict["pdf_file_data"] = phi_crypto.encrypt_pdf_file(
                submission_dict["pdf_file_data"]
            )

            # Encrypt assessment data if present
            if submission_dict.get("new_assessment_data"):
                submission_dict["new_assessment_data"] = (
                    phi_crypto.encrypt_assessment_data(
                        submission_dict["new_assessment_data"]
                    )
                )

            db_submission = FormSubmission(**submission_dict)
            db.add(db_submission)
            db.commit()
            db.refresh(db_submission)

            # Verify the data was stored correctly (encrypted data should exist)
            if (
                not db_submission.pdf_file_data
                or len(db_submission.pdf_file_data.strip()) == 0
            ):
                logger.error(
                    f"PDF data was not stored correctly for submission: {db_submission.id}"
                )
                raise ValueError("PDF data storage verification failed")

            logger.info(
                f"Form submission created successfully with encrypted ePHI: {db_submission.id}"
            )
            return db_submission
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating form submission: {str(e)}")
            raise

    @staticmethod
    def get_decrypted_pdf(submission: FormSubmission) -> str:
        """Get decrypted PDF data for a submission."""
        phi_crypto = _get_phi_service()
        return phi_crypto.decrypt_pdf_file(submission.pdf_file_data)

    @staticmethod
    def get_decrypted_assessment_data(submission: FormSubmission) -> Optional[dict]:
        """Get decrypted assessment data for a submission."""
        if not submission.new_assessment_data:
            return None
        phi_crypto = _get_phi_service()
        # Handle both JSON dict and encrypted string
        if isinstance(submission.new_assessment_data, dict):
            return submission.new_assessment_data
        return phi_crypto.decrypt_assessment_data(submission.new_assessment_data)

    @staticmethod
    def get_form_submission(
        db: Session, submission_id: UUID
    ) -> Optional[FormSubmission]:
        """Get a form submission by ID"""
        return (
            db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        )

    @staticmethod
    def update_submission_task_id(
        db: Session,
        submission_id: UUID,
        task_id: str,
    ) -> FormSubmission:
        """Update submission task_id only (status and results are now in background_tasks)"""
        try:
            submission = (
                db.query(FormSubmission)
                .filter(FormSubmission.id == submission_id)
                .first()
            )
            if submission:
                submission.task_id = task_id
                db.commit()
                db.refresh(submission)
            return submission
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating submission task_id: {str(e)}")
            raise

    @staticmethod
    def get_form_submissions_by_agency(
        db: Session, agency_id: UUID
    ) -> List[FormSubmission]:
        """Get all form submissions for a specific agency"""
        return (
            db.query(FormSubmission)
            .filter(FormSubmission.agency_id == agency_id)
            .order_by(FormSubmission.created_at.desc())
            .all()
        )

    @staticmethod
    def get_all_form_submissions(
        db: Session, skip: int = 0, limit: int = 100, status: str = None
    ) -> List[FormSubmission]:
        """Get all form submissions with optional filtering"""
        query = db.query(FormSubmission)
        if status:
            query = query.filter(FormSubmission.status == status)
        return (
            query.order_by(FormSubmission.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def delete_form_submission(db: Session, submission: FormSubmission) -> bool:
        """Delete a form submission"""
        try:
            db.delete(submission)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting form submission: {str(e)}")
            raise
