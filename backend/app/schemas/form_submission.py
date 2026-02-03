from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class FormSubmissionBase(BaseModel):
    agency_id: UUID
    assessment_id: Optional[str] = None
    new_assessment_data: Optional[Dict[str, Any]] = None
    pdf_filename: str


class FormSubmissionCreate(FormSubmissionBase):
    pdf_file_data: str  # Base64 encoded


class FormSubmissionOut(FormSubmissionBase):
    id: UUID
    task_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
