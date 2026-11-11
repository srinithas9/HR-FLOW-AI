from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.ml_intelligence import (
    MLIntelligenceOverview,
    MLIntelligenceTaskAssessment,
    MLIntelligenceBottlenecksResponse,
)
from app.services.ml_intelligence_service import MLIntelligenceService

router = APIRouter(prefix="/ml-intelligence", tags=["ML Intelligence & Task Delay Risk"])


@router.get("/overview", response_model=MLIntelligenceOverview, status_code=status.HTTP_200_OK)
def get_ml_intelligence_overview(
    department_id: Optional[int] = Query(None, description="Filter overview metrics by department"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve at-a-glance KPI metrics for task delay risk and operational bottlenecks.
    """
    return MLIntelligenceService.get_overview(db=db, current_user=current_user, department_id=department_id)


@router.get("/tasks", status_code=status.HTTP_200_OK)
def list_ml_intelligence_tasks(
    risk_level: Optional[str] = Query(None, description="HIGH, MEDIUM, LOW, or ALL"),
    attention_priority: Optional[str] = Query(None, description="CRITICAL, NEEDS_ATTENTION, MONITOR, or ALL"),
    process: Optional[str] = Query(None, description="ONBOARDING, PROBATION, CONFIRMATION, PERFORMANCE, OFFBOARDING, COMPLIANCE"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    owner_id: Optional[int] = Query(None, description="Filter by owner user ID"),
    bottleneck: Optional[str] = Query(None, description="WAITING_RESPONSE, PENDING_DEPENDENCY, WORKLOAD_PRESSURE, REPEATED_REMINDERS, STALLED_PROGRESS, LIFECYCLE_MILESTONE"),
    overdue_only: Optional[bool] = Query(None, description="Only return overdue tasks"),
    search: Optional[str] = Query(None, description="Search by task title, code, employee name, or assignee"),
    sort_by: str = Query("priority", description="priority, risk, due_date, days_remaining"),
    sort_order: str = Query("desc", description="asc or desc"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List at-risk active tasks with real-time delay risk predictions, verified evidence, and HR attention priorities.
    """
    return MLIntelligenceService.list_at_risk_tasks(
        db=db,
        current_user=current_user,
        risk_level=risk_level,
        attention_priority=attention_priority,
        process=process,
        department_id=department_id,
        owner_id=owner_id,
        bottleneck=bottleneck,
        overdue_only=overdue_only,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        size=size
    )


@router.get("/tasks/{task_id}/assessment", response_model=MLIntelligenceTaskAssessment, status_code=status.HTTP_200_OK)
def get_task_operational_assessment(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve comprehensive task delay risk assessment, verified operational evidence, and recommended HR actions.
    """
    return MLIntelligenceService.get_task_assessment(db=db, current_user=current_user, task_id=task_id)


@router.get("/bottlenecks", response_model=MLIntelligenceBottlenecksResponse, status_code=status.HTTP_200_OK)
def get_operational_bottlenecks_summary(
    department_id: Optional[int] = Query(None, description="Filter bottlenecks by department"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve high-level summary of active operational bottlenecks across all pending tasks.
    """
    return MLIntelligenceService.get_operational_bottlenecks(db=db, current_user=current_user, department_id=department_id)
