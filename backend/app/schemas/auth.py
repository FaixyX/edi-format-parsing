from pydantic import BaseModel
from app.models.user import UserType


class LoginRequest(BaseModel):
    username: str
    password: str
    keepLoggedIn: bool = False


class LoginResponse(BaseModel):
    token: str
    user: dict
