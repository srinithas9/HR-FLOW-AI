from typing import Optional, List, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class EmployeeLifecycleRead(BaseModel):
    id: int
    employee_id: int
    current_stage: str
    stage_start_date: date
    stage_target_date: date
    stage_status: str
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OnboardingRecordRead(BaseModel):
    id: int
    employee_id: int
    start_date: date
    target_completion_date: date
    actual_completion_date: Optional[date] = None
    buddy_id: Optional[int] = None
    it_asset_status: str
    bgv_status: str
    orientation_completed: bool
    overall_status: str
    created_at: datetime
    updated_at: datetime

    # Display helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    buddy_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OnboardingRecordUpdate(BaseModel):
    it_asset_status: Optional[str] = None
    bgv_status: Optional[str] = None
    orientation_completed: Optional[bool] = None
    overall_status: Optional[str] = None
    actual_completion_date: Optional[date] = None
    buddy_id: Optional[int] = None


class ProbationRecordRead(BaseModel):
    id: int
    employee_id: int
    probation_start_date: date
    probation_end_date: date
    extended_end_date: Optional[date] = None
    extension_reason: Optional[str] = None
    manager_feedback: Optional[str] = None
    hr_evaluation: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    # Display helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    manager_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProbationRecordUpdate(BaseModel):
    extended_end_date: Optional[date] = None
    extension_reason: Optional[str] = None
    manager_feedback: Optional[str] = None
    hr_evaluation: Optional[str] = None
    status: Optional[str] = None


class ConfirmationRecordRead(BaseModel):
    id: int
    probation_record_id: int
    employee_id: int
    confirmation_due_date: date
    effective_confirmation_date: Optional[date] = None
    approved_by_manager_id: Optional[int] = None
    approved_by_hr_id: Optional[int] = None
    confirmation_letter_issued: bool
    status: str
    created_at: datetime
    updated_at: datetime

    # Display helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    manager_name: Optional[str] = None
    approved_by_hr_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConfirmationApprovalRequest(BaseModel):
    effective_confirmation_date: Optional[date] = None
    confirmation_letter_issued: bool = True
    notes: Optional[str] = None


class ConfirmationRecordUpdate(BaseModel):
    effective_confirmation_date: Optional[date] = None
    confirmation_letter_issued: Optional[bool] = None
    status: Optional[str] = None


class PerformanceReviewRead(BaseModel):
    id: int
    employee_id: int
    review_cycle: str
    reviewer_id: int
    self_review_status: str
    manager_review_status: str
    rating: Optional[float] = None
    review_submission_deadline: date
    completion_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime

    # Display helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    reviewer_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PerformanceReviewUpdate(BaseModel):
    self_review_status: Optional[str] = None
    manager_review_status: Optional[str] = None
    rating: Optional[float] = None
    status: Optional[str] = None
    completion_date: Optional[date] = None


class OffboardingRecordRead(BaseModel):
    id: int
    employee_id: int
    resignation_date: date
    last_working_day: date
    exit_interview_completed: bool
    asset_recovery_status: str
    kt_status: str
    clearance_status: str
    overall_status: str
    created_at: datetime
    updated_at: datetime

    # Display helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OffboardingRecordUpdate(BaseModel):
    exit_interview_completed: Optional[bool] = None
    asset_recovery_status: Optional[str] = None
    kt_status: Optional[str] = None
    clearance_status: Optional[str] = None
    overall_status: Optional[str] = None
    last_working_day: Optional[date] = None


class ProcessCardMetric(BaseModel):
    stage: str
    title: str
    description: str
    primary_count: int
    primary_label: str
    secondary_count: int
    secondary_label: str
    action_required_count: int
    action_required_label: str


class LifecycleOverview(BaseModel):
    total_active_employees: int
    onboarding_active: int
    probation_active: int
    confirmation_pending: int
    performance_reviews_in_progress: int
    offboarding_in_progress: int
    confirmed_employees: int
    process_cards: Optional[List[ProcessCardMetric]] = None


# ----------------------------------------------------------------------------
# Lifecycle Templates Schemas
# ----------------------------------------------------------------------------
class TaskTemplateRead(BaseModel):
    id: int
    template_code: str
    name: str
    category: str
    default_priority: str
    estimated_duration_days: int
    default_role_code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskTemplateCreate(BaseModel):
    template_code: str
    name: str
    category: str
    default_priority: str = "MEDIUM"
    estimated_duration_days: int = 3
    default_role_code: str
    description: Optional[str] = None
    is_active: bool = True


class TaskTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    default_priority: Optional[str] = None
    estimated_duration_days: Optional[int] = None
    default_role_code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TemplateTaskPreviewItem(BaseModel):
    template_id: int
    template_code: str
    title: str
    category: str
    priority: str
    estimated_duration_days: int
    calculated_due_date: date
    target_role_code: str
    target_assignee_name: Optional[str] = None
    target_assignee_id: Optional[int] = None
    is_duplicate: bool
    duplicate_task_id: Optional[int] = None


class TemplateExecutionPreview(BaseModel):
    employee_id: int
    employee_name: str
    department_name: Optional[str] = None
    template_tasks: List[TemplateTaskPreviewItem]
    new_tasks_count: int
    duplicate_tasks_count: int


class TemplateExecutionRequest(BaseModel):
    employee_id: int
    template_ids: List[int]
    start_date: Optional[date] = None


class TemplateExecutionResult(BaseModel):
    employee_id: int
    created_task_ids: List[int]
    skipped_duplicate_template_ids: List[int]
    total_created: int


# ----------------------------------------------------------------------------
# Lifecycle Calendar Schemas
# ----------------------------------------------------------------------------
class LifecycleCalendarEvent(BaseModel):
    id: str
    category: str
    event_type: str
    title: str
    date: date
    employee_id: int
    employee_name: str
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    status: str
    priority: Optional[str] = "MEDIUM"
    details_url: Optional[str] = None


# ----------------------------------------------------------------------------
# Operational Request Schemas
# ----------------------------------------------------------------------------
class OnboardingInitiateRequest(BaseModel):
    employee_id: int
    start_date: date
    target_completion_date: date
    buddy_id: Optional[int] = None
    template_ids: Optional[List[int]] = None


class ConfirmationRecommendationRequest(BaseModel):
    manager_recommendation: str  # RECOMMENDED, EXTEND_PROBATION, NOT_RECOMMENDED
    manager_feedback: str


class ConfirmationDecisionRequest(BaseModel):
    decision: str  # CONFIRMED, EXTENDED, REJECTED
    effective_confirmation_date: Optional[date] = None
    confirmation_letter_issued: bool = True
    extension_months: Optional[int] = None
    notes: Optional[str] = None


class PerformanceCycleCreate(BaseModel):
    cycle_name: str
    submission_deadline: date
    department_id: Optional[int] = None


class OffboardingInitiateRequest(BaseModel):
    employee_id: int
    resignation_date: date
    last_working_day: date
    reason: Optional[str] = None
    template_ids: Optional[List[int]] = None


class OffboardingCompleteRequest(BaseModel):
    notes: Optional[str] = None

