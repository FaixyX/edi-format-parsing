from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class BackgroundTaskBase(BaseModel):
    task_id: str
    agency_id: UUID
    params: Dict[str, Any]
    status: str = "pending"
    retry_count: int = 0
    max_retries: int = 3


class BackgroundTaskCreate(BackgroundTaskBase):
    pass


class BackgroundTaskOut(BackgroundTaskBase):
    id: UUID
    error_message: Optional[str] = None
    result_data: Optional[Dict[str, Any]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

