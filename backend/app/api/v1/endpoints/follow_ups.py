from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user, require_roles
from app.models.organization import User
from app.services.follow_up_service import FollowUpService
from app.schemas.common import PaginatedResponse, MessageResponse
from app.schemas.sla import (
    FollowUpRead,
    FollowUpCreate,
    FollowUpAcknowledge,
    FollowUpOverviewMetrics,
    EscalationRead,
    EscalationCreate,
    EscalationResolve,
    NotificationRead,
    ReminderTriggerResponse,
)

router = APIRouter(tags=["Follow-ups, Escalations & Reminders"])


# ----------------------------------------------------------------------------
# 1. Follow-ups
# ----------------------------------------------------------------------------
@router.get("/follow-ups/overview", response_model=FollowUpOverviewMetrics, status_code=status.HTTP_200_OK)
def get_follow_up_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Retrieve operational follow-up and escalation summary metrics scoped by role."""
    return FollowUpService.get_overview_metrics(db=db, current_user=current_user)


@router.get("/follow-ups", response_model=PaginatedResponse[FollowUpRead], status_code=status.HTTP_200_OK)
def list_follow_ups(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    task_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    target_user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="PENDING, RESPONSE_RECEIVED, ACKNOWLEDGED, OVERDUE"),
    category: Optional[str] = Query(None, description="HR Process Category filter"),
    view: Optional[str] = Query(None, description="AWAITING_RESPONSE, OVERDUE, RESPONSE_RECEIVED, COMPLETED, ALL"),
    response_received: Optional[bool] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List follow-up items with task, employee, and target owner context.
    REPORTING_MANAGER is scoped strictly to direct reports.
    """
    return FollowUpService.list_follow_ups(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        task_id=task_id,
        employee_id=employee_id,
        target_user_id=target_user_id,
        status=status,
        category=category,
        view=view,
        response_received=response_received,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )


@router.post("/follow-ups", response_model=FollowUpRead, status_code=status.HTTP_201_CREATED)
def schedule_follow_up(
    data: FollowUpCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Schedule a follow-up on an assigned task and notify target user."""
    return FollowUpService.schedule_follow_up(db=db, current_user=current_user, data=data)


@router.patch("/follow-ups/{follow_up_id}/acknowledge", response_model=FollowUpRead, status_code=status.HTTP_200_OK)
def acknowledge_follow_up(
    follow_up_id: int,
    data: FollowUpAcknowledge,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Acknowledge, reschedule, complete, or cancel a follow-up.
    Maintains authenticated actor history and notes.
    """
    return FollowUpService.acknowledge_follow_up(db=db, current_user=current_user, follow_up_id=follow_up_id, data=data)


# ----------------------------------------------------------------------------
# 2. Escalations
# ----------------------------------------------------------------------------
@router.get("/escalations", response_model=PaginatedResponse[EscalationRead], status_code=status.HTTP_200_OK)
def list_escalations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    task_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    escalated_to_user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None, description="OPEN, RESOLVED, ACKNOWLEDGED"),
    category: Optional[str] = Query(None, description="HR Process Category filter"),
    level: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """List escalations with reason, level, and resolution history."""
    return FollowUpService.list_escalations(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        task_id=task_id,
        employee_id=employee_id,
        escalated_to_user_id=escalated_to_user_id,
        status=status,
        category=category,
        level=level,
        search=search,
    )


@router.post("/escalations", response_model=EscalationRead, status_code=status.HTTP_201_CREATED)
def create_escalation(
    data: EscalationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Escalate a task. Prevents duplicate active open escalations at the same level.
    Dispatches high priority notifications to the recipient.
    """
    return FollowUpService.create_escalation(db=db, current_user=current_user, data=data)


@router.patch("/escalations/{escalation_id}/resolve", response_model=EscalationRead, status_code=status.HTTP_200_OK)
def resolve_escalation(
    escalation_id: int,
    data: EscalationResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Resolve or acknowledge an escalation with mandatory mitigation notes."""
    return FollowUpService.resolve_escalation(db=db, current_user=current_user, escalation_id=escalation_id, data=data)


# ----------------------------------------------------------------------------
# 3. Notifications & SLA Reminders
# ----------------------------------------------------------------------------
@router.get("/notifications", response_model=PaginatedResponse[NotificationRead], status_code=status.HTTP_200_OK)
def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """List operational and assignment notifications for the authenticated user."""
    return FollowUpService.list_notifications(
        db=db,
        current_user=current_user,
        unread_only=unread_only,
        page=page,
        size=size,
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead, status_code=status.HTTP_200_OK)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Mark a notification as read."""
    return FollowUpService.mark_notification_read(db=db, current_user=current_user, notification_id=notification_id)


@router.post("/notifications/read-all", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Mark all unread notifications for the authenticated user as read."""
    count = FollowUpService.mark_all_notifications_read(db=db, current_user=current_user)
    return MessageResponse(message=f"{count} notifications marked as read.")


@router.post("/reminders/trigger", response_model=ReminderTriggerResponse, status_code=status.HTTP_200_OK)
def trigger_sla_reminders(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]))
):
    """
    Trigger SLA verification and reminder engine.
    Scans overdue and upcoming tasks and generates notifications without duplicate spam.
    Restricted to HR Operations and Admin.
    """
    return FollowUpService.trigger_sla_reminders(db=db, current_user=current_user)

