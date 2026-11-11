from datetime import datetime
from typing import Optional, Any, Dict, List
from sqlalchemy import (
    BigInteger,
    String,
    Boolean,
    Text,
    DateTime,
    Integer,
    Numeric,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class TaskSnapshot(Base):
    __tablename__ = "task_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    snapshot_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    task_category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    days_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    current_status: Mapped[str] = mapped_column(String(30), nullable=False)
    reminder_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    owner_previous_delay_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0.0)
    owner_current_workload: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dependency_status: Mapped[str] = mapped_column(String(30), nullable=False, default="NONE")
    task_priority: Mapped[str] = mapped_column(String(20), nullable=False)
    is_eligible_for_prediction: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_snapshot_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("task_snapshots.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    predicted_delay_probability: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    predicted_label: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    prediction_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    insight_category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    insight_text: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    supporting_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    review_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING_REVIEW", index=True)
    reviewed_by_user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    employee_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    recommendation_category: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="MEDIUM")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    snooze_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    snooze_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    supporting_evidence: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ai_rec_user_status", "user_id", "status"),
        Index("ix_ai_rec_snooze", "status", "snooze_until"),
    )


class AIRecommendationHistory(Base):
    __tablename__ = "ai_recommendation_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("ai_recommendations.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    previous_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    action_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_metadata: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_ai_rec_hist_rec_id", "recommendation_id"),
        Index("ix_ai_rec_hist_user_id", "user_id"),
    )


class AIOperationalSummary(Base):
    __tablename__ = "ai_operational_summaries"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    summary_type: Mapped[str] = mapped_column(String(20), nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    target_role: Mapped[str] = mapped_column(String(30), nullable=False, default="HR_OPERATIONS")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_metrics: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    critical_bottlenecks: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    action_items: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("summary_type", "target_role", "period_start", "period_end", name="uq_summary_period"),
    )
