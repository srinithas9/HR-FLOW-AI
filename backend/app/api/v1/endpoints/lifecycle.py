from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user, require_roles
from app.models.organization import User
from app.schemas.lifecycle import (
    LifecycleOverview,
    ProcessCardMetric,
    OnboardingRecordRead,
    OnboardingRecordUpdate,
    ProbationRecordRead,
    ProbationRecordUpdate,
    ConfirmationRecordRead,
    ConfirmationRecordUpdate,
    ConfirmationApprovalRequest,
    PerformanceReviewRead,
    PerformanceReviewUpdate,
    OffboardingRecordRead,
    OffboardingRecordUpdate,
    TaskTemplateRead,
    TaskTemplateCreate,
    TaskTemplateUpdate,
    TemplateExecutionPreview,
    TemplateExecutionRequest,
    TemplateExecutionResult,
    LifecycleCalendarEvent,
    OnboardingInitiateRequest,
    ConfirmationRecommendationRequest,
    ConfirmationDecisionRequest,
    PerformanceCycleCreate,
    OffboardingInitiateRequest,
    OffboardingCompleteRequest,
)
from app.schemas.document import EmployeeDocumentRead, DocumentVerificationUpdate
from app.schemas.common import PaginatedResponse
from app.services.lifecycle_service import LifecycleService

router = APIRouter(prefix="/lifecycle", tags=["Employee Lifecycle Management"])


@router.get("/overview", response_model=LifecycleOverview, status_code=status.HTTP_200_OK)
def get_lifecycle_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve real-time aggregate KPI counts across all 6 employee lifecycle areas:
    Total active, onboarding in progress, probation under review, confirmation pending,
    performance reviews in progress, offboarding clearances, and confirmed employees.
    """
    return LifecycleService.get_lifecycle_overview(db=db, current_user=current_user)


# ----------------------------------------------------------------------------
# 1. Onboarding
# ----------------------------------------------------------------------------
@router.get("/onboarding", response_model=PaginatedResponse[OnboardingRecordRead], status_code=status.HTTP_200_OK)
def list_onboarding_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="IN_PROGRESS, COMPLETED, DELAYED"),
    it_asset_status: Optional[str] = Query(None),
    bgv_status: Optional[str] = Query(None),
    orientation_completed: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List onboarding stage records with multi-dimensional filtering (IT assets, BGV, orientation).
    REPORTING_MANAGER is scoped strictly to direct reporting new hires.
    """
    return LifecycleService.list_onboarding(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        status=status,
        it_asset_status=it_asset_status,
        bgv_status=bgv_status,
        orientation_completed=orientation_completed,
    )


@router.get("/onboarding/eligible-employees", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def get_eligible_employees_for_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    List active or probation employees who do not have an active onboarding record.
    """
    return LifecycleService.get_eligible_employees_for_onboarding(db=db, current_user=current_user)


@router.post("/onboarding", response_model=OnboardingRecordRead, status_code=status.HTTP_201_CREATED)
def initiate_onboarding(
    data: OnboardingInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Initiate onboarding workflow for a new hire, optionally creating lifecycle checklist tasks from templates.
    """
    return LifecycleService.initiate_onboarding(db=db, current_user=current_user, data=data)


@router.patch("/onboarding/{record_id}", response_model=OnboardingRecordRead, status_code=status.HTTP_200_OK)
def update_onboarding_record(
    record_id: int,
    data: OnboardingRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Update onboarding progress (IT asset status, BGV status, orientation completion, overall status).
    """
    return LifecycleService.update_onboarding(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 2. Probation
# ----------------------------------------------------------------------------
@router.get("/probation", response_model=PaginatedResponse[ProbationRecordRead], status_code=status.HTTP_200_OK)
def list_probation_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="UNDER_REVIEW, EXTENDED, COMPLETED"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List probation records with expected end dates, extension reasons, and feedback.
    REPORTING_MANAGER is scoped strictly to direct reports.
    """
    return LifecycleService.list_probation(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        status=status,
    )


@router.patch("/probation/{record_id}", response_model=ProbationRecordRead, status_code=status.HTTP_200_OK)
def update_probation_record(
    record_id: int,
    data: ProbationRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Update probation evaluation: manager feedback, HR evaluation, end date extension, and reason.
    """
    return LifecycleService.update_probation(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 3. Confirmation
# ----------------------------------------------------------------------------
@router.get("/confirmation", response_model=PaginatedResponse[ConfirmationRecordRead], status_code=status.HTTP_200_OK)
def list_confirmation_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="PENDING_APPROVAL, APPROVED_BY_MANAGER, CONFIRMED"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List confirmation records pending or granted review.
    REPORTING_MANAGER is scoped strictly to direct reports.
    """
    return LifecycleService.list_confirmation(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        status=status,
    )


@router.post("/confirmation/{record_id}/approve", response_model=ConfirmationRecordRead, status_code=status.HTTP_200_OK)
def approve_confirmation(
    record_id: int,
    data: ConfirmationApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER", "REPORTING_MANAGER"]))
):
    """
    Human-in-the-loop confirmation decision:
    - If called by REPORTING_MANAGER: records manager recommendation / approval.
    - If called by HR_MANAGER / ADMIN: finalizes formal confirmation, marks employee as CONFIRMED,
      and transitions employee lifecycle stage.
    - HR_EXECUTIVE is forbidden (HTTP 403).
    """
    return LifecycleService.approve_confirmation(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


@router.post("/confirmation/{record_id}/recommend", response_model=ConfirmationRecordRead, status_code=status.HTTP_200_OK)
def recommend_confirmation(
    record_id: int,
    data: ConfirmationRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER", "REPORTING_MANAGER"]))
):
    """
    Reporting Manager submits confirmation recommendation and feedback.
    """
    return LifecycleService.submit_confirmation_recommendation(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


@router.post("/confirmation/{record_id}/decision", response_model=ConfirmationRecordRead, status_code=status.HTTP_200_OK)
def decide_confirmation(
    record_id: int,
    data: ConfirmationDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Formal human-in-the-loop confirmation decision:
    - CONFIRMED: Employee status updated to CONFIRMED, new lifecycle stage created, letter issued.
    - EXTENDED: Probation extended with reason and new date.
    - REJECTED: Confirmation rejected.
    HR_EXECUTIVE is strictly forbidden.
    """
    return LifecycleService.finalize_confirmation_decision(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 4. Document Verification
# ----------------------------------------------------------------------------
@router.get("/documents", response_model=PaginatedResponse[EmployeeDocumentRead], status_code=status.HTTP_200_OK)
def list_documents(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="PENDING_SUBMISSION, SUBMITTED, VERIFIED, REJECTED"),
    employee_id: Optional[int] = Query(None),
    requirement_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List employee compliance documents with requirement specifications and verification status.
    """
    return LifecycleService.list_documents(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        status=status,
        employee_id=employee_id,
        requirement_id=requirement_id,
    )


@router.patch("/documents/{document_id}/verify", response_model=EmployeeDocumentRead, status_code=status.HTTP_200_OK)
def verify_document(
    document_id: int,
    data: DocumentVerificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]))
):
    """
    Verify or reject compliance document with reviewer attribution and feedback notes.
    Restricted to HR Operations and Admin.
    """
    return LifecycleService.verify_document(
        db=db,
        current_user=current_user,
        document_id=document_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 5. Performance Reviews
# ----------------------------------------------------------------------------
@router.get("/performance-reviews/cycles", response_model=List[str], status_code=status.HTTP_200_OK)
def list_performance_cycles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List distinct bi-annual performance review cycles.
    """
    return LifecycleService.list_performance_cycles(db=db)


@router.post("/performance-reviews/cycle", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_performance_cycle(
    data: PerformanceCycleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Create a new company-wide or department-specific performance review cycle.
    """
    return LifecycleService.create_performance_cycle(db=db, current_user=current_user, data=data)


@router.get("/performance-reviews", response_model=PaginatedResponse[PerformanceReviewRead], status_code=status.HTTP_200_OK)
def list_performance_reviews(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    cycle: Optional[str] = Query(None, description="e.g. FY23-H1, FY23-H2, FY24-H1, FY24-H2"),
    status: Optional[str] = Query(None, description="DRAFT, SUBMITTED, COMPLETED"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List bi-annual performance appraisal cycles with self-review and manager-review statuses.
    REPORTING_MANAGER is scoped strictly to direct reports.
    """
    return LifecycleService.list_performance_reviews(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        cycle=cycle,
        status=status,
    )


@router.patch("/performance-reviews/{review_id}", response_model=PerformanceReviewRead, status_code=status.HTTP_200_OK)
def update_performance_review(
    review_id: int,
    data: PerformanceReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Update performance review ratings, self/manager review status, and completion.
    """
    return LifecycleService.update_performance_review(
        db=db,
        current_user=current_user,
        review_id=review_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 6. Offboarding
# ----------------------------------------------------------------------------
@router.get("/offboarding/eligible-employees", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def get_eligible_employees_for_offboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    List active or probation employees who do not have an active offboarding record.
    """
    return LifecycleService.get_eligible_employees_for_offboarding(db=db, current_user=current_user)


@router.post("/offboarding", response_model=OffboardingRecordRead, status_code=status.HTTP_201_CREATED)
def initiate_offboarding(
    data: OffboardingInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Initiate offboarding separation workflow for an employee, optionally creating exit tasks from templates.
    """
    return LifecycleService.initiate_offboarding(db=db, current_user=current_user, data=data)


@router.get("/offboarding", response_model=PaginatedResponse[OffboardingRecordRead], status_code=status.HTTP_200_OK)
def list_offboarding_records(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="IN_PROGRESS, COMPLETED"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List offboarding records with resignation date, last working day, and clearances.
    """
    return LifecycleService.list_offboarding(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        status=status,
    )


@router.patch("/offboarding/{record_id}", response_model=OffboardingRecordRead, status_code=status.HTTP_200_OK)
def update_offboarding_record(
    record_id: int,
    data: OffboardingRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Update offboarding clearance items: IT asset return, KT status, clearance status, exit interview.
    """
    return LifecycleService.update_offboarding(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


@router.post("/offboarding/{record_id}/complete", response_model=OffboardingRecordRead, status_code=status.HTTP_200_OK)
def complete_offboarding(
    record_id: int,
    data: OffboardingCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Finalize offboarding: marks clearances complete, transitions employee to RESIGNED, completes lifecycle stage.
    """
    return LifecycleService.complete_offboarding(
        db=db,
        current_user=current_user,
        record_id=record_id,
        data=data,
    )


# ----------------------------------------------------------------------------
# 7. Lifecycle Templates
# ----------------------------------------------------------------------------
@router.get("/templates", response_model=List[TaskTemplateRead], status_code=status.HTTP_200_OK)
def list_lifecycle_templates(
    category: Optional[str] = Query(None, description="ONBOARDING, PROBATION, CONFIRMATION, PERFORMANCE, OFFBOARDING, COMPLIANCE"),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List reusable lifecycle checklist & task-generation templates.
    """
    return LifecycleService.list_templates(db=db, category=category, is_active=is_active)


@router.post("/templates", response_model=TaskTemplateRead, status_code=status.HTTP_201_CREATED)
def create_lifecycle_template(
    data: TaskTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Create a new lifecycle task template (ADMIN, HR_MANAGER only).
    """
    return LifecycleService.create_template(db=db, current_user=current_user, data=data)


@router.post("/templates/preview", response_model=TemplateExecutionPreview, status_code=status.HTTP_200_OK)
def preview_template_execution(
    employee_id: int = Query(...),
    template_ids: List[int] = Query(...),
    start_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Preview tasks that will be generated for an employee from chosen templates, with duplicate detection.
    """
    return LifecycleService.preview_template_execution(
        db=db,
        employee_id=employee_id,
        template_ids=template_ids,
        start_date=start_date,
    )


@router.post("/templates/execute", response_model=TemplateExecutionResult, status_code=status.HTTP_200_OK)
def execute_lifecycle_templates(
    data: TemplateExecutionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Execute task templates for an employee, automatically assigning to manager or HR with duplicate prevention.
    """
    return LifecycleService.execute_templates(db=db, current_user=current_user, data=data)


@router.patch("/templates/{template_id}", response_model=TaskTemplateRead, status_code=status.HTTP_200_OK)
def update_lifecycle_template(
    template_id: int,
    data: TaskTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Update a lifecycle task template (ADMIN, HR_MANAGER only).
    """
    return LifecycleService.update_template(db=db, current_user=current_user, template_id=template_id, data=data)


@router.post("/templates/{template_id}/toggle-active", response_model=TaskTemplateRead, status_code=status.HTTP_200_OK)
def toggle_active_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Toggle is_active on a task template (ADMIN, HR_MANAGER only).
    """
    return LifecycleService.toggle_active_template(db=db, current_user=current_user, template_id=template_id)


# ----------------------------------------------------------------------------
# 8. Lifecycle Calendar
# ----------------------------------------------------------------------------
@router.get("/calendar", response_model=List[LifecycleCalendarEvent], status_code=status.HTTP_200_OK)
def get_lifecycle_calendar(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None, description="ONBOARDING, PROBATION, CONFIRMATION, PERFORMANCE, OFFBOARDING"),
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve operational lifecycle events aggregated across milestones and deadlines.
    Scoped by RBAC for Reporting Managers.
    """
    return LifecycleService.get_calendar_events(
        db=db,
        current_user=current_user,
        start_date=start_date,
        end_date=end_date,
        category=category,
        department_id=department_id,
    )


