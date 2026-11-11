from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.department import DepartmentRead, DepartmentDetail
from app.services.department_service import DepartmentService

router = APIRouter(prefix="/departments", tags=["Department Management"])


@router.get("", response_model=List[DepartmentRead], status_code=status.HTTP_200_OK)
def list_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List all enterprise departments across engineering and functional business units
    including employee headcount statistics.
    """
    return DepartmentService.list_departments(db)


@router.get("/{department_id}", response_model=DepartmentDetail, status_code=status.HTTP_200_OK)
def get_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve specific department details including Head of Department information.
    """
    return DepartmentService.get_department_by_id(db, department_id)

