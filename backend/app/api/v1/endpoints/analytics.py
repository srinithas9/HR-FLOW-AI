from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.analytics import (
    AnalyticsPerformanceResponse,
    ActivityRecordsResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["HR Operational Analytics & Performance"])


@router.get("/performance", response_model=AnalyticsPerformanceResponse, status_code=status.HTTP_200_OK)
def get_operational_performance(
    period: str = Query("12m", description="Reporting period: 30d, 90d, 6m, 12m, all"),
    department_id: Optional[int] = Query(None, description="Optional department filter"),
    process: Optional[str] = Query(None, description="Optional lifecycle process filter"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
):
    """
    Retrieve consolidated operational performance analytics:
    4 KPIs, On-Time Completion by Lifecycle Process, Monthly Trends,
    Process Turnaround Times, Recorded Delay Reasons, and Actionable Observations.
    """
    return AnalyticsService.get_performance_analytics(
        db=db,
        current_user=current_user,
        period=period,
        department_id=department_id,
        process=process,
    )


@router.get("/activities", response_model=ActivityRecordsResponse, status_code=status.HTTP_200_OK)
def list_drill_down_activities(
    process: Optional[str] = Query(None, description="Lifecycle process filter"),
    status: Optional[str] = Query(None, description="LATE, ON_TIME, or ALL"),
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    delay_reason: Optional[str] = Query(None, description="Delay reason substring"),
    department_id: Optional[int] = Query(None, description="Department ID filter"),
    search: Optional[str] = Query(None, description="Search by title, task code, employee name"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user),
):
    """
    Retrieve underlying activity records for drill-down investigation when inspecting charts or observations.
    """
    return AnalyticsService.list_activity_records(
        db=db,
        current_user=current_user,
        process=process,
        status_filter=status,
        month=month,
        delay_reason=delay_reason,
        department_id=department_id,
        search=search,
        page=page,
        size=size,
    )

