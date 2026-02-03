from pydantic import BaseModel
from typing import Optional, Union, List
from uuid import UUID
from datetime import datetime


class AgencyBase(BaseModel):
    name: str
    link: str
    username: str
    password: str
    npi: Optional[str] = None


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    link: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    npi: Optional[str] = None


class AgencyOut(AgencyBase):
    id: UUID

    class Config:
        from_attributes = True
