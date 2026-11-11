from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.role import RoleRead
from app.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["Role Management"])


@router.get("", response_model=List[RoleRead], status_code=status.HTTP_200_OK)
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Return the approved platform business roles:
    ADMIN, HR_EXECUTIVE, REPORTING_MANAGER, HR_MANAGER.
    Arbitrary role creation is disabled.
    """
    return RoleService.list_roles(db)

