# Agency-Control-Panel/fastapi-server/app/api/v1/routes/auth.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.auth import LoginRequest, LoginResponse
# Make sure UserResponse is defined, e.g., in app/schemas/user.py
from app.schemas.user import UserResponse
from app.services.auth_service import authenticate_user
# Import the new dependency and the User model
from app.services.user_service import get_current_active_user
from app.models.user import User

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    return authenticate_user(login_data, db)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Get current logged-in user's details.
    Implicitly validates the token provided in the Authorization header.
    """
    # The dependency already fetched and validated the user.
    # We just need to return the user data in the correct Pydantic schema format.
    # Ensure your UserResponse schema matches the fields you want to return.
    return current_user
