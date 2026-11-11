from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# -----------------------------------------------------------------------------
# KPI Schemas
# -----------------------------------------------------------------------------
class DashboardKPIs(BaseModel):
    # Primary Approved HR Metrics
    total_employees: int = Field(..., description="Current active employee headcount on records (ACTIVE + CONFIRMED)")
    new_joiners_this_month: int = Field(..., description="Employees whose date of joining falls within current calendar month")
    exits_this_month: int = Field(..., description="Employees who completed their exit this calendar month")
    pending_hr_actions: int = Field(..., description="Tasks that are still awaiting action (non-completed, non-cancelled)")

    # Backward Compatibility fields
    active_employees: int = Field(default=0, description="Active headcount (same as total_employees)")
    open_tasks: int = Field(default=0, description="Same as pending_hr_actions")
    overdue_tasks: int = Field(default=0, description="Uncompleted tasks with due_date < current_date in Asia/Kolkata")
    tasks_due_next_7_days: int = Field(default=0, description="Uncompleted tasks with due_date in next 7 days")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Lifecycle Overview Schemas
# -----------------------------------------------------------------------------
class DashboardLifecycleStages(BaseModel):
    onboarding_active: int = Field(..., description="Active onboarding cases in progress")
    probation_active: int = Field(..., description="Active probation reviews under review or extended")
    confirmation_pending: int = Field(..., description="Confirmations pending formal approval")
    documentation_pending: int = Field(..., description="Mandatory documents pending submission or verification (honest 0)")
    performance_reviews_in_progress: int = Field(..., description="Active performance appraisal reviews in progress (honest 0)")
    offboarding_in_progress: int = Field(..., description="Separation cases currently in progress")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Attention Required Schemas
# -----------------------------------------------------------------------------
class AttentionItem(BaseModel):
    id: str = Field(..., description="Stable unique item identifier (e.g., 'task-1420', 'probation-191')")
    entity_id: int = Field(..., description="Database primary key of the underlying record")
    category: str = Field(..., description="OVERDUE_TASK, OVERDUE_REVIEW, OVERDUE_DECISION, PENDING_CLEARANCE, UNVERIFIED_DOCUMENT")
    severity: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW")
    title: str
    employee_id: int
    employee_name: str
    employee_code: str
    department_name: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    workflow_status: str
    due_date: Optional[date] = None
    days_overdue: int = 0
    action_required: str
    link_path: str = Field(..., description="Frontend target path to act on the issue")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Upcoming Milestones Schemas
# -----------------------------------------------------------------------------
class MilestoneItem(BaseModel):
    id: str = Field(..., description="Stable milestone identifier (e.g., 'ms-onboarding-196')")
    milestone_type: str = Field(..., description="ONBOARDING_COMPLETION, PROBATION_END, CONFIRMATION_DUE, PERFORMANCE_DEADLINE, OFFBOARDING_EXIT")
    title: str
    employee_id: int
    employee_name: str
    employee_code: str
    department_name: str
    target_date: date
    days_remaining: int
    status: str
    owner_name: Optional[str] = None
    link_path: str

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Recent HR Activities Schemas
# -----------------------------------------------------------------------------
class ActivityItem(BaseModel):
    id: int
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    action_label: str
    actor_id: Optional[int] = None
    actor_name: str
    employee_name: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    formatted_time: str

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Master Consolidated Overview Response
# -----------------------------------------------------------------------------
class BriefingItem(BaseModel):
    id: str
    headline: str
    description: str
    process: str
    action_label: str
    link_path: str
    severity: str = "INFO"

    model_config = ConfigDict(from_attributes=True)


class DashboardOverviewResponse(BaseModel):
    operational_date: date = Field(..., description="Current operational date in Asia/Kolkata")
    user_role: str
    department_id: Optional[int] = None
    kpis: DashboardKPIs
    lifecycle: DashboardLifecycleStages
    attention_required: List[AttentionItem] = Field(default_factory=list)
    total_attention_count: int = 0
    daily_briefing: List[BriefingItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
