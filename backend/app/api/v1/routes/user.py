from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserCreate, UserUpdate, UserOut, UserToggle
from app.services.user_service import (
    get_users,
    create_user,
    update_user,
    delete_user,
    toggle_user_status,
    get_users_by_type,
)
from app.core.dependencies import get_current_admin_user
from app.models.user import User
import sqlalchemy.exc

router = APIRouter()


@router.get("/users", response_model=list[UserOut], tags=["users"])
def list_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    return get_users(db)


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["users"],
)
def create_new_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        return create_user(db, user_data)
    except sqlalchemy.exc.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )


@router.put("/users/{user_id}", response_model=UserOut, tags=["users"])
def update_existing_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    updated_user = update_user(db, user_id, user_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user


@router.delete(
    "/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"]
)
def delete_existing_user(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    deleted_user = delete_user(db, user_id)
    if not deleted_user:
        raise HTTPException(status_code=404, detail="User not found")

    return None


@router.patch("/users/{user_id}/toggle", response_model=UserOut)
def toggle_user_status_endpoint(
    user_id: int,
    toggle_data: UserToggle,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    updated_user = toggle_user_status(db, user_id, toggle_data)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user


# Add a new endpoint to get users by type
@router.get("/users/by-type/{user_type}", response_model=list[UserOut])
def list_users_by_type(
    user_type: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    users = get_users_by_type(db, user_type)
    return users
