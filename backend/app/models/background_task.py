from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    func,
    Text,
    ForeignKey,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSON
from app.db.session import Base
import uuid
from datetime import datetime


class BackgroundTask(Base):
    """
    Background task for EDI billing file processing.
    Each EDI file upload creates a separate background task.
    """

    __tablename__ = "background_tasks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(String, unique=True, nullable=False)  # Dramatiq task ID

    # Agency reference
    agency_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("public.agencies.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Task-specific parameters (filename, NPI, provider name, etc.)
    params = Column(JSON, nullable=False)

    # EDI file storage (base64 encoded, similar to PDF storage in form_submissions)
    edi_file_data = Column(Text, nullable=True)  # Base64 encoded EDI file
    edi_filename = Column(String, nullable=True)  # Original EDI filename

    # Task status
    status = Column(String, default="pending")  # pending, processing, completed, failed
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)

    # Results and errors
    error_message = Column(Text, nullable=True)
    result_data = Column(JSON, nullable=True)  # Stores validation results

    # Timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=func.now())

    # Review tracking fields
    is_checked = Column(Boolean, default=False, nullable=False)
    note = Column(Text, nullable=True)
    checked_by = Column(String, nullable=True)  # Username who checked
    checked_at = Column(DateTime, nullable=True)
    note_by = Column(String, nullable=True)  # Username who added/updated note
    note_at = Column(DateTime, nullable=True)

    # Add schema specification to match other models
    __table_args__ = ({"schema": "public"},)
