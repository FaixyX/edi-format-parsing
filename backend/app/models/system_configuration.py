from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    func,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db.session import Base
import uuid
from datetime import datetime


class SystemConfiguration(Base):
    __tablename__ = "system_configurations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    data_type = Column(String, nullable=False, default="string")  # string, integer, boolean, float
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
