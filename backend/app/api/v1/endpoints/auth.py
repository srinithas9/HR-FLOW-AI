from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import get_current_user, require_active_user
from app.models.organization import User
from app.schemas.auth import LoginRequest, TokenResponse, UserMeResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user using email and password.
    Returns a signed JWT access token and user profile metadata.
    """
    return AuthService.login(db, login_data)


@router.get("/me", response_model=UserMeResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(
    current_user: User = Depends(require_active_user)
):
    """
    Return currently authenticated user profile, assigned role, and employee link.
    Never returns password hash or internal secrets.
    """
    return UserMeResponse.model_validate(current_user)

