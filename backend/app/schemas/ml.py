from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MLFeatureInput(BaseModel):
    days_remaining: int = Field(default=5, ge=1, le=60, description="Calendar days remaining until task due date")
    task_category: str = Field(default="ONBOARDING", description="ONBOARDING, PROBATION, PERFORMANCE, COMPLIANCE, OFFBOARDING")
    task_priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    current_status: str = Field(default="IN_PROGRESS", description="IN_PROGRESS, COMPLETED, BLOCKED")
    reminder_count: int = Field(default=0, ge=0, le=10, description="Total SLA/manager reminders dispatched before observation")
    owner_previous_delay_rate: float = Field(default=0.20, ge=0.0, le=1.0, description="Owner smoothed historical delay frequency")
    owner_current_workload: int = Field(default=8, ge=0, le=100, description="Active concurrent incomplete tasks assigned to owner")
    dependency_status: str = Field(default="NONE", description="NONE, ALL_MET, PENDING")

    model_config = ConfigDict(extra="forbid")  # Forbid unauthorized extra fields strictly


class ContributingFactor(BaseModel):
    factor: str
    effect: str
    impact: float


class MLShadowPrediction(BaseModel):
    task_id: Optional[int] = None
    delay_probability: float = Field(ge=0.0, le=1.0)
    risk_level: str = Field(description="LOW, MEDIUM, HIGH")
    model_version: str = "v2.1.0-phase7a"
    is_experimental: bool = True
    prediction_timestamp: datetime
    contributing_factors: List[ContributingFactor] = []
    features_used: Dict[str, Any]
    disclaimer: str = (
        "EXPERIMENTAL SHADOW PREDICTION — For decision support only. "
        "Model precision in HIGH tier is 15.71%. Does not alter task state or autonomously trigger notifications."
    )


class CopilotTaskAssessment(BaseModel):
    task_id: int
    task_code: str
    task_title: str
    official_status: str
    due_date: str
    is_overdue: bool
    shadow_prediction: MLShadowPrediction
    copilot_interpretation: str
    recommended_supportive_actions: List[str]
    human_in_the_loop_notice: str = (
        "HUMAN-IN-THE-LOOP MANDATE: This assessment is an automated decision-support indicator. "
        "Predictions are probabilistic and non-causal. All operational decisions require human manager review and approval."
    )

