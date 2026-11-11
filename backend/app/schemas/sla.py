from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class FollowUpRead(BaseModel):
    id: int
    task_id: int
    initiator_user_id: int
    target_user_id: int
    follow_up_date: date
    notes: str
    response_received: bool
    response_notes: Optional[str] = None
    created_at: datetime

    # Display & joined helpers
    initiator_name: Optional[str] = None
    initiator_role_name: Optional[str] = None
    target_name: Optional[str] = None
    target_role_name: Optional[str] = None
    task_code: Optional[str] = None
    task_title: Optional[str] = None
    category: Optional[str] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    status: str = "PENDING_RESPONSE"
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class FollowUpCreate(BaseModel):
    task_id: int
    target_user_id: Optional[int] = None
    follow_up_date: date
    notes: str = Field(..., min_length=3, description="Follow-up message or instructions")
    reminder_timing: Optional[str] = Field("IMMEDIATE", description="IMMEDIATE, 1_DAY_BEFORE, ON_DUE_DATE")


class FollowUpAcknowledge(BaseModel):
    action: str = Field("ACKNOWLEDGE", description="ACKNOWLEDGE, RESCHEDULE, CANCEL, COMPLETE")
    response_notes: str = Field(..., min_length=3, description="Response notes or acknowledgement remarks")
    rescheduled_date: Optional[date] = Field(None, description="Required when action is RESCHEDULE")


class FollowUpResponse(BaseModel):
    response_notes: str = Field(..., min_length=3)


class NotificationRead(BaseModel):
    id: int
    user_id: int
    task_id: Optional[int] = None
    title: str
    message: str
    notification_type: str
    is_read: bool
    read_at: Optional[datetime] = None
    sent_at: datetime
    task_code: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EscalationRead(BaseModel):
    id: int
    task_id: int
    escalated_by_user_id: int
    escalated_to_user_id: int
    escalation_level: int
    reason: str
    status: str
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    # Display helpers
    task_code: Optional[str] = None
    task_title: Optional[str] = None
    category: Optional[str] = None
    escalated_by_name: Optional[str] = None
    escalated_to_name: Optional[str] = None
    escalated_to_role_name: Optional[str] = None
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EscalationCreate(BaseModel):
    task_id: int
    escalated_to_user_id: int
    escalation_level: int = Field(1, ge=1, le=3, description="Escalation severity level (1, 2, or 3)")
    reason: str = Field(..., min_length=5, description="Clear business reason for escalation")


class EscalationResolve(BaseModel):
    status: str = Field("RESOLVED", description="RESOLVED or ACKNOWLEDGED")
    resolution_notes: str = Field(..., min_length=5, description="Explanation of resolution or mitigation steps")


class ReminderTriggerResponse(BaseModel):
    tasks_scanned: int
    notifications_created: int
    escalations_created: int
    summary: str


class FollowUpOverviewMetrics(BaseModel):
    total_follow_ups: int = 0
    awaiting_response: int = 0
    overdue: int = 0
    response_received: int = 0
    completed: int = 0
    total_escalations: int = 0
    open_escalations: int = 0
    acknowledged_escalations: int = 0
    resolved_escalations: int = 0
