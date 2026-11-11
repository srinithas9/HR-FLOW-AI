from typing import Optional, List, Dict, Any, Set
from datetime import date, datetime, timedelta
import zoneinfo
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, and_, or_, func, text, desc, true, false, union

from app.models.organization import User, Employee, Department
from app.models.workflow import Task, FollowUp, Escalation
from app.models.lifecycle import (
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    OffboardingRecord,
    PerformanceReview,
)
from app.models.compliance import EmployeeDocument
from app.models.intelligence import ActivityLog
from app.schemas.dashboard import (
    DashboardOverviewResponse,
    DashboardKPIs,
    DashboardLifecycleStages,
    AttentionItem,
    MilestoneItem,
    ActivityItem,
    BriefingItem,
)
from app.core.permissions import get_reporting_employee_ids

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")


class DashboardService:
    @staticmethod
    def _get_current_date() -> date:
        """Get current date in Asia/Kolkata timezone."""
        return datetime.now(KOLKATA_TZ).date()

    @classmethod
    def _build_scope_filters(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Build query-level filter expressions enforcing strict enterprise RBAC across roles.
        """
        role_code = current_user.role.role_code if current_user.role else ""
        user_id = current_user.id
        employee_id = current_user.employee_id

        # 1. ADMIN & HR_MANAGER: Full organization-wide access
        if role_code in ["ADMIN", "HR_MANAGER"]:
            dept_filter = Department.id == department_id if department_id else true()
            emp_dept_filter = Employee.department_id == department_id if department_id else true()
            return {
                "role_code": role_code,
                "is_global": True,
                "task_filter": emp_dept_filter,
                "emp_filter": emp_dept_filter,
                "subordinate_ids": None,
                "assigned_emp_ids": None,
            }

        # 2. HR_EXECUTIVE: Strictly assigned responsibilities and authorized records
        elif role_code == "HR_EXECUTIVE":
            # Active task condition: tasks owned OR where executive is an active party in pending follow-up / open escalation
            active_fu_task_ids = (
                select(FollowUp.task_id)
                .where(
                    or_(FollowUp.initiator_user_id == user_id, FollowUp.target_user_id == user_id),
                    FollowUp.response_received == False,
                )
            )
            active_esc_task_ids = (
                select(Escalation.task_id)
                .where(
                    or_(Escalation.escalated_by_user_id == user_id, Escalation.escalated_to_user_id == user_id),
                    Escalation.status.in_(["OPEN", "PENDING", "IN_PROGRESS"]),
                )
            )

            task_scope_condition = or_(
                Task.owner_id == user_id,
                Task.id.in_(active_fu_task_ids),
                Task.id.in_(active_esc_task_ids),
            )

            # Accessible employees: strictly those with pending/active assigned responsibilities
            # (active tasks, pending confirmations, or pending document verifications)
            # Never grant access based on completed historical actions or unrelated records.
            q1 = (
                select(Task.employee_id)
                .where(
                    task_scope_condition,
                    Task.status.in_(["PENDING", "IN_PROGRESS", "BLOCKED", "DELAYED"]),
                )
            )
            q2 = (
                select(ConfirmationRecord.employee_id)
                .where(
                    ConfirmationRecord.approved_by_hr_id == user_id,
                    ConfirmationRecord.status == "PENDING_APPROVAL",
                )
            )
            q3 = (
                select(EmployeeDocument.employee_id)
                .where(
                    EmployeeDocument.verified_by_id == user_id,
                    EmployeeDocument.status.in_(["PENDING_SUBMISSION", "SUBMITTED", "PENDING_VERIFICATION"]),
                )
            )

            assigned_emp_ids_stmt = union(q1, q2, q3)
            assigned_emp_ids = set(db.scalars(assigned_emp_ids_stmt).all())

            emp_filter = and_(
                Employee.id.in_(assigned_emp_ids) if assigned_emp_ids else false(),
                Employee.department_id == department_id if department_id else true(),
            )
            task_filter = and_(
                task_scope_condition,
                Employee.department_id == department_id if department_id else true(),
            )
            return {
                "role_code": role_code,
                "is_global": False,
                "task_filter": task_filter,
                "emp_filter": emp_filter,
                "subordinate_ids": None,
                "assigned_emp_ids": assigned_emp_ids,
            }

        # 3. REPORTING_MANAGER: Strictly authorized direct and indirect reports
        elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            subordinate_ids = get_reporting_employee_ids(db, employee_id)

            emp_filter = and_(
                Employee.id.in_(subordinate_ids) if subordinate_ids else false(),
                Employee.department_id == department_id if department_id else true(),
            )
            task_filter = and_(
                Task.employee_id.in_(subordinate_ids) if subordinate_ids else false(),
                Employee.department_id == department_id if department_id else true(),
            )
            return {
                "role_code": role_code,
                "is_global": False,
                "task_filter": task_filter,
                "emp_filter": emp_filter,
                "subordinate_ids": subordinate_ids,
                "assigned_emp_ids": None,
            }

        # Fallback denial
        else:
            return {
                "role_code": role_code,
                "is_global": False,
                "task_filter": false(),
                "emp_filter": false(),
                "subordinate_ids": set(),
                "assigned_emp_ids": set(),
            }

    @classmethod
    def get_dashboard_overview(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None
    ) -> DashboardOverviewResponse:
        """
        Consolidated endpoint calculating KPIs, Lifecycle Stages, and Attention Required.
        """
        today = cls._get_current_date()
        scope = cls._build_scope_filters(db, current_user, department_id)
        role_code = scope["role_code"]

        # ---------------------------------------------------------------------
        # 1. Four Approved KPIs
        # ---------------------------------------------------------------------
        # Total Employees: employment_status IN ('ACTIVE', 'CONFIRMED')
        active_emp_stmt = (
            select(func.count(Employee.id))
            .where(
                and_(
                    Employee.employment_status.in_(["ACTIVE", "CONFIRMED"]),
                    scope["emp_filter"],
                )
            )
        )
        active_employees_count = db.scalar(active_emp_stmt) or 0

        # New Joiners This Month: date_of_joining in current calendar month
        new_joiners_stmt = (
            select(func.count(Employee.id))
            .where(
                and_(
                    func.extract("year", Employee.date_of_joining) == today.year,
                    func.extract("month", Employee.date_of_joining) == today.month,
                    scope["emp_filter"],
                )
            )
        )
        new_joiners_this_month_count = db.scalar(new_joiners_stmt) or 0

        # Exits This Month: completed exits with last_working_day in current calendar month
        exits_stmt = (
            select(func.count(OffboardingRecord.id))
            .join(Employee, OffboardingRecord.employee_id == Employee.id)
            .where(
                and_(
                    OffboardingRecord.overall_status == "COMPLETED",
                    func.extract("year", OffboardingRecord.last_working_day) == today.year,
                    func.extract("month", OffboardingRecord.last_working_day) == today.month,
                    scope["emp_filter"],
                )
            )
        )
        exits_this_month_count = db.scalar(exits_stmt) or 0

        # Pending HR Actions / Open Tasks: non-terminal tasks (excluding COMPLETED and CANCELLED)
        pending_hr_actions_stmt = (
            select(func.count(Task.id))
            .join(Employee, Task.employee_id == Employee.id)
            .where(
                and_(
                    Task.status.notin_(["COMPLETED", "CANCELLED"]),
                    scope["task_filter"],
                )
            )
        )
        pending_hr_actions_count = db.scalar(pending_hr_actions_stmt) or 0
        open_tasks_count = pending_hr_actions_count

        # Overdue Tasks: due_date < today AND status NOT IN ('COMPLETED', 'CANCELLED')
        overdue_tasks_stmt = (
            select(func.count(Task.id))
            .join(Employee, Task.employee_id == Employee.id)
            .where(
                and_(
                    Task.due_date < today,
                    Task.status.notin_(["COMPLETED", "CANCELLED"]),
                    scope["task_filter"],
                )
            )
        )
        overdue_tasks_count = db.scalar(overdue_tasks_stmt) or 0

        # Tasks Due in Next 7 Days: due_date between today and today + 7d (strictly excluding overdue)
        next_7_days = today + timedelta(days=7)
        due_next_7_stmt = (
            select(func.count(Task.id))
            .join(Employee, Task.employee_id == Employee.id)
            .where(
                and_(
                    Task.due_date >= today,
                    Task.due_date <= next_7_days,
                    Task.status.notin_(["COMPLETED", "CANCELLED"]),
                    scope["task_filter"],
                )
            )
        )
        tasks_due_next_7_count = db.scalar(due_next_7_stmt) or 0

        kpis = DashboardKPIs(
            total_employees=active_employees_count,
            new_joiners_this_month=new_joiners_this_month_count,
            exits_this_month=exits_this_month_count,
            pending_hr_actions=pending_hr_actions_count,
            active_employees=active_employees_count,
            open_tasks=open_tasks_count,
            overdue_tasks=overdue_tasks_count,
            tasks_due_next_7_days=tasks_due_next_7_count,
        )

        # ---------------------------------------------------------------------
        # 2. Six-Stage Employee Lifecycle Overview
        # ---------------------------------------------------------------------
        def apply_emp_scope(stmt, model):
            if scope["subordinate_ids"] is not None:
                stmt = stmt.where(model.employee_id.in_(scope["subordinate_ids"]))
            elif scope["assigned_emp_ids"] is not None:
                stmt = stmt.where(model.employee_id.in_(scope["assigned_emp_ids"]))
            if department_id:
                stmt = stmt.join(Employee, model.employee_id == Employee.id).where(Employee.department_id == department_id)
            return stmt

        # Onboarding
        onb_stmt = apply_emp_scope(
            select(func.count(OnboardingRecord.id)).where(OnboardingRecord.overall_status == "IN_PROGRESS"),
            OnboardingRecord
        )
        onb_count = db.scalar(onb_stmt) or 0

        # Probation
        prob_stmt = apply_emp_scope(
            select(func.count(ProbationRecord.id)).where(ProbationRecord.status.in_(["UNDER_REVIEW", "EXTENDED"])),
            ProbationRecord
        )
        prob_count = db.scalar(prob_stmt) or 0

        # Confirmation
        conf_stmt = apply_emp_scope(
            select(func.count(ConfirmationRecord.id)).where(ConfirmationRecord.status == "PENDING_APPROVAL"),
            ConfirmationRecord
        )
        conf_count = db.scalar(conf_stmt) or 0

        # Documentation (Honest 0 count; all 1,200 verified)
        doc_stmt = apply_emp_scope(
            select(func.count(EmployeeDocument.id)).where(EmployeeDocument.status.in_(["PENDING_SUBMISSION", "SUBMITTED"])),
            EmployeeDocument
        )
        doc_count = db.scalar(doc_stmt) or 0

        # Performance Reviews (Honest 0 count; cycle completed)
        perf_stmt = apply_emp_scope(
            select(func.count(PerformanceReview.id)).where(PerformanceReview.status.in_(["DRAFT", "IN_PROGRESS", "SUBMITTED"])),
            PerformanceReview
        )
        perf_count = db.scalar(perf_stmt) or 0

        # Offboarding
        off_stmt = apply_emp_scope(
            select(func.count(OffboardingRecord.id)).where(OffboardingRecord.overall_status == "IN_PROGRESS"),
            OffboardingRecord
        )
        off_count = db.scalar(off_stmt) or 0

        lifecycle = DashboardLifecycleStages(
            onboarding_active=onb_count,
            probation_active=prob_count,
            confirmation_pending=conf_count,
            documentation_pending=doc_count,
            performance_reviews_in_progress=perf_count,
            offboarding_in_progress=off_count,
        )

        # ---------------------------------------------------------------------
        # 3. Attention Required (Multi-Category Operational Triage)
        # ---------------------------------------------------------------------
        attention_items: List[AttentionItem] = []
        OwnerUser = aliased(User)
        Dept = aliased(Department)

        # A. Overdue Tasks (All overdue tasks in scope, ordered by due_date ascending)
        overdue_task_query = (
            select(
                Task,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
                OwnerUser.full_name.label("owner_name"),
            )
            .join(Employee, Task.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .outerjoin(OwnerUser, Task.owner_id == OwnerUser.id)
            .where(
                and_(
                    Task.due_date < today,
                    Task.status.notin_(["COMPLETED", "CANCELLED"]),
                    scope["task_filter"],
                )
            )
            .order_by(Task.due_date.asc())
        )
        for row in db.execute(overdue_task_query).all():
            t = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            owner_name = row[4]

            days_overdue = (today - t.due_date).days if t.due_date else 0
            severity = "CRITICAL" if t.priority == "CRITICAL" or days_overdue > 7 else "HIGH"

            attention_items.append(
                AttentionItem(
                    id=f"task-{t.id}",
                    entity_id=t.id,
                    category="OVERDUE_TASK",
                    severity=severity,
                    title=f"Task Overdue: {t.title}",
                    employee_id=t.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    owner_id=t.owner_id,
                    owner_name=owner_name,
                    workflow_status=t.status,
                    due_date=t.due_date,
                    days_overdue=days_overdue,
                    action_required=f"Resolve {t.category.lower()} task or extend deadline with justification",
                    link_path=f"/tasks?task_id={t.id}",
                )
            )

        # B. Overdue Probation Reviews (status='UNDER_REVIEW' and date < today)
        Mgr = aliased(Employee)
        prob_overdue_stmt = (
            select(
                ProbationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
                func.concat(Mgr.first_name, " ", Mgr.last_name).label("manager_name"),
            )
            .join(Employee, ProbationRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .outerjoin(Mgr, Employee.manager_id == Mgr.id)
            .where(
                and_(
                    ProbationRecord.status == "UNDER_REVIEW",
                    or_(
                        and_(ProbationRecord.extended_end_date.isnot(None), ProbationRecord.extended_end_date < today),
                        and_(ProbationRecord.extended_end_date.is_(None), ProbationRecord.probation_end_date < today),
                    )
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            prob_overdue_stmt = prob_overdue_stmt.where(ProbationRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            prob_overdue_stmt = prob_overdue_stmt.where(ProbationRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            prob_overdue_stmt = prob_overdue_stmt.where(Employee.department_id == department_id)

        for row in db.execute(prob_overdue_stmt.order_by(ProbationRecord.probation_end_date.asc()).limit(10)).all():
            p = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            mgr_name = row[4]

            target_end = p.extended_end_date or p.probation_end_date
            days_overdue = (today - target_end).days if target_end else 0

            attention_items.append(
                AttentionItem(
                    id=f"probation-{p.id}",
                    entity_id=p.id,
                    category="OVERDUE_REVIEW",
                    severity="HIGH",
                    title="Probation Review Overdue",
                    employee_id=p.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    owner_id=None,
                    owner_name=mgr_name,
                    workflow_status=p.status,
                    due_date=target_end,
                    days_overdue=days_overdue,
                    action_required="Submit manager feedback and HR evaluation for confirmation decision",
                    link_path=f"/lifecycle/probation?employee_id={p.employee_id}",
                )
            )

        # C. Overdue Confirmation Decisions (status='PENDING_APPROVAL' and confirmation_due_date < today)
        conf_overdue_stmt = (
            select(
                ConfirmationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, ConfirmationRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    ConfirmationRecord.status == "PENDING_APPROVAL",
                    ConfirmationRecord.confirmation_due_date < today,
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            conf_overdue_stmt = conf_overdue_stmt.where(ConfirmationRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            conf_overdue_stmt = conf_overdue_stmt.where(ConfirmationRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            conf_overdue_stmt = conf_overdue_stmt.where(Employee.department_id == department_id)

        for row in db.execute(conf_overdue_stmt.order_by(ConfirmationRecord.confirmation_due_date.asc()).limit(10)).all():
            c = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"

            days_overdue = (today - c.confirmation_due_date).days if c.confirmation_due_date else 0

            attention_items.append(
                AttentionItem(
                    id=f"confirmation-{c.id}",
                    entity_id=c.id,
                    category="OVERDUE_DECISION",
                    severity="HIGH",
                    title="Confirmation Sign-off Overdue",
                    employee_id=c.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    owner_id=c.approved_by_hr_id,
                    owner_name=None,
                    workflow_status=c.status,
                    due_date=c.confirmation_due_date,
                    days_overdue=days_overdue,
                    action_required="Approve or extend confirmation status and issue confirmation letter",
                    link_path=f"/lifecycle/confirmation?employee_id={c.employee_id}",
                )
            )

        # D. Pending Offboarding Clearances (asset recovery or clearance holds)
        off_hold_stmt = (
            select(
                OffboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, OffboardingRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    OffboardingRecord.overall_status == "IN_PROGRESS",
                    or_(
                        OffboardingRecord.asset_recovery_status != "COMPLETED",
                        OffboardingRecord.clearance_status != "COMPLETED",
                        OffboardingRecord.kt_status != "COMPLETED",
                    )
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            off_hold_stmt = off_hold_stmt.where(OffboardingRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            off_hold_stmt = off_hold_stmt.where(OffboardingRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            off_hold_stmt = off_hold_stmt.where(Employee.department_id == department_id)

        for row in db.execute(off_hold_stmt.order_by(OffboardingRecord.last_working_day.asc()).limit(10)).all():
            o = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"

            attention_items.append(
                AttentionItem(
                    id=f"offboarding-{o.id}",
                    entity_id=o.id,
                    category="PENDING_CLEARANCE",
                    severity="MEDIUM",
                    title="Pending Separation Clearance Hold",
                    employee_id=o.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    owner_id=None,
                    owner_name=None,
                    workflow_status=o.overall_status,
                    due_date=o.last_working_day,
                    days_overdue=0,
                    action_required="Complete IT asset recovery and departmental no-dues clearance",
                    link_path=f"/lifecycle/offboarding?employee_id={o.employee_id}",
                )
            )

        # Sort Attention Items by Urgency (Critical -> High -> Medium, then days_overdue DESC)
        severity_rank = {"CRITICAL": 3, "HIGH": 2, "MEDIUM": 1, "LOW": 0}
        attention_items.sort(key=lambda x: (severity_rank.get(x.severity, 0), x.days_overdue), reverse=True)

        # ---------------------------------------------------------------------
        # 4. Grounded HR Daily Briefing (Deterministic, Real Operational Facts)
        # ---------------------------------------------------------------------
        daily_briefing = []

        if overdue_tasks_count > 0:
            daily_briefing.append(
                BriefingItem(
                    id="briefing-overdue-tasks",
                    headline=f"{overdue_tasks_count} HR operational tasks are currently overdue.",
                    description="These tasks have passed their scheduled completion date and require immediate resolution or deadline extension.",
                    process="Task Management",
                    action_label="View Overdue Tasks",
                    link_path="/tasks?overdue=true",
                    severity="HIGH",
                )
            )

        if prob_count > 0:
            daily_briefing.append(
                BriefingItem(
                    id="briefing-probation",
                    headline=f"{prob_count} employee probation reviews are currently active.",
                    description="Assessments and manager feedback are required to determine confirmation decisions.",
                    process="Probation",
                    action_label="View Probation",
                    link_path="/lifecycle/probation",
                    severity="MEDIUM",
                )
            )

        if conf_count > 0:
            daily_briefing.append(
                BriefingItem(
                    id="briefing-confirmation",
                    headline=f"{conf_count} employee confirmations are awaiting formal approval.",
                    description="Decisions have been submitted and are waiting for HR sign-off and issuance of confirmation letters.",
                    process="Confirmation",
                    action_label="View Confirmation",
                    link_path="/lifecycle/confirmation",
                    severity="HIGH",
                )
            )

        if onb_count > 0:
            daily_briefing.append(
                BriefingItem(
                    id="briefing-onboarding",
                    headline=f"{onb_count} new hire onboarding journeys are actively underway.",
                    description="Initial setup, orientation steps, and documentation are tracking toward target completion.",
                    process="Onboarding",
                    action_label="View Onboarding",
                    link_path="/lifecycle/onboarding",
                    severity="INFO",
                )
            )

        if off_count > 0:
            daily_briefing.append(
                BriefingItem(
                    id="briefing-offboarding",
                    headline=f"{off_count} employee exit clearances are currently in progress.",
                    description="Departmental no-dues sign-offs and IT asset recoveries are pending before the last working day.",
                    process="Offboarding",
                    action_label="View Offboarding",
                    link_path="/lifecycle/offboarding",
                    severity="MEDIUM",
                )
            )

        return DashboardOverviewResponse(
            operational_date=today,
            user_role=role_code,
            department_id=department_id,
            kpis=kpis,
            lifecycle=lifecycle,
            attention_required=attention_items,
            total_attention_count=len(attention_items),
            daily_briefing=daily_briefing,
        )

    @classmethod
    def get_upcoming_milestones(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None,
        days_ahead: int = 30,
    ) -> List[MilestoneItem]:
        """
        Chronological timeline of upcoming employee milestones in next 30 days.
        Strictly excludes past overdue items (target_date >= today).
        Document expiry is excluded due to verified database schema limitation.
        """
        today = cls._get_current_date()
        target_limit = today + timedelta(days=days_ahead)
        scope = cls._build_scope_filters(db, current_user, department_id)
        milestones: List[MilestoneItem] = []
        Dept = aliased(Department)

        # 0. Upcoming Employee Joining Dates
        joiner_stmt = (
            select(
                Employee,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    Employee.date_of_joining >= today,
                    Employee.date_of_joining <= target_limit,
                    scope["emp_filter"],
                )
            )
        )
        for row in db.execute(joiner_stmt).all():
            emp = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            days_rem = (emp.date_of_joining - today).days

            milestones.append(
                MilestoneItem(
                    id=f"ms-join-{emp.id}",
                    milestone_type="NEW_JOINER",
                    title="New Employee Joining",
                    employee_id=emp.id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=emp.date_of_joining,
                    days_remaining=days_rem,
                    status=emp.employment_status,
                    owner_name=None,
                    link_path=f"/lifecycle/onboarding?employee_id={emp.id}",
                )
            )

        # 1. Onboarding Completion Deadlines
        onb_stmt = (
            select(
                OnboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, OnboardingRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    OnboardingRecord.overall_status == "IN_PROGRESS",
                    OnboardingRecord.target_completion_date >= today,
                    OnboardingRecord.target_completion_date <= target_limit,
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            onb_stmt = onb_stmt.where(OnboardingRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            onb_stmt = onb_stmt.where(OnboardingRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            onb_stmt = onb_stmt.where(Employee.department_id == department_id)

        for row in db.execute(onb_stmt).all():
            onb = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            days_rem = (onb.target_completion_date - today).days

            milestones.append(
                MilestoneItem(
                    id=f"ms-onb-{onb.id}",
                    milestone_type="ONBOARDING_COMPLETION",
                    title="Onboarding Target Completion",
                    employee_id=onb.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=onb.target_completion_date,
                    days_remaining=days_rem,
                    status=onb.overall_status,
                    owner_name=None,
                    link_path=f"/lifecycle/onboarding?employee_id={onb.employee_id}",
                )
            )

        # 2. Probation Review Deadlines (target_date >= today)
        prob_stmt = (
            select(
                ProbationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, ProbationRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    ProbationRecord.status.in_(["UNDER_REVIEW", "EXTENDED"]),
                    or_(
                        and_(
                            ProbationRecord.extended_end_date.isnot(None),
                            ProbationRecord.extended_end_date >= today,
                            ProbationRecord.extended_end_date <= target_limit,
                        ),
                        and_(
                            ProbationRecord.extended_end_date.is_(None),
                            ProbationRecord.probation_end_date >= today,
                            ProbationRecord.probation_end_date <= target_limit,
                        ),
                    ),
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            prob_stmt = prob_stmt.where(ProbationRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            prob_stmt = prob_stmt.where(ProbationRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            prob_stmt = prob_stmt.where(Employee.department_id == department_id)

        for row in db.execute(prob_stmt).all():
            prob = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            target_dt = prob.extended_end_date or prob.probation_end_date
            days_rem = (target_dt - today).days
            m_title = "Extended Probation Review Ending" if prob.extended_end_date else "Probation Evaluation Due"

            milestones.append(
                MilestoneItem(
                    id=f"ms-prob-{prob.id}",
                    milestone_type="PROBATION_END",
                    title=m_title,
                    employee_id=prob.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=target_dt,
                    days_remaining=days_rem,
                    status=prob.status,
                    owner_name=None,
                    link_path=f"/lifecycle/probation?employee_id={prob.employee_id}",
                )
            )

        # 3. Confirmation Decisions Due (target_date >= today)
        conf_stmt = (
            select(
                ConfirmationRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, ConfirmationRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    ConfirmationRecord.status.in_(["PENDING_APPROVAL", "UNDER_REVIEW"]),
                    ConfirmationRecord.confirmation_due_date >= today,
                    ConfirmationRecord.confirmation_due_date <= target_limit,
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            conf_stmt = conf_stmt.where(ConfirmationRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            conf_stmt = conf_stmt.where(ConfirmationRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            conf_stmt = conf_stmt.where(Employee.department_id == department_id)

        for row in db.execute(conf_stmt).all():
            conf = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            days_rem = (conf.confirmation_due_date - today).days

            milestones.append(
                MilestoneItem(
                    id=f"ms-conf-{conf.id}",
                    milestone_type="CONFIRMATION_DUE",
                    title="Confirmation Approval Due",
                    employee_id=conf.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=conf.confirmation_due_date,
                    days_remaining=days_rem,
                    status=conf.status,
                    owner_name=None,
                    link_path=f"/lifecycle/confirmation?employee_id={conf.employee_id}",
                )
            )

        # 4. Offboarding Last Working Days (target_date >= today)
        off_stmt = (
            select(
                OffboardingRecord,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, OffboardingRecord.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    OffboardingRecord.overall_status == "IN_PROGRESS",
                    OffboardingRecord.last_working_day >= today,
                    OffboardingRecord.last_working_day <= target_limit,
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            off_stmt = off_stmt.where(OffboardingRecord.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            off_stmt = off_stmt.where(OffboardingRecord.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            off_stmt = off_stmt.where(Employee.department_id == department_id)

        for row in db.execute(off_stmt).all():
            off = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            days_rem = (off.last_working_day - today).days

            milestones.append(
                MilestoneItem(
                    id=f"ms-off-{off.id}",
                    milestone_type="OFFBOARDING_EXIT",
                    title="Planned Employee Last Working Day",
                    employee_id=off.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=off.last_working_day,
                    days_remaining=days_rem,
                    status=off.overall_status,
                    owner_name=None,
                    link_path=f"/lifecycle/offboarding?employee_id={off.employee_id}",
                )
            )

        # 5. Performance Review Deadlines (if any active cycle scheduled in next 30 days)
        perf_stmt = (
            select(
                PerformanceReview,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
            )
            .join(Employee, PerformanceReview.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .where(
                and_(
                    PerformanceReview.status.in_(["DRAFT", "IN_PROGRESS", "PENDING_REVIEW"]),
                    PerformanceReview.review_submission_deadline >= today,
                    PerformanceReview.review_submission_deadline <= target_limit,
                )
            )
        )
        if scope["subordinate_ids"] is not None:
            perf_stmt = perf_stmt.where(PerformanceReview.employee_id.in_(scope["subordinate_ids"]))
        elif scope["assigned_emp_ids"] is not None:
            perf_stmt = perf_stmt.where(PerformanceReview.employee_id.in_(scope["assigned_emp_ids"]))
        if department_id:
            perf_stmt = perf_stmt.where(Employee.department_id == department_id)

        for row in db.execute(perf_stmt).all():
            perf = row[0]
            emp_name = row[1] or "Unknown"
            emp_code = row[2] or ""
            dept_name = row[3] or "Unassigned"
            days_rem = (perf.review_submission_deadline - today).days

            milestones.append(
                MilestoneItem(
                    id=f"ms-perf-{perf.id}",
                    milestone_type="PERFORMANCE_DEADLINE",
                    title=f"Performance Submission Due: {perf.review_cycle}",
                    employee_id=perf.employee_id,
                    employee_name=emp_name,
                    employee_code=emp_code,
                    department_name=dept_name,
                    target_date=perf.review_submission_deadline,
                    days_remaining=days_rem,
                    status=perf.status,
                    owner_name=None,
                    link_path=f"/lifecycle/performance?employee_id={perf.employee_id}",
                )
            )

        # Sort strictly ascending by target_date
        milestones.sort(key=lambda m: m.target_date)
        return milestones[:15]

    @classmethod
    def get_recent_activities(
        cls,
        db: Session,
        current_user: User,
        limit: int = 10,
        department_id: Optional[int] = None,
    ) -> List[ActivityItem]:
        """
        Retrieve recent operational activities from verified live activity_logs table.
        Strictly role-scoped. Supports optional department filter. Zero fabricated events.
        """
        scope = cls._build_scope_filters(db, current_user, department_id)
        role_code = scope["role_code"]

        stmt = select(ActivityLog).order_by(desc(ActivityLog.created_at))

        # Role scoping
        if role_code in ["ADMIN", "HR_MANAGER"]:
            # Global view
            if department_id:
                dept_emp_stmt = select(Employee.id).where(Employee.department_id == department_id)
                dept_task_stmt = select(Task.id).join(Employee, Task.employee_id == Employee.id).where(Employee.department_id == department_id)
                stmt = stmt.where(
                    or_(
                        and_(ActivityLog.entity_type == "EMPLOYEE", ActivityLog.entity_id.in_(dept_emp_stmt)),
                        and_(ActivityLog.entity_type == "TASK", ActivityLog.entity_id.in_(dept_task_stmt)),
                    )
                )
        elif role_code == "HR_EXECUTIVE":
            # Executive's own actions or events for assigned portfolio
            assigned_ids = scope["assigned_emp_ids"] or set()
            if department_id:
                dept_emp_stmt = select(Employee.id).where(and_(Employee.department_id == department_id, Employee.id.in_(assigned_ids)))
                dept_task_stmt = select(Task.id).join(Employee, Task.employee_id == Employee.id).where(scope["task_filter"])
                stmt = stmt.where(
                    or_(
                        and_(ActivityLog.entity_type == "EMPLOYEE", ActivityLog.entity_id.in_(dept_emp_stmt)),
                        and_(ActivityLog.entity_type == "TASK", ActivityLog.entity_id.in_(dept_task_stmt)),
                    )
                )
            else:
                stmt = stmt.where(
                    or_(
                        ActivityLog.user_id == current_user.id,
                        and_(
                            ActivityLog.entity_type == "EMPLOYEE",
                            ActivityLog.entity_id.in_(assigned_ids)
                        )
                    )
                )
        elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            # Events where actor is user or entity belongs to subordinates
            sub_ids = list(scope["subordinate_ids"] or [])
            if department_id:
                dept_emp_stmt = select(Employee.id).where(and_(Employee.department_id == department_id, Employee.id.in_(sub_ids)))
                dept_task_stmt = select(Task.id).join(Employee, Task.employee_id == Employee.id).where(and_(Employee.department_id == department_id, Task.employee_id.in_(sub_ids)))
                stmt = stmt.where(
                    or_(
                        and_(ActivityLog.entity_type == "EMPLOYEE", ActivityLog.entity_id.in_(dept_emp_stmt)),
                        and_(ActivityLog.entity_type == "TASK", ActivityLog.entity_id.in_(dept_task_stmt)),
                    )
                )
            else:
                stmt = stmt.where(
                    or_(
                        ActivityLog.user_id == current_user.id,
                        and_(
                            ActivityLog.entity_type == "EMPLOYEE",
                            ActivityLog.entity_id.in_(sub_ids)
                        ),
                        and_(
                            ActivityLog.entity_type == "TASK",
                            ActivityLog.entity_id.in_(
                                select(Task.id).where(Task.employee_id.in_(sub_ids))
                            )
                        )
                    )
                )
        else:
            return []

        activity_records = db.scalars(stmt.limit(limit)).all()
        activities: List[ActivityItem] = []

        action_labels = {
            "REASSIGN_TASK": "Reassigned operational task",
            "ACKNOWLEDGE_FOLLOWUP": "Acknowledged escalation follow-up",
            "APPROVE_CONFIRMATION": "Approved employment confirmation",
            "STATUS_CHANGE": "Updated employee operational status",
            "CREATE_TASK": "Created new HR workflow task",
        }

        # Collect user ids to resolve names efficiently
        user_ids = {a.user_id for a in activity_records if a.user_id}
        users_map = {}
        if user_ids:
            users_list = db.scalars(select(User).where(User.id.in_(user_ids))).all()
            users_map = {u.id: u.full_name for u in users_list}

        for act in activity_records:
            actor_name = users_map.get(act.user_id, f"User #{act.user_id}") if act.user_id else "System"
            action_label = action_labels.get(act.action, act.action.replace("_", " ").title())
            created_dt = act.created_at.astimezone(KOLKATA_TZ) if act.created_at else datetime.now(KOLKATA_TZ)

            activities.append(
                ActivityItem(
                    id=act.id,
                    entity_type=act.entity_type,
                    entity_id=act.entity_id,
                    action=act.action,
                    action_label=action_label,
                    actor_id=act.user_id,
                    actor_name=actor_name,
                    employee_name=None,
                    details=act.details or {},
                    created_at=act.created_at,
                    formatted_time=created_dt.strftime("%d %b %Y, %I:%M %p"),
                )
            )

        return activities
