from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TaskAssigneeInfo(BaseModel):
    id: int
    full_name: str
    email: str
    role: Optional[str] = None
    department: Optional[str] = None


class TaskEmployeeInfo(BaseModel):
    id: int
    full_name: str
    employee_code: str
    department: Optional[str] = None


class PrerequisiteDetail(BaseModel):
    id: int
    task_code: str
    title: str
    status: str
    owner_name: str


class FollowUpDetail(BaseModel):
    id: int
    follow_up_date: str
    notes: str
    response_received: bool
    response_notes: Optional[str] = None


class EscalationDetail(BaseModel):
    id: int
    escalation_level: int
    reason: str
    status: str
    escalated_to_name: str


class WorkloadDetail(BaseModel):
    active_tasks_count: int
    historical_delay_rate: float


class ContributingFactorInfo(BaseModel):
    factor: str
    effect: str
    impact: float


class ModelPredictionDetails(BaseModel):
    delay_probability: float
    risk_level: str
    model_version: str
    advisory_note: str
    contributing_factors: List[ContributingFactorInfo] = []


class MLIntelligenceOverview(BaseModel):
    high_risk_tasks: int
    medium_risk_tasks: int = 0
    low_risk_tasks: int = 0
    needs_attention: int
    overdue_tasks: int
    upcoming_at_risk_deadlines: int
    total_active_tasks: int
    last_updated: str


class MLIntelligenceTaskItem(BaseModel):
    task_id: int
    task_code: str
    title: str
    category: str
    priority: str
    status: str
    due_date: str
    days_remaining: int
    is_overdue: bool
    overdue_days: int
    assignee: TaskAssigneeInfo
    employee: Optional[TaskEmployeeInfo] = None
    delay_probability: float
    risk_level: str
    hr_attention_priority: str
    main_concern: str
    bottlenecks: List[str] = []
    active_blockers_count: int = 0
    follow_ups_count: int = 0
    escalations_count: int = 0


class MLIntelligenceTaskAssessment(BaseModel):
    task_id: int
    task_code: str
    title: str
    category: str
    priority: str
    status: str
    due_date: str
    days_remaining: int
    is_overdue: bool
    overdue_days: int
    assignee: TaskAssigneeInfo
    employee: Optional[TaskEmployeeInfo] = None
    model_prediction: ModelPredictionDetails
    hr_attention_priority: str
    hr_attention_rule: str
    main_concern: str
    operational_facts: Dict[str, Any]
    observations: List[str]
    suggested_next_steps: List[str]
    available_actions: Dict[str, Any]


class BottleneckCategorySummary(BaseModel):
    id: str
    name: str
    count: int
    description: str
    filter_key: str


class MLIntelligenceBottlenecksResponse(BaseModel):
    categories: List[BottleneckCategorySummary]
    total_bottlenecked_tasks: int
