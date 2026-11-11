from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.core.security import verify_password, create_access_token
from app.core.config import settings
from app.core.exceptions import AuthenticationException, PermissionDeniedException
from app.models.organization import User
from app.schemas.auth import LoginRequest, TokenResponse, AuthUserRead


class AuthService:
    @staticmethod
    def login(db: Session, login_data: LoginRequest) -> TokenResponse:
        """
        Authenticate user with email and password.
        Returns a signed JWT access token and user metadata.
        Never reveals whether a specific email exists upon failure.
        """
        stmt = (
            select(User)
            .options(
                joinedload(User.role),
                joinedload(User.employee)
            )
            .where(User.email == login_data.email.strip().lower())
        )
        user = db.scalar(stmt)

        # Constant-time-like rejection for non-existent users or bad passwords
        if not user or not user.hashed_password:
            raise AuthenticationException("Invalid email or password.")

        if not verify_password(login_data.password, user.hashed_password):
            raise AuthenticationException("Invalid email or password.")

        if not user.is_active:
            raise PermissionDeniedException("User account is inactive. Please contact an administrator.")

        # Update last login timestamp
        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)

        role_code = user.role.role_code if user.role else "EMPLOYEE"
        token = create_access_token(
            subject=user.id,
            role=role_code,
            email=user.email,
            user_id=user.id,
            employee_id=user.employee_id,
        )

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            user=AuthUserRead.model_validate(user),
        )

