from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class KPIPerformance(BaseModel):
    activities_completed: int = Field(description="Unique eligible lifecycle activities completed during reporting period")
    on_time_completion_rate: float = Field(description="Percentage of completed activities finished on or before due date")
    median_completion_time_days: float = Field(description="Median duration in days from start to completion")
    late_completions: int = Field(description="Number of completed activities finished after due date")
    total_eligible: int = Field(description="Total completed activities with valid evaluation timestamps")


class ProcessOnTimeMetric(BaseModel):
    process_key: str = Field(description="Internal stage key: ONBOARDING, PROBATION, CONFIRMATION, DOCUMENTATION, PERFORMANCE, OFFBOARDING")
    process_name: str = Field(description="Display name of the lifecycle process")
    completed_count: int = Field(description="Total completed activities for this process")
    on_time_count: int = Field(description="Activities completed on or before due date")
    late_count: int = Field(description="Activities completed after due date")
    on_time_percentage: float = Field(description="On-time completion percentage (0-100)")


class MonthlyCompletionTrendItem(BaseModel):
    month: str = Field(description="YYYY-MM format")
    month_label: str = Field(description="Human readable label, e.g. Nov 2025")
    completed: int = Field(description="Activities completed in this month")
    late: int = Field(description="Late completions in this month")
    on_time: int = Field(description="On-time completions in this month")
    on_time_percentage: float = Field(description="Monthly on-time completion percentage")


class ProcessTurnaroundMetric(BaseModel):
    process_key: str = Field(description="Internal stage key")
    process_name: str = Field(description="Display name")
    median_days: float = Field(description="Median duration in days")
    unit: str = Field(default="days", description="Measurement unit")
    sample_size: int = Field(description="Number of valid completed records evaluated")


class RecordedDelayReasonItem(BaseModel):
    reason: str = Field(description="Actually recorded delay reason text from database")
    affected_activities: int = Field(description="Number of completed activities affected")
    percentage: float = Field(description="Percentage of delayed activities with this recorded reason")


class HROperationalObservation(BaseModel):
    id: str = Field(description="Unique observation identifier")
    category: str = Field(description="Category of observation")
    title: str = Field(description="Concise observation headline")
    observation: str = Field(description="What was observed from actual data")
    metric_or_process: str = Field(description="The relevant metric or process name")
    why_it_matters: str = Field(description="Why this matters to HR operations")
    recommended_action: str = Field(description="What HR should investigate or prioritize next")
    severity: str = Field(description="critical, warning, or info")
    action_filter: Optional[Dict[str, Any]] = Field(default=None, description="Filter parameters for drill-down")


class AnalyticsPerformanceResponse(BaseModel):
    reporting_period: str = Field(description="Selected period: 30d, 90d, 6m, 12m, all")
    period_start: str = Field(description="ISO date string for start of reporting period")
    period_end: str = Field(description="ISO date string for end of reporting period")
    last_refreshed_at: str = Field(description="ISO timestamp of data computation")
    kpis: KPIPerformance
    on_time_by_process: List[ProcessOnTimeMetric]
    monthly_trend: List[MonthlyCompletionTrendItem]
    turnaround_by_process: List[ProcessTurnaroundMetric]
    delay_reasons: List[RecordedDelayReasonItem]
    observations: List[HROperationalObservation]


class ActivityRecordItem(BaseModel):
    task_id: int
    task_code: str
    title: str
    category: str
    process_name: str
    status: str
    due_date: str
    completed_at: Optional[str] = None
    start_date: Optional[str] = None
    duration_days: Optional[float] = None
    is_late: bool
    assignee_name: str
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    delay_reason: Optional[str] = None


class ActivityRecordsResponse(BaseModel):
    items: List[ActivityRecordItem]
    total: int
    page: int
    size: int
    total_pages: int

