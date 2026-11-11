from typing import List, Optional, Set
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select
import jwt

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.exceptions import AuthenticationException, PermissionDeniedException
from app.db.session import get_db
from app.models.organization import User, Role, Employee

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_PREFIX}/auth/login",
    auto_error=False
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Dependency that extracts and validates the JWT bearer token, returning the authenticated User."""
    if not token:
        raise AuthenticationException("Authentication required. Please provide a Bearer token.")

    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub") or payload.get("user_id")
        if user_id_str is None:
            raise AuthenticationException("Invalid token payload: missing subject identifier.")
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError) as exc:
        raise AuthenticationException(f"Invalid or expired token: {str(exc)}")

    # Fetch user eagerly with role and employee
    stmt = (
        select(User)
        .options(
            joinedload(User.role),
            joinedload(User.employee)
        )
        .where(User.id == user_id)
    )
    user = db.scalar(stmt)

    if not user:
        raise AuthenticationException("Authenticated user record not found in system.")

    return user


def require_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensures the authenticated user account is active."""
    if not current_user.is_active:
        raise PermissionDeniedException("Your user account has been deactivated. Please contact an administrator.")
    return current_user


def require_roles(allowed_roles: List[str]):
    """
    Factory returning a dependency that enforces the current active user possesses one of the allowed role codes.
    Accepts list of allowed role codes (e.g. ['ADMIN', 'HR_MANAGER']).
    """
    def role_checker(current_user: User = Depends(require_active_user)) -> User:
        user_role_code = current_user.role.role_code if current_user.role else None

        # Check direct match
        if user_role_code in allowed_roles:
            return current_user

        # Support alias compatibility if any
        role_aliases = {
            "HR_ADMIN": "ADMIN",
            "HR_OPERATIONS": "HR_EXECUTIVE",
            "PEOPLE_MANAGER": "REPORTING_MANAGER",
        }
        mapped_code = role_aliases.get(user_role_code, user_role_code)
        if mapped_code in allowed_roles:
            return current_user

        raise PermissionDeniedException(
            f"Access denied. Required role: {', '.join(allowed_roles)}. Your role: {user_role_code}."
        )

    return role_checker


def get_reporting_employee_ids(db: Session, manager_employee_id: Optional[int]) -> Set[int]:
    """
    Returns the set of employee IDs reporting directly to the given manager_employee_id.
    Includes the manager themselves in the accessible scope.
    """
    if not manager_employee_id:
        return set()

    stmt = select(Employee.id).where(Employee.manager_id == manager_employee_id)
    direct_report_ids = set(db.scalars(stmt).all())
    # The manager can also access their own employee record
    direct_report_ids.add(manager_employee_id)
    return direct_report_ids

