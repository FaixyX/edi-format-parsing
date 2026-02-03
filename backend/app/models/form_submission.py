from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Boolean,
    Text,
    DateTime,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSON
from app.db.session import Base
import uuid
from datetime import datetime


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agency_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("public.agencies.id", ondelete="CASCADE"),
        nullable=False,
    )
    assessment_id = Column(String, nullable=True)  # Existing assessment ID
    new_assessment_data = Column(JSON, nullable=True)  # New assessment data
    pdf_file_data = Column(Text, nullable=False)  # Base64 encoded PDF
    pdf_filename = Column(String, nullable=False)
    task_id = Column(String, nullable=True)  # Dramatiq task ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=func.now())

    # Add schema specification to match other models
    __table_args__ = ({"schema": "public"},)
