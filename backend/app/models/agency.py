from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Boolean,
    Text,
    DateTime,
    func,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSON
from app.db.session import Base
import uuid
from datetime import datetime


class Agency(Base):
    __tablename__ = "agencies"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    link = Column(String, nullable=False)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    npi = Column(
        String, nullable=True, unique=True
    )  # National Provider Identifier - must be unique

    __table_args__ = (
        UniqueConstraint("npi", name="uq_agencies_npi"),
        {"schema": "public"},
    )
