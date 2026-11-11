from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.dashboard import (
    DashboardOverviewResponse,
    MilestoneItem,
    ActivityItem,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["HR Operations Dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse, status_code=status.HTTP_200_OK)
def get_dashboard_overview(
    department_id: Optional[int] = Query(None, description="Optional department filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
):
    """
    Retrieve consolidated operational overview: 4 KPIs, 6 lifecycle stage counts,
    and prioritized Attention Required triage list.
    Strictly role-scoped:
      - ADMIN & HR_MANAGER: Full organization-wide view
      - HR_EXECUTIVE: Bounded by multi-entity assigned responsibilities
      - REPORTING_MANAGER: Scoped strictly to direct and indirect reports
    """
    return DashboardService.get_dashboard_overview(
        db=db,
        current_user=current_user,
        department_id=department_id,
    )


@router.get("/milestones", response_model=List[MilestoneItem], status_code=status.HTTP_200_OK)
def get_upcoming_milestones(
    department_id: Optional[int] = Query(None, description="Optional department filter"),
    days_ahead: int = Query(30, ge=1, le=90, description="Window of days ahead to search (default 30)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
):
    """
    Retrieve chronological timeline of upcoming employee lifecycle milestones
    (Onboarding completion, probation ending, confirmation due, offboarding exits).
    Strictly future-dated (target_date >= CURRENT_DATE).
    Excludes document expiry due to schema limitation.
    """
    return DashboardService.get_upcoming_milestones(
        db=db,
        current_user=current_user,
        department_id=department_id,
        days_ahead=days_ahead,
    )


@router.get("/activities", response_model=List[ActivityItem], status_code=status.HTTP_200_OK)
def get_recent_activities(
    limit: int = Query(10, ge=1, le=50, description="Maximum recent activities to return"),
    department_id: Optional[int] = Query(None, description="Optional department filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
):
    """
    Retrieve recent operational audit events from verified live activity_logs.
    Role-scoped and sorted descending by created_at.
    """
    return DashboardService.get_recent_activities(
        db=db,
        current_user=current_user,
        limit=limit,
        department_id=department_id,
    )
