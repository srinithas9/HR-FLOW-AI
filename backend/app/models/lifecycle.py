from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    BigInteger,
    String,
    Boolean,
    Text,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class EmployeeLifecycle(Base):
    __tablename__ = "employee_lifecycle"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    current_stage: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    stage_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    stage_target_date: Mapped[date] = mapped_column(Date, nullable=False)
    stage_status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_PROGRESS", index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class OnboardingRecord(Base):
    __tablename__ = "onboarding_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    target_completion_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    buddy_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    it_asset_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    bgv_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    orientation_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    overall_status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_PROGRESS", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ProbationRecord(Base):
    __tablename__ = "probation_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    probation_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    probation_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    extended_end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    extension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    manager_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hr_evaluation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="UNDER_REVIEW", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ConfirmationRecord(Base):
    __tablename__ = "confirmation_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    probation_record_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("probation_records.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    confirmation_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    effective_confirmation_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    approved_by_manager_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    approved_by_hr_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmation_letter_issued: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING_APPROVAL", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    review_cycle: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    reviewer_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    self_review_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    manager_review_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    rating: Mapped[Optional[float]] = mapped_column(Numeric(3, 2), nullable=True)
    review_submission_deadline: Mapped[date] = mapped_column(Date, nullable=False)
    completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="DRAFT", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class OffboardingRecord(Base):
    __tablename__ = "offboarding_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    resignation_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_working_day: Mapped[date] = mapped_column(Date, nullable=False)
    exit_interview_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    asset_recovery_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    kt_status: Mapped[str] = mapped_column(String(30), nullable=False, default="NOT_STARTED")
    clearance_status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    overall_status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_PROGRESS", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

