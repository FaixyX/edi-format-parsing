from sqlalchemy import Column, Integer, String, Boolean, Enum
import enum
from app.db.session import Base


class UserType(str, enum.Enum):
    ADMIN = "Admin"
    MEMBER = "Member"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)  # This should be hashed
    type = Column(Enum(UserType))
    enabled = Column(Boolean, default=True)
    protected = Column(Boolean, default=False)
    token_version = Column(
        Integer, default=0
    )  # Used to invalidate tokens when password changes or account is deactivated
