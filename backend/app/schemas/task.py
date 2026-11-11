from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


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


class MLPredictionInfo(BaseModel):
    id: Optional[int] = None
    model_version: str
    predicted_delay_probability: float
    predicted_label: int
    confidence_score: float
    risk_level: str
    prediction_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskRead(BaseModel):
    id: int
    task_code: str
    template_id: Optional[int] = None
    employee_id: int
    owner_id: int
    category: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    due_date: date
    start_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    deadline_extension_count: int = 0
    last_deadline_change_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Display & joined helpers
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    owner_name: Optional[str] = None
    template_name: Optional[str] = None
    is_overdue: bool = False
    last_follow_up_date: Optional[date] = None

    # ML Risk intelligence (only present when valid stored prediction exists)
    ml_risk_score: Optional[float] = None
    ml_risk_level: Optional[str] = None
    ml_confidence_score: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    employee_id: int
    category: str = Field(..., description="ONBOARDING, PROBATION, CONFIRMATION, PERFORMANCE, OFFBOARDING, COMPLIANCE")
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    priority: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, CRITICAL")
    due_date: date
    start_date: Optional[date] = None
    template_id: Optional[int] = None
    owner_id: Optional[int] = None
    prerequisite_task_ids: Optional[List[int]] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    priority: Optional[str] = Field(None, description="LOW, MEDIUM, HIGH, CRITICAL")
    category: Optional[str] = None
    start_date: Optional[date] = None


class TaskStatusUpdate(BaseModel):
    status: str = Field(..., description="PENDING, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED")
    reason: Optional[str] = None
    override_dependencies: bool = False
    override_reason: Optional[str] = None


class TaskReassign(BaseModel):
    new_owner_id: int
    reason: Optional[str] = None


class TaskDeadlineExtension(BaseModel):
    new_due_date: date
    reason: str = Field(..., min_length=5, description="Mandatory audit reason for deadline change")


class TaskDependencyCreate(BaseModel):
    prerequisite_task_id: int
    dependency_type: str = Field("FINISH_TO_START", description="FINISH_TO_START, START_TO_START")


class TaskDependencyRead(BaseModel):
    id: int
    task_id: int
    prerequisite_task_id: int
    dependency_type: str
    created_at: datetime

    # Display helpers
    prerequisite_task_code: Optional[str] = None
    prerequisite_title: Optional[str] = None
    prerequisite_status: Optional[str] = None
    prerequisite_due_date: Optional[date] = None
    prerequisite_owner_name: Optional[str] = None

    # For reverse view (dependents)
    dependent_task_code: Optional[str] = None
    dependent_title: Optional[str] = None
    dependent_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TaskStatusHistoryRead(BaseModel):
    id: int
    task_id: int
    old_status: str
    new_status: str
    old_owner_id: Optional[int] = None
    new_owner_id: Optional[int] = None
    old_due_date: Optional[date] = None
    new_due_date: Optional[date] = None
    changed_by_user_id: int
    change_reason: Optional[str] = None
    changed_at: datetime

    changed_by_name: Optional[str] = None
    old_owner_name: Optional[str] = None
    new_owner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TaskOverviewMetrics(BaseModel):
    total_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    blocked_tasks: int
    completed_tasks: int
    overdue_tasks: int
    high_risk_tasks: int
    active_tasks: int = 0
    total_active_tasks: int = 0
    delayed_tasks: int = 0
    due_in_7_days: int = 0


class TaskCommentCreate(BaseModel):
    comment: str = Field(..., min_length=1, max_length=2000, description="Task comment text")


class TaskCommentRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    author_name: str
    comment: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskReopen(BaseModel):
    reason: Optional[str] = Field("Reopening task for further review", max_length=500)


from app.schemas.ml import MLShadowPrediction

class TaskDetail(TaskRead):
    prerequisites: List[TaskDependencyRead] = []
    successors: List[TaskDependencyRead] = []
    status_history: List[TaskStatusHistoryRead] = []
    comments: List[TaskCommentRead] = []
    latest_prediction: Optional[MLPredictionInfo] = None
    shadow_prediction: Optional[MLShadowPrediction] = None
    is_blocked: bool = False
    blocking_prerequisites: List[Dict[str, Any]] = []
