from pydantic import BaseModel
from app.models.user import UserType


class UserBase(BaseModel):
    username: str
    type: UserType
    enabled: bool = True
    protected: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    type: UserType | None = None
    enabled: bool | None = None


class UserOut(UserBase):
    id: int

    class Config:
        from_attributes = True


class UserToggle(BaseModel):
    enabled: bool


class UserResponse(BaseModel):
    id: int
    username: str
    type: UserType
    enabled: bool

    class Config:
        from_attributes = True
