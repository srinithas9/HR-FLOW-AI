from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_roles, require_active_user
from app.core.exceptions import PermissionDeniedException
from app.models.organization import User
from app.schemas.user import UserRead, UserCreate, UserUpdate, UserStatusUpdate
from app.schemas.common import PaginatedResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=PaginatedResponse[UserRead], status_code=status.HTTP_200_OK)
def list_users(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    List platform user accounts with pagination and filtering.
    Restricted to ADMIN role only.
    """
    return UserService.list_users(
        db=db,
        page=page,
        size=size,
        role_id=role_id,
        is_active=is_active,
        search=search,
    )


@router.get("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve specific user details.
    ADMIN may view any user. Non-ADMIN users may only view their own user account.
    """
    user_role_code = current_user.role.role_code if current_user.role else ""
    if user_role_code != "ADMIN" and current_user.id != user_id:
        raise PermissionDeniedException("You do not have permission to view other user profiles.")

    user = UserService.get_user_by_id(db, user_id)
    return UserRead.model_validate(user)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Create a new platform user account.
    Restricted to ADMIN role only.
    """
    new_user = UserService.create_user(db, user_in)
    return UserRead.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Update user profile, role assignment, or password.
    Restricted to ADMIN role only.
    """
    updated_user = UserService.update_user(db, user_id, user_in)
    return UserRead.model_validate(updated_user)


@router.patch("/{user_id}/status", response_model=UserRead, status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: int,
    status_in: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    """
    Activate or deactivate a user account.
    Restricted to ADMIN role only.
    """
    updated_user = UserService.update_user_status(db, user_id, status_in.is_active)
    return UserRead.model_validate(updated_user)

