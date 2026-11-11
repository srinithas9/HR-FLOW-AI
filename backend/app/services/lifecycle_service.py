from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import uuid
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, func, or_, desc, asc

from app.core.exceptions import ResourceNotFoundException, PermissionDeniedException, ValidationException
from app.core.permissions import get_reporting_employee_ids
from app.models.organization import Employee, Department, User, Role
from app.models.lifecycle import (
    EmployeeLifecycle,
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)
from app.models.compliance import EmployeeDocument, DocumentRequirement
from app.models.workflow import TaskTemplate, Task
from app.models.intelligence import ActivityLog
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
    TemplateTaskPreviewItem,
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
from app.schemas.common import PaginatedResponse, PaginationMeta


class LifecycleService:
    @staticmethod
    def get_lifecycle_overview(db: Session, current_user: User) -> LifecycleOverview:
        """
        Calculate aggregate summary KPIs across all 6 employee lifecycle areas.
        """
        # Scoping for reporting managers
        role_code = current_user.role.role_code if current_user.role else ""
        rep_ids = None
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)

        def apply_scope(stmt, model):
            if rep_ids is not None:
                return stmt.where(model.employee_id.in_(rep_ids))
            return stmt

        # Total active employees
        emp_stmt = select(func.count(Employee.id)).where(Employee.employment_status.in_(["CONFIRMED", "PROBATION", "NOTICE_PERIOD", "ACTIVE"]))
        if rep_ids is not None:
            emp_stmt = emp_stmt.where(Employee.id.in_(rep_ids))
        total_active = db.scalar(emp_stmt) or 0

        # Confirmed employees
        conf_emp_stmt = select(func.count(Employee.id)).where(Employee.employment_status.in_(["CONFIRMED", "ACTIVE"]))
        if rep_ids is not None:
            conf_emp_stmt = conf_emp_stmt.where(Employee.id.in_(rep_ids))
        total_confirmed = db.scalar(conf_emp_stmt) or 0

        # Onboarding active
        onb_stmt = apply_scope(
            select(func.count(OnboardingRecord.id)).where(OnboardingRecord.overall_status == "IN_PROGRESS"),
            OnboardingRecord
        )
        onb_active = db.scalar(onb_stmt) or 0

        # Probation active
        prob_stmt = apply_scope(
            select(func.count(ProbationRecord.id)).where(ProbationRecord.status == "UNDER_REVIEW"),
            ProbationRecord
        )
        prob_active = db.scalar(prob_stmt) or 0

        # Confirmation pending
        conf_stmt = apply_scope(
            select(func.count(ConfirmationRecord.id)).where(ConfirmationRecord.status == "PENDING_APPROVAL"),
            ConfirmationRecord
        )
        conf_pending = db.scalar(conf_stmt) or 0

        # Performance reviews in progress
        perf_stmt = apply_scope(
            select(func.count(PerformanceReview.id)).where(PerformanceReview.status.in_(["DRAFT", "IN_PROGRESS", "SUBMITTED"])),
            PerformanceReview
        )
        perf_in_progress = db.scalar(perf_stmt) or 0

        # Offboarding in progress
        off_stmt = apply_scope(
            select(func.count(OffboardingRecord.id)).where(OffboardingRecord.overall_status == "IN_PROGRESS"),
            OffboardingRecord
        )
        off_in_progress = db.scalar(off_stmt) or 0

        today = date.today()

        # 1. Onboarding
        onb_completed = db.scalar(apply_scope(
            select(func.count(OnboardingRecord.id)).where(OnboardingRecord.overall_status == "COMPLETED"),
            OnboardingRecord
        )) or 0
        onb_action = db.scalar(apply_scope(
            select(func.count(OnboardingRecord.id)).where(
                OnboardingRecord.overall_status == "IN_PROGRESS",
                or_(
                    OnboardingRecord.bgv_status != "COMPLETED",
                    OnboardingRecord.it_asset_status != "PROVISIONED",
                    OnboardingRecord.orientation_completed.is_(False),
                    OnboardingRecord.target_completion_date < today
                )
            ),
            OnboardingRecord
        )) or 0

        # 2. Probation
        prob_confirmed = db.scalar(apply_scope(
            select(func.count(ProbationRecord.id)).where(ProbationRecord.status.in_(["COMPLETED", "CONFIRMED"])),
            ProbationRecord
        )) or 0
        prob_action = db.scalar(apply_scope(
            select(func.count(ProbationRecord.id)).where(
                ProbationRecord.status.in_(["UNDER_REVIEW", "EXTENDED"]),
                or_(
                    ProbationRecord.probation_end_date <= today + timedelta(days=14),
                    ProbationRecord.status == "EXTENDED"
                )
            ),
            ProbationRecord
        )) or 0

        # 3. Confirmation
        conf_completed = db.scalar(apply_scope(
            select(func.count(ConfirmationRecord.id)).where(ConfirmationRecord.status == "CONFIRMED"),
            ConfirmationRecord
        )) or 0
        conf_action = db.scalar(apply_scope(
            select(func.count(ConfirmationRecord.id)).where(
                ConfirmationRecord.status.in_(["PENDING_APPROVAL", "UNDER_REVIEW"]),
                or_(
                    ConfirmationRecord.confirmation_due_date <= today + timedelta(days=7),
                    ConfirmationRecord.approved_by_manager_id.is_(None)
                )
            ),
            ConfirmationRecord
        )) or 0

        # 4. Documentation
        doc_verified = db.scalar(apply_scope(
            select(func.count(EmployeeDocument.id)).where(EmployeeDocument.status == "VERIFIED"),
            EmployeeDocument
        )) or 0
        doc_total = db.scalar(apply_scope(
            select(func.count(EmployeeDocument.id)),
            EmployeeDocument
        )) or 0
        doc_action = db.scalar(apply_scope(
            select(func.count(EmployeeDocument.id)).where(
                EmployeeDocument.status.in_(["PENDING_SUBMISSION", "SUBMITTED", "REJECTED"])
            ),
            EmployeeDocument
        )) or 0

        # 5. Performance Reviews
        perf_completed = db.scalar(apply_scope(
            select(func.count(PerformanceReview.id)).where(PerformanceReview.status == "COMPLETED"),
            PerformanceReview
        )) or 0
        perf_action = db.scalar(apply_scope(
            select(func.count(PerformanceReview.id)).where(
                PerformanceReview.status.in_(["DRAFT", "IN_PROGRESS", "SUBMITTED"]),
                or_(
                    PerformanceReview.manager_review_status != "COMPLETED",
                    PerformanceReview.review_submission_deadline < today
                )
            ),
            PerformanceReview
        )) or 0

        # 6. Offboarding
        off_completed = db.scalar(apply_scope(
            select(func.count(OffboardingRecord.id)).where(OffboardingRecord.overall_status == "COMPLETED"),
            OffboardingRecord
        )) or 0
        off_action = db.scalar(apply_scope(
            select(func.count(OffboardingRecord.id)).where(
                OffboardingRecord.overall_status == "IN_PROGRESS",
                or_(
                    OffboardingRecord.asset_recovery_status != "RETURNED",
                    OffboardingRecord.clearance_status != "CLEARED",
                    OffboardingRecord.last_working_day <= today + timedelta(days=7)
                )
            ),
            OffboardingRecord
        )) or 0

        cards = [
            ProcessCardMetric(
                stage="ONBOARDING",
                title="Onboarding",
                description="Coordinate new hire joining, equipment provisioning, background verification, and company orientation.",
                primary_count=onb_active,
                primary_label="In Progress",
                secondary_count=onb_completed,
                secondary_label="Completed",
                action_required_count=onb_action,
                action_required_label="Action Required",
            ),
            ProcessCardMetric(
                stage="PROBATION",
                title="Probation",
                description="Track evaluation milestones, manager feedback, and probation extension or completion decisions.",
                primary_count=prob_active,
                primary_label="Under Review",
                secondary_count=prob_confirmed,
                secondary_label="Confirmed",
                action_required_count=prob_action,
                action_required_label="Review Due Soon",
            ),
            ProcessCardMetric(
                stage="CONFIRMATION",
                title="Confirmation",
                description="Review manager recommendations, record HR decisions, and issue confirmation letters.",
                primary_count=conf_pending,
                primary_label="Pending Decision",
                secondary_count=conf_completed,
                secondary_label="Confirmed",
                action_required_count=conf_action,
                action_required_label="Action Required",
            ),
            ProcessCardMetric(
                stage="DOCUMENTATION",
                title="Documentation",
                description="Collect, review, and verify employee identity, education, and statutory compliance documents.",
                primary_count=doc_verified,
                primary_label="Verified Docs",
                secondary_count=doc_total,
                secondary_label="Total Documents",
                action_required_count=doc_action,
                action_required_label="Pending Verification",
            ),
            ProcessCardMetric(
                stage="PERFORMANCE",
                title="Performance Reviews",
                description="Manage appraisal cycles, employee self-reviews, manager evaluations, and performance ratings.",
                primary_count=perf_in_progress,
                primary_label="Active Reviews",
                secondary_count=perf_completed,
                secondary_label="Completed",
                action_required_count=perf_action,
                action_required_label="Action Required",
            ),
            ProcessCardMetric(
                stage="OFFBOARDING",
                title="Offboarding",
                description="Coordinate resignation handover, knowledge transfer, company equipment return, and exit clearances.",
                primary_count=off_in_progress,
                primary_label="In Progress",
                secondary_count=off_completed,
                secondary_label="Completed",
                action_required_count=off_action,
                action_required_label="Clearance Pending",
            ),
        ]

        return LifecycleOverview(
            total_active_employees=total_active,
            onboarding_active=onb_active,
            probation_active=prob_active,
            confirmation_pending=conf_pending,
            performance_reviews_in_progress=perf_in_progress,
            offboarding_in_progress=off_in_progress,
            confirmed_employees=total_confirmed,
            process_cards=cards,
        )

    # ------------------------------------------------------------------------
    # 1. Onboarding Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_onboarding(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        status: Optional[str] = None,
        it_asset_status: Optional[str] = None,
        bgv_status: Optional[str] = None,
        orientation_completed: Optional[bool] = None,
    ) -> PaginatedResponse[OnboardingRecordRead]:
        Buddy = aliased(Employee)
        stmt = (
            select(
                OnboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Department.name.label("department_name"),
                func.concat(Buddy.first_name, " ", Buddy.last_name).label("buddy_name")
            )
            .join(Employee, OnboardingRecord.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Buddy, OnboardingRecord.buddy_id == Buddy.id)
        )

        # Scoping for reporting managers
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(OnboardingRecord.employee_id.in_(rep_ids))

        if status:
            stmt = stmt.where(OnboardingRecord.overall_status == status.strip().upper())
        if it_asset_status:
            stmt = stmt.where(OnboardingRecord.it_asset_status == it_asset_status.strip().upper())
        if bgv_status:
            stmt = stmt.where(OnboardingRecord.bgv_status == bgv_status.strip().upper())
        if orientation_completed is not None:
            stmt = stmt.where(OnboardingRecord.orientation_completed == orientation_completed)

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(OnboardingRecord.start_date)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for rec, emp_name, emp_code, dept_name, buddy_name in rows:
            r = OnboardingRecordRead.model_validate(rec)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            r.buddy_name = buddy_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def update_onboarding(
        db: Session,
        current_user: User,
        record_id: int,
        data: OnboardingRecordUpdate
    ) -> OnboardingRecordRead:
        rec = db.scalar(select(OnboardingRecord).where(OnboardingRecord.id == record_id))
        if not rec:
            raise ResourceNotFoundException(f"Onboarding record with ID {record_id} does not exist.")

        # RBAC Check
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if rec.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only update records for your direct reports.")

        changes = {}
        if data.it_asset_status is not None:
            changes["it_asset_status"] = (rec.it_asset_status, data.it_asset_status)
            rec.it_asset_status = data.it_asset_status.strip().upper()
        if data.bgv_status is not None:
            changes["bgv_status"] = (rec.bgv_status, data.bgv_status)
            rec.bgv_status = data.bgv_status.strip().upper()
        if data.orientation_completed is not None:
            changes["orientation_completed"] = (rec.orientation_completed, data.orientation_completed)
            rec.orientation_completed = data.orientation_completed
        if data.overall_status is not None:
            changes["overall_status"] = (rec.overall_status, data.overall_status)
            rec.overall_status = data.overall_status.strip().upper()
        if data.actual_completion_date is not None:
            rec.actual_completion_date = data.actual_completion_date
        if data.buddy_id is not None:
            rec.buddy_id = data.buddy_id

        # Log activity
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="ONBOARDING_RECORD",
            entity_id=record_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(rec)

        return OnboardingRecordRead.model_validate(rec)

    # ------------------------------------------------------------------------
    # 2. Probation Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_probation(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        status: Optional[str] = None,
    ) -> PaginatedResponse[ProbationRecordRead]:
        Manager = aliased(Employee)
        stmt = (
            select(
                ProbationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Department.name.label("department_name"),
                func.concat(Manager.first_name, " ", Manager.last_name).label("manager_name")
            )
            .join(Employee, ProbationRecord.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Manager, Employee.manager_id == Manager.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(ProbationRecord.employee_id.in_(rep_ids))

        if status:
            stmt = stmt.where(ProbationRecord.status == status.strip().upper())

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(ProbationRecord.probation_end_date)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for rec, emp_name, emp_code, dept_name, mgr_name in rows:
            r = ProbationRecordRead.model_validate(rec)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            r.manager_name = mgr_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def update_probation(
        db: Session,
        current_user: User,
        record_id: int,
        data: ProbationRecordUpdate
    ) -> ProbationRecordRead:
        rec = db.scalar(select(ProbationRecord).where(ProbationRecord.id == record_id))
        if not rec:
            raise ResourceNotFoundException(f"Probation record with ID {record_id} does not exist.")

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if rec.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only update probation reviews for your direct reports.")

        changes = {}
        if data.manager_feedback is not None:
            changes["manager_feedback"] = data.manager_feedback
            rec.manager_feedback = data.manager_feedback.strip()
        if data.hr_evaluation is not None:
            changes["hr_evaluation"] = data.hr_evaluation
            rec.hr_evaluation = data.hr_evaluation.strip()
        if data.extended_end_date is not None:
            changes["extended_end_date"] = str(data.extended_end_date)
            rec.extended_end_date = data.extended_end_date
        if data.extension_reason is not None:
            changes["extension_reason"] = data.extension_reason
            rec.extension_reason = data.extension_reason.strip()
        if data.status is not None:
            changes["status"] = (rec.status, data.status)
            rec.status = data.status.strip().upper()

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="PROBATION_RECORD",
            entity_id=record_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(rec)

        return ProbationRecordRead.model_validate(rec)

    # ------------------------------------------------------------------------
    # 3. Confirmation Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_confirmation(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        status: Optional[str] = None,
    ) -> PaginatedResponse[ConfirmationRecordRead]:
        Manager = aliased(Employee)
        HRUser = aliased(User)
        stmt = (
            select(
                ConfirmationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Department.name.label("department_name"),
                func.concat(Manager.first_name, " ", Manager.last_name).label("manager_name"),
                HRUser.full_name.label("approved_by_hr_name")
            )
            .join(Employee, ConfirmationRecord.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Manager, ConfirmationRecord.approved_by_manager_id == Manager.id)
            .outerjoin(HRUser, ConfirmationRecord.approved_by_hr_id == HRUser.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(ConfirmationRecord.employee_id.in_(rep_ids))

        if status:
            stmt = stmt.where(ConfirmationRecord.status == status.strip().upper())

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(ConfirmationRecord.confirmation_due_date)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for rec, emp_name, emp_code, dept_name, mgr_name, hr_name in rows:
            r = ConfirmationRecordRead.model_validate(rec)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            r.manager_name = mgr_name
            r.approved_by_hr_name = hr_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def approve_confirmation(
        db: Session,
        current_user: User,
        record_id: int,
        data: ConfirmationApprovalRequest
    ) -> ConfirmationRecordRead:
        """
        Human-in-the-loop confirmation approval.
        Updates status to APPROVED/CONFIRMED, records decision date and authorized approver,
        and transitions the employee's status to CONFIRMED.
        """
        rec = db.scalar(select(ConfirmationRecord).where(ConfirmationRecord.id == record_id))
        if not rec:
            raise ResourceNotFoundException(f"Confirmation record with ID {record_id} does not exist.")

        role_code = current_user.role.role_code if current_user.role else ""
        effective_date = data.effective_confirmation_date or date.today()

        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if rec.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only recommend confirmation for your direct reports.")
            rec.approved_by_manager_id = current_user.employee_id
            rec.status = "APPROVED_BY_MANAGER"
        elif role_code in ["ADMIN", "HR_MANAGER"]:
            # HR or Admin approval finalizes confirmation
            rec.approved_by_hr_id = current_user.id
            rec.status = "CONFIRMED"
            rec.effective_confirmation_date = effective_date
            rec.confirmation_letter_issued = data.confirmation_letter_issued

            # Update Employee's employment_status
            emp = db.scalar(select(Employee).where(Employee.id == rec.employee_id))
            if emp:
                emp.employment_status = "CONFIRMED"

            # Create/update lifecycle stage
            lifecycle = db.scalar(
                select(EmployeeLifecycle)
                .where(EmployeeLifecycle.employee_id == rec.employee_id)
                .order_by(desc(EmployeeLifecycle.stage_start_date))
            )
            if lifecycle and lifecycle.current_stage != "CONFIRMED":
                lifecycle.stage_status = "COMPLETED"
                lifecycle.completed_at = datetime.now()

                new_lifecycle = EmployeeLifecycle(
                    employee_id=rec.employee_id,
                    current_stage="CONFIRMED",
                    stage_start_date=effective_date,
                    stage_target_date=effective_date + timedelta(days=365),
                    stage_status="IN_PROGRESS",
                    notes="Employee formally confirmed following probation evaluation."
                )
                db.add(new_lifecycle)
        else:
            raise PermissionDeniedException(
                "Access denied: HR Executives and unauthorized roles cannot make confirmation decisions."
            )

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="CONFIRMATION_RECORD",
            entity_id=record_id,
            action="APPROVE_CONFIRMATION",
            details={
                "effective_date": str(effective_date),
                "approver_role": role_code,
                "status": rec.status,
                "notes": data.notes,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(rec)

        return ConfirmationRecordRead.model_validate(rec)

    # ------------------------------------------------------------------------
    # 4. Document Verification Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_documents(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        status: Optional[str] = None,
        employee_id: Optional[int] = None,
        requirement_id: Optional[int] = None,
    ) -> PaginatedResponse[EmployeeDocumentRead]:
        stmt = (
            select(
                EmployeeDocument,
                DocumentRequirement.name.label("requirement_name")
            )
            .join(DocumentRequirement, EmployeeDocument.requirement_id == DocumentRequirement.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(EmployeeDocument.employee_id.in_(rep_ids))

        if employee_id is not None:
            stmt = stmt.where(EmployeeDocument.employee_id == employee_id)
        if requirement_id is not None:
            stmt = stmt.where(EmployeeDocument.requirement_id == requirement_id)
        if status:
            stmt = stmt.where(EmployeeDocument.status == status.strip().upper())

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(EmployeeDocument.submission_date)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for doc, req_name in rows:
            r = EmployeeDocumentRead.model_validate(doc)
            r.requirement_name = req_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def verify_document(
        db: Session,
        current_user: User,
        document_id: int,
        data: DocumentVerificationUpdate
    ) -> EmployeeDocumentRead:
        doc = db.scalar(select(EmployeeDocument).where(EmployeeDocument.id == document_id))
        if not doc:
            raise ResourceNotFoundException(f"Employee document with ID {document_id} does not exist.")

        new_status = data.status.strip().upper()
        if new_status not in ["VERIFIED", "REJECTED"]:
            raise ValidationException("Status must be either 'VERIFIED' or 'REJECTED'.")

        doc.status = new_status
        doc.verification_notes = data.verification_notes.strip() if data.verification_notes else None
        doc.verified_by_id = current_user.id
        doc.verified_at = datetime.now()

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="EMPLOYEE_DOCUMENT",
            entity_id=document_id,
            action="VERIFY_DOCUMENT",
            details={
                "status": new_status,
                "notes": doc.verification_notes,
                "verified_by": current_user.full_name,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(doc)

        return EmployeeDocumentRead.model_validate(doc)

    # ------------------------------------------------------------------------
    # 5. Performance Reviews Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_performance_reviews(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        cycle: Optional[str] = None,
        status: Optional[str] = None,
    ) -> PaginatedResponse[PerformanceReviewRead]:
        Reviewer = aliased(Employee)
        stmt = (
            select(
                PerformanceReview,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Department.name.label("department_name"),
                func.concat(Reviewer.first_name, " ", Reviewer.last_name).label("reviewer_name")
            )
            .join(Employee, PerformanceReview.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Reviewer, PerformanceReview.reviewer_id == Reviewer.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(PerformanceReview.employee_id.in_(rep_ids))

        if cycle:
            stmt = stmt.where(PerformanceReview.review_cycle == cycle.strip())
        if status:
            stmt = stmt.where(PerformanceReview.status == status.strip().upper())

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(PerformanceReview.review_submission_deadline)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for rev, emp_name, emp_code, dept_name, rev_name in rows:
            r = PerformanceReviewRead.model_validate(rev)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            r.reviewer_name = rev_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def update_performance_review(
        db: Session,
        current_user: User,
        review_id: int,
        data: PerformanceReviewUpdate
    ) -> PerformanceReviewRead:
        rev = db.scalar(select(PerformanceReview).where(PerformanceReview.id == review_id))
        if not rev:
            raise ResourceNotFoundException(f"Performance review with ID {review_id} does not exist.")

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if rev.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only update reviews for your direct reports.")

        changes = {}
        if data.self_review_status is not None:
            changes["self_review_status"] = (rev.self_review_status, data.self_review_status)
            rev.self_review_status = data.self_review_status.strip().upper()
        if data.manager_review_status is not None:
            changes["manager_review_status"] = (rev.manager_review_status, data.manager_review_status)
            rev.manager_review_status = data.manager_review_status.strip().upper()
        if data.rating is not None:
            if data.rating < 1.0 or data.rating > 5.0:
                raise ValidationException("Performance rating must be between 1.00 and 5.00.")
            changes["rating"] = (float(rev.rating) if rev.rating else None, float(data.rating))
            rev.rating = data.rating
        if data.status is not None:
            changes["status"] = (rev.status, data.status)
            rev.status = data.status.strip().upper()
        if data.completion_date is not None:
            rev.completion_date = data.completion_date

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="PERFORMANCE_REVIEW",
            entity_id=review_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(rev)

        return PerformanceReviewRead.model_validate(rev)

    # ------------------------------------------------------------------------
    # 6. Offboarding Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_offboarding(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        status: Optional[str] = None,
    ) -> PaginatedResponse[OffboardingRecordRead]:
        stmt = (
            select(
                OffboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Department.name.label("department_name")
            )
            .join(Employee, OffboardingRecord.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(OffboardingRecord.employee_id.in_(rep_ids))

        if status:
            stmt = stmt.where(OffboardingRecord.overall_status == status.strip().upper())

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(OffboardingRecord.resignation_date)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for off, emp_name, emp_code, dept_name in rows:
            r = OffboardingRecordRead.model_validate(off)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def update_offboarding(
        db: Session,
        current_user: User,
        record_id: int,
        data: OffboardingRecordUpdate
    ) -> OffboardingRecordRead:
        off = db.scalar(select(OffboardingRecord).where(OffboardingRecord.id == record_id))
        if not off:
            raise ResourceNotFoundException(f"Offboarding record with ID {record_id} does not exist.")

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if off.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only update offboarding clearance for your direct reports.")

        changes = {}
        if data.asset_recovery_status is not None:
            changes["asset_recovery_status"] = (off.asset_recovery_status, data.asset_recovery_status)
            off.asset_recovery_status = data.asset_recovery_status.strip().upper()
        if data.kt_status is not None:
            changes["kt_status"] = (off.kt_status, data.kt_status)
            off.kt_status = data.kt_status.strip().upper()
        if data.clearance_status is not None:
            changes["clearance_status"] = (off.clearance_status, data.clearance_status)
            off.clearance_status = data.clearance_status.strip().upper()
        if data.exit_interview_completed is not None:
            changes["exit_interview_completed"] = (off.exit_interview_completed, data.exit_interview_completed)
            off.exit_interview_completed = data.exit_interview_completed
        if data.overall_status is not None:
            changes["overall_status"] = (off.overall_status, data.overall_status)
            off.overall_status = data.overall_status.strip().upper()
        if data.last_working_day is not None:
            off.last_working_day = data.last_working_day

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="OFFBOARDING_RECORD",
            entity_id=record_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(off)

        return OffboardingRecordRead.model_validate(off)

    # ------------------------------------------------------------------------
    # 7. Lifecycle Templates Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_templates(
        db: Session,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[TaskTemplateRead]:
        stmt = select(TaskTemplate)
        if category:
            stmt = stmt.where(TaskTemplate.category == category.strip().upper())
        if is_active is not None:
            stmt = stmt.where(TaskTemplate.is_active == is_active)
        stmt = stmt.order_by(TaskTemplate.category, TaskTemplate.id)
        templates = db.scalars(stmt).all()
        return [TaskTemplateRead.model_validate(t) for t in templates]

    @staticmethod
    def create_template(db: Session, current_user: User, data: TaskTemplateCreate) -> TaskTemplateRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can create lifecycle templates.")

        code = data.template_code.strip().upper()
        existing = db.scalar(select(TaskTemplate).where(TaskTemplate.template_code == code))
        if existing:
            raise ValidationException(f"Template with code {code} already exists.")

        tmpl = TaskTemplate(
            template_code=code,
            name=data.name.strip(),
            category=data.category.strip().upper(),
            default_priority=data.default_priority.strip().upper(),
            estimated_duration_days=data.estimated_duration_days,
            default_role_code=data.default_role_code.strip().upper(),
            description=data.description.strip() if data.description else None,
            is_active=data.is_active,
        )
        db.add(tmpl)
        db.commit()
        db.refresh(tmpl)
        return TaskTemplateRead.model_validate(tmpl)

    @staticmethod
    def update_template(db: Session, current_user: User, template_id: int, data: TaskTemplateUpdate) -> TaskTemplateRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can update lifecycle templates.")

        tmpl = db.scalar(select(TaskTemplate).where(TaskTemplate.id == template_id))
        if not tmpl:
            raise ResourceNotFoundException(f"Template with ID {template_id} does not exist.")

        if data.name is not None:
            tmpl.name = data.name.strip()
        if data.category is not None:
            tmpl.category = data.category.strip().upper()
        if data.default_priority is not None:
            tmpl.default_priority = data.default_priority.strip().upper()
        if data.estimated_duration_days is not None:
            tmpl.estimated_duration_days = data.estimated_duration_days
        if data.default_role_code is not None:
            tmpl.default_role_code = data.default_role_code.strip().upper()
        if data.description is not None:
            tmpl.description = data.description.strip()
        if data.is_active is not None:
            tmpl.is_active = data.is_active

        db.commit()
        db.refresh(tmpl)
        return TaskTemplateRead.model_validate(tmpl)

    @staticmethod
    def toggle_active_template(db: Session, current_user: User, template_id: int) -> TaskTemplateRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can toggle lifecycle templates.")

        tmpl = db.scalar(select(TaskTemplate).where(TaskTemplate.id == template_id))
        if not tmpl:
            raise ResourceNotFoundException(f"Template with ID {template_id} does not exist.")

        tmpl.is_active = not tmpl.is_active
        db.commit()
        db.refresh(tmpl)
        return TaskTemplateRead.model_validate(tmpl)

    @staticmethod
    def preview_template_execution(
        db: Session,
        employee_id: int,
        template_ids: List[int],
        start_date: Optional[date] = None,
    ) -> TemplateExecutionPreview:
        emp = db.scalar(select(Employee).where(Employee.id == employee_id))
        if not emp:
            raise ResourceNotFoundException(f"Employee with ID {employee_id} not found.")

        base_date = start_date or date.today()
        templates = db.scalars(select(TaskTemplate).where(TaskTemplate.id.in_(template_ids))).all()

        existing_tasks = db.scalars(
            select(Task).where(Task.employee_id == employee_id, Task.status != "CANCELLED")
        ).all()
        existing_template_ids = {t.template_id: t.id for t in existing_tasks if t.template_id}
        existing_titles = {(t.category, t.title.lower()): t.id for t in existing_tasks}

        preview_items = []
        new_count = 0
        dup_count = 0

        for tmpl in templates:
            calc_due = base_date + timedelta(days=tmpl.estimated_duration_days)
            dup_id = existing_template_ids.get(tmpl.id) or existing_titles.get((tmpl.category, tmpl.name.lower()))
            is_dup = dup_id is not None
            if is_dup:
                dup_count += 1
            else:
                new_count += 1

            assignee_name = None
            assignee_id = None
            if tmpl.default_role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
                if emp.manager_id:
                    mgr_user = db.scalar(select(User).where(User.employee_id == emp.manager_id))
                    if mgr_user:
                        assignee_name = mgr_user.full_name
                        assignee_id = mgr_user.id
            elif tmpl.default_role_code == "HR_EXECUTIVE":
                hr_user = db.scalar(
                    select(User).join(User.role).where(Role.role_code == "HR_EXECUTIVE", User.is_active == True)
                )
                if hr_user:
                    assignee_name = hr_user.full_name
                    assignee_id = hr_user.id
            elif tmpl.default_role_code == "HR_MANAGER":
                hrm_user = db.scalar(
                    select(User).join(User.role).where(Role.role_code == "HR_MANAGER", User.is_active == True)
                )
                if hrm_user:
                    assignee_name = hrm_user.full_name
                    assignee_id = hrm_user.id

            preview_items.append(
                TemplateTaskPreviewItem(
                    template_id=tmpl.id,
                    template_code=tmpl.template_code,
                    title=tmpl.name,
                    category=tmpl.category,
                    priority=tmpl.default_priority,
                    estimated_duration_days=tmpl.estimated_duration_days,
                    calculated_due_date=calc_due,
                    target_role_code=tmpl.default_role_code,
                    target_assignee_name=assignee_name,
                    target_assignee_id=assignee_id,
                    is_duplicate=is_dup,
                    duplicate_task_id=dup_id,
                )
            )

        dept_name = emp.department.name if emp.department else None
        return TemplateExecutionPreview(
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}",
            department_name=dept_name,
            template_tasks=preview_items,
            new_tasks_count=new_count,
            duplicate_tasks_count=dup_count,
        )

    @staticmethod
    def execute_templates(
        db: Session,
        current_user: User,
        data: TemplateExecutionRequest,
    ) -> TemplateExecutionResult:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can execute lifecycle templates.")

        emp = db.scalar(select(Employee).where(Employee.id == data.employee_id))
        if not emp:
            raise ResourceNotFoundException(f"Employee with ID {data.employee_id} not found.")

        base_date = data.start_date or date.today()
        templates = db.scalars(select(TaskTemplate).where(TaskTemplate.id.in_(data.template_ids), TaskTemplate.is_active == True)).all()

        existing_tasks = db.scalars(
            select(Task).where(Task.employee_id == data.employee_id, Task.status != "CANCELLED")
        ).all()
        existing_template_ids = {t.template_id for t in existing_tasks if t.template_id}
        existing_titles = {(t.category, t.title.lower()) for t in existing_tasks}

        created_task_ids = []
        skipped_dup_ids = []

        default_hr_exec = db.scalar(
            select(User).join(User.role).where(Role.role_code == "HR_EXECUTIVE", User.is_active == True)
        )
        default_hr_mgr = db.scalar(
            select(User).join(User.role).where(Role.role_code == "HR_MANAGER", User.is_active == True)
        )

        for tmpl in templates:
            if tmpl.id in existing_template_ids or (tmpl.category, tmpl.name.lower()) in existing_titles:
                skipped_dup_ids.append(tmpl.id)
                continue

            owner_id = current_user.id
            if tmpl.default_role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"] and emp.manager_id:
                mgr_user = db.scalar(select(User).where(User.employee_id == emp.manager_id))
                if mgr_user:
                    owner_id = mgr_user.id
            elif tmpl.default_role_code == "HR_EXECUTIVE" and default_hr_exec:
                owner_id = default_hr_exec.id
            elif tmpl.default_role_code == "HR_MANAGER" and default_hr_mgr:
                owner_id = default_hr_mgr.id

            task_code = f"TSK-LFC-{uuid.uuid4().hex[:8].upper()}"
            due_date = base_date + timedelta(days=tmpl.estimated_duration_days)

            task = Task(
                task_code=task_code,
                template_id=tmpl.id,
                employee_id=emp.id,
                owner_id=owner_id,
                category=tmpl.category,
                title=tmpl.name,
                description=tmpl.description or f"Lifecycle task generated from template {tmpl.template_code}",
                priority=tmpl.default_priority,
                status="PENDING",
                due_date=due_date,
                start_date=base_date,
            )
            db.add(task)
            db.flush()
            created_task_ids.append(task.id)

        db.commit()

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="LIFECYCLE_TEMPLATE",
            entity_id=emp.id,
            action="EXECUTE_TEMPLATES",
            details={
                "employee_id": emp.id,
                "created_count": len(created_task_ids),
                "skipped_count": len(skipped_dup_ids),
            }
        )
        db.add(log)
        db.commit()

        return TemplateExecutionResult(
            employee_id=emp.id,
            created_task_ids=created_task_ids,
            skipped_duplicate_template_ids=skipped_dup_ids,
            total_created=len(created_task_ids),
        )

    # ------------------------------------------------------------------------
    # 8. Lifecycle Calendar
    # ------------------------------------------------------------------------
    @staticmethod
    def get_calendar_events(
        db: Session,
        current_user: User,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        category: Optional[str] = None,
        department_id: Optional[int] = None,
    ) -> List[LifecycleCalendarEvent]:
        role_code = current_user.role.role_code if current_user.role else ""
        rep_ids = None
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)

        events: List[LifecycleCalendarEvent] = []

        def filter_emp(stmt, model):
            if rep_ids is not None:
                stmt = stmt.where(model.employee_id.in_(rep_ids))
            if department_id is not None:
                stmt = stmt.where(Employee.department_id == department_id)
            return stmt

        # 1. Onboarding
        if not category or category.upper() == "ONBOARDING":
            stmt = select(
                OnboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("emp_name"),
                Employee.employee_code,
                Department.name.label("dept_name")
            ).join(Employee, OnboardingRecord.employee_id == Employee.id).outerjoin(Department, Employee.department_id == Department.id)
            stmt = filter_emp(stmt, OnboardingRecord)
            onb_rows = db.execute(stmt).all()
            for rec, emp_name, emp_code, dept_name in onb_rows:
                if rec.start_date and (not start_date or rec.start_date >= start_date) and (not end_date or rec.start_date <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"onb-start-{rec.id}",
                        category="ONBOARDING",
                        event_type="ONBOARDING_START",
                        title=f"Onboarding Start: {emp_name}",
                        date=rec.start_date,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.overall_status,
                        priority="HIGH" if rec.overall_status == "IN_PROGRESS" else "LOW",
                        details_url="/lifecycle/onboarding"
                    ))
                if rec.target_completion_date and (not start_date or rec.target_completion_date >= start_date) and (not end_date or rec.target_completion_date <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"onb-target-{rec.id}",
                        category="ONBOARDING",
                        event_type="ONBOARDING_TARGET",
                        title=f"Onboarding Completion Target: {emp_name}",
                        date=rec.target_completion_date,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.overall_status,
                        priority="HIGH" if rec.target_completion_date < date.today() and rec.overall_status == "IN_PROGRESS" else "MEDIUM",
                        details_url="/lifecycle/onboarding"
                    ))

        # 2. Probation
        if not category or category.upper() == "PROBATION":
            stmt = select(
                ProbationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("emp_name"),
                Employee.employee_code,
                Department.name.label("dept_name")
            ).join(Employee, ProbationRecord.employee_id == Employee.id).outerjoin(Department, Employee.department_id == Department.id)
            stmt = filter_emp(stmt, ProbationRecord)
            prob_rows = db.execute(stmt).all()
            for rec, emp_name, emp_code, dept_name in prob_rows:
                prob_date = rec.extended_end_date or rec.probation_end_date
                if prob_date and (not start_date or prob_date >= start_date) and (not end_date or prob_date <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"prob-end-{rec.id}",
                        category="PROBATION",
                        event_type="PROBATION_DEADLINE",
                        title=f"Probation Review Deadline: {emp_name}",
                        date=prob_date,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.status,
                        priority="URGENT" if rec.status in ["UNDER_REVIEW", "EXTENDED"] and prob_date <= date.today() + timedelta(days=7) else "MEDIUM",
                        details_url="/lifecycle/probation"
                    ))

        # 3. Confirmation
        if not category or category.upper() == "CONFIRMATION":
            stmt = select(
                ConfirmationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("emp_name"),
                Employee.employee_code,
                Department.name.label("dept_name")
            ).join(Employee, ConfirmationRecord.employee_id == Employee.id).outerjoin(Department, Employee.department_id == Department.id)
            stmt = filter_emp(stmt, ConfirmationRecord)
            conf_rows = db.execute(stmt).all()
            for rec, emp_name, emp_code, dept_name in conf_rows:
                if rec.confirmation_due_date and (not start_date or rec.confirmation_due_date >= start_date) and (not end_date or rec.confirmation_due_date <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"conf-due-{rec.id}",
                        category="CONFIRMATION",
                        event_type="CONFIRMATION_DUE",
                        title=f"Confirmation Decision Due: {emp_name}",
                        date=rec.confirmation_due_date,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.status,
                        priority="HIGH" if rec.status == "PENDING_APPROVAL" else "LOW",
                        details_url="/lifecycle/confirmation"
                    ))

        # 4. Performance
        if not category or category.upper() == "PERFORMANCE":
            stmt = select(
                PerformanceReview,
                func.concat(Employee.first_name, " ", Employee.last_name).label("emp_name"),
                Employee.employee_code,
                Department.name.label("dept_name")
            ).join(Employee, PerformanceReview.employee_id == Employee.id).outerjoin(Department, Employee.department_id == Department.id)
            stmt = filter_emp(stmt, PerformanceReview)
            perf_rows = db.execute(stmt).all()
            for rec, emp_name, emp_code, dept_name in perf_rows:
                if rec.review_submission_deadline and (not start_date or rec.review_submission_deadline >= start_date) and (not end_date or rec.review_submission_deadline <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"perf-sub-{rec.id}",
                        category="PERFORMANCE",
                        event_type="PERFORMANCE_DEADLINE",
                        title=f"Appraisal Submission ({rec.review_cycle}): {emp_name}",
                        date=rec.review_submission_deadline,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.status,
                        priority="MEDIUM" if rec.status != "COMPLETED" else "LOW",
                        details_url="/lifecycle/performance-reviews"
                    ))

        # 5. Offboarding
        if not category or category.upper() == "OFFBOARDING":
            stmt = select(
                OffboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("emp_name"),
                Employee.employee_code,
                Department.name.label("dept_name")
            ).join(Employee, OffboardingRecord.employee_id == Employee.id).outerjoin(Department, Employee.department_id == Department.id)
            stmt = filter_emp(stmt, OffboardingRecord)
            off_rows = db.execute(stmt).all()
            for rec, emp_name, emp_code, dept_name in off_rows:
                if rec.last_working_day and (not start_date or rec.last_working_day >= start_date) and (not end_date or rec.last_working_day <= end_date):
                    events.append(LifecycleCalendarEvent(
                        id=f"off-lwd-{rec.id}",
                        category="OFFBOARDING",
                        event_type="LAST_WORKING_DAY",
                        title=f"Last Working Day: {emp_name}",
                        date=rec.last_working_day,
                        employee_id=rec.employee_id,
                        employee_name=emp_name,
                        employee_code=emp_code,
                        department_name=dept_name,
                        status=rec.overall_status,
                        priority="URGENT" if rec.overall_status == "IN_PROGRESS" and rec.last_working_day <= date.today() + timedelta(days=7) else "HIGH",
                        details_url="/lifecycle/offboarding"
                    ))

        events.sort(key=lambda x: x.date)
        return events

    # ------------------------------------------------------------------------
    # 9. Additional Operational Lifecycle Methods
    # ------------------------------------------------------------------------
    @staticmethod
    def initiate_onboarding(
        db: Session,
        current_user: User,
        data: OnboardingInitiateRequest,
    ) -> OnboardingRecordRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can initiate onboarding.")

        emp = db.scalar(select(Employee).where(Employee.id == data.employee_id))
        if not emp:
            raise ResourceNotFoundException(f"Employee with ID {data.employee_id} not found.")

        # Check existing active onboarding
        existing = db.scalar(
            select(OnboardingRecord)
            .where(OnboardingRecord.employee_id == data.employee_id, OnboardingRecord.overall_status == "IN_PROGRESS")
        )
        if existing:
            raise ValidationException(f"Employee {emp.first_name} {emp.last_name} already has an active onboarding record.")

        rec = OnboardingRecord(
            employee_id=data.employee_id,
            start_date=data.start_date,
            target_completion_date=data.target_completion_date,
            buddy_id=data.buddy_id,
            it_asset_status="PENDING",
            bgv_status="PENDING",
            orientation_completed=False,
            overall_status="IN_PROGRESS",
        )
        db.add(rec)
        db.flush()

        # Update or create EmployeeLifecycle
        lifecycle = db.scalar(
            select(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == data.employee_id).order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        if lifecycle:
            lifecycle.current_stage = "ONBOARDING"
            lifecycle.stage_start_date = data.start_date
            lifecycle.stage_target_date = data.target_completion_date
            lifecycle.stage_status = "IN_PROGRESS"
        else:
            new_lfc = EmployeeLifecycle(
                employee_id=data.employee_id,
                current_stage="ONBOARDING",
                stage_start_date=data.start_date,
                stage_target_date=data.target_completion_date,
                stage_status="IN_PROGRESS",
            )
            db.add(new_lfc)

        db.commit()

        # Execute templates if requested
        if data.template_ids:
            LifecycleService.execute_templates(
                db=db,
                current_user=current_user,
                data=TemplateExecutionRequest(employee_id=data.employee_id, template_ids=data.template_ids, start_date=data.start_date)
            )

        db.refresh(rec)
        return OnboardingRecordRead.model_validate(rec)

    @staticmethod
    def get_eligible_employees_for_onboarding(db: Session, current_user: User) -> List[Dict[str, Any]]:
        # Employees with no active onboarding record
        active_onb_emp_ids = select(OnboardingRecord.employee_id).where(OnboardingRecord.overall_status == "IN_PROGRESS")
        stmt = (
            select(Employee.id, Employee.first_name, Employee.last_name, Employee.employee_code, Department.name.label("department_name"))
            .outerjoin(Department, Employee.department_id == Department.id)
            .where(
                Employee.id.not_in(active_onb_emp_ids),
                Employee.employment_status.in_(["PROBATION", "ACTIVE", "FULL_TIME"])
            )
            .order_by(Employee.first_name, Employee.last_name)
            .limit(50)
        )
        rows = db.execute(stmt).all()
        return [
            {
                "id": r.id,
                "name": f"{r.first_name} {r.last_name}",
                "employee_code": r.employee_code,
                "department_name": r.department_name,
            }
            for r in rows
        ]

    @staticmethod
    def submit_confirmation_recommendation(
        db: Session,
        current_user: User,
        record_id: int,
        data: ConfirmationRecommendationRequest,
    ) -> ConfirmationRecordRead:
        rec = db.scalar(select(ConfirmationRecord).where(ConfirmationRecord.id == record_id))
        if not rec:
            raise ResourceNotFoundException(f"Confirmation record with ID {record_id} does not exist.")

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if rec.employee_id not in rep_ids:
                raise PermissionDeniedException("Access denied: You may only submit recommendations for your direct reports.")
        elif role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Access denied: Unauthorized role.")

        rec.approved_by_manager_id = current_user.employee_id or rec.employee_id
        if data.manager_recommendation == "RECOMMENDED":
            rec.status = "APPROVED_BY_MANAGER"
        elif data.manager_recommendation == "EXTEND_PROBATION":
            rec.status = "RECOMMENDED_EXTEND"
        else:
            rec.status = "UNDER_REVIEW"

        # Update manager feedback on linked probation record if available
        if rec.probation_record_id:
            prob = db.scalar(select(ProbationRecord).where(ProbationRecord.id == rec.probation_record_id))
            if prob:
                prob.manager_feedback = data.manager_feedback

        db.commit()
        db.refresh(rec)
        return ConfirmationRecordRead.model_validate(rec)

    @staticmethod
    def finalize_confirmation_decision(
        db: Session,
        current_user: User,
        record_id: int,
        data: ConfirmationDecisionRequest,
    ) -> ConfirmationRecordRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can make formal confirmation decisions.")

        rec = db.scalar(select(ConfirmationRecord).where(ConfirmationRecord.id == record_id))
        if not rec:
            raise ResourceNotFoundException(f"Confirmation record with ID {record_id} does not exist.")

        effective_date = data.effective_confirmation_date or date.today()
        rec.approved_by_hr_id = current_user.id
        rec.confirmation_letter_issued = data.confirmation_letter_issued

        if data.decision.upper() == "CONFIRMED":
            rec.status = "CONFIRMED"
            rec.effective_confirmation_date = effective_date

            emp = db.scalar(select(Employee).where(Employee.id == rec.employee_id))
            if emp:
                emp.employment_status = "CONFIRMED"

            lifecycle = db.scalar(
                select(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == rec.employee_id).order_by(desc(EmployeeLifecycle.stage_start_date))
            )
            if lifecycle and lifecycle.current_stage != "CONFIRMED":
                lifecycle.stage_status = "COMPLETED"
                lifecycle.completed_at = datetime.now()

                new_lifecycle = EmployeeLifecycle(
                    employee_id=rec.employee_id,
                    current_stage="CONFIRMED",
                    stage_start_date=effective_date,
                    stage_target_date=effective_date + timedelta(days=365),
                    stage_status="IN_PROGRESS",
                    notes="Employee formally confirmed."
                )
                db.add(new_lifecycle)
        elif data.decision.upper() == "EXTENDED":
            rec.status = "EXTENDED"
            ext_months = data.extension_months or 3
            if rec.probation_record_id:
                prob = db.scalar(select(ProbationRecord).where(ProbationRecord.id == rec.probation_record_id))
                if prob:
                    prob.status = "EXTENDED"
                    prob.extended_end_date = (prob.probation_end_date or date.today()) + timedelta(days=ext_months * 30)
                    prob.extension_reason = data.notes or f"Probation extended by {ext_months} months."
        else:
            rec.status = "REJECTED"

        db.commit()
        db.refresh(rec)
        return ConfirmationRecordRead.model_validate(rec)

    @staticmethod
    def create_performance_cycle(
        db: Session,
        current_user: User,
        data: PerformanceCycleCreate,
    ) -> Dict[str, Any]:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can create performance review cycles.")

        # Find eligible employees
        stmt = select(Employee).where(Employee.employment_status.in_(["CONFIRMED", "ACTIVE", "PROBATION"]))
        if data.department_id is not None:
            stmt = stmt.where(Employee.department_id == data.department_id)
        employees = db.scalars(stmt).all()

        created_count = 0
        for emp in employees:
            existing = db.scalar(
                select(PerformanceReview).where(
                    PerformanceReview.employee_id == emp.id,
                    PerformanceReview.review_cycle == data.cycle_name.strip()
                )
            )
            if existing:
                continue

            reviewer_id = emp.manager_id or emp.id
            rev = PerformanceReview(
                employee_id=emp.id,
                review_cycle=data.cycle_name.strip(),
                reviewer_id=reviewer_id,
                self_review_status="PENDING",
                manager_review_status="PENDING",
                review_submission_deadline=data.submission_deadline,
                status="DRAFT",
            )
            db.add(rev)
            created_count += 1

        db.commit()
        return {
            "cycle_name": data.cycle_name.strip(),
            "submission_deadline": str(data.submission_deadline),
            "reviews_created": created_count,
        }

    @staticmethod
    def list_performance_cycles(db: Session) -> List[str]:
        stmt = select(PerformanceReview.review_cycle).distinct().order_by(desc(PerformanceReview.review_cycle))
        return list(db.scalars(stmt).all())

    @staticmethod
    def initiate_offboarding(
        db: Session,
        current_user: User,
        data: OffboardingInitiateRequest,
    ) -> OffboardingRecordRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can initiate offboarding.")

        emp = db.scalar(select(Employee).where(Employee.id == data.employee_id))
        if not emp:
            raise ResourceNotFoundException(f"Employee with ID {data.employee_id} not found.")

        existing = db.scalar(
            select(OffboardingRecord).where(
                OffboardingRecord.employee_id == data.employee_id,
                OffboardingRecord.overall_status == "IN_PROGRESS"
            )
        )
        if existing:
            raise ValidationException(f"Employee {emp.first_name} {emp.last_name} already has an active offboarding record.")

        off = OffboardingRecord(
            employee_id=data.employee_id,
            resignation_date=data.resignation_date,
            last_working_day=data.last_working_day,
            exit_interview_completed=False,
            asset_recovery_status="PENDING",
            kt_status="IN_PROGRESS",
            clearance_status="PENDING",
            overall_status="IN_PROGRESS",
        )
        db.add(off)
        db.flush()

        emp.employment_status = "NOTICE_PERIOD"

        lifecycle = db.scalar(
            select(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == data.employee_id).order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        if lifecycle:
            lifecycle.current_stage = "OFFBOARDING"
            lifecycle.stage_start_date = data.resignation_date
            lifecycle.stage_target_date = data.last_working_day
            lifecycle.stage_status = "IN_PROGRESS"
        else:
            new_lfc = EmployeeLifecycle(
                employee_id=data.employee_id,
                current_stage="OFFBOARDING",
                stage_start_date=data.resignation_date,
                stage_target_date=data.last_working_day,
                stage_status="IN_PROGRESS",
            )
            db.add(new_lfc)

        db.commit()

        if data.template_ids:
            LifecycleService.execute_templates(
                db=db,
                current_user=current_user,
                data=TemplateExecutionRequest(employee_id=data.employee_id, template_ids=data.template_ids, start_date=data.resignation_date)
            )

        db.refresh(off)
        return OffboardingRecordRead.model_validate(off)

    @staticmethod
    def complete_offboarding(
        db: Session,
        current_user: User,
        record_id: int,
        data: OffboardingCompleteRequest,
    ) -> OffboardingRecordRead:
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only Administrators and HR Managers can finalize offboarding.")

        off = db.scalar(select(OffboardingRecord).where(OffboardingRecord.id == record_id))
        if not off:
            raise ResourceNotFoundException(f"Offboarding record with ID {record_id} does not exist.")

        off.overall_status = "COMPLETED"
        off.clearance_status = "CLEARED"
        off.asset_recovery_status = "RETURNED"

        emp = db.scalar(select(Employee).where(Employee.id == off.employee_id))
        if emp:
            emp.employment_status = "RESIGNED"

        lifecycle = db.scalar(
            select(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == off.employee_id).order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        if lifecycle:
            lifecycle.stage_status = "COMPLETED"
            lifecycle.completed_at = datetime.now()

        db.commit()
        db.refresh(off)
        return OffboardingRecordRead.model_validate(off)

    @staticmethod
    def get_eligible_employees_for_offboarding(db: Session, current_user: User) -> List[Dict[str, Any]]:
        active_off_emp_ids = select(OffboardingRecord.employee_id).where(OffboardingRecord.overall_status == "IN_PROGRESS")
        stmt = (
            select(Employee.id, Employee.first_name, Employee.last_name, Employee.employee_code, Department.name.label("department_name"))
            .outerjoin(Department, Employee.department_id == Department.id)
            .where(
                Employee.id.not_in(active_off_emp_ids),
                Employee.employment_status.in_(["CONFIRMED", "ACTIVE", "PROBATION"])
            )
            .order_by(Employee.first_name, Employee.last_name)
            .limit(50)
        )
        rows = db.execute(stmt).all()
        return [
            {
                "id": r.id,
                "name": f"{r.first_name} {r.last_name}",
                "employee_code": r.employee_code,
                "department_name": r.department_name,
            }
            for r in rows
        ]

