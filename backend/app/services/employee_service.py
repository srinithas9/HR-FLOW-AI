from typing import Optional, List, Any, Set, Dict
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, func, or_, and_, desc, asc, union, false, true

from app.core.exceptions import ResourceNotFoundException, PermissionDeniedException, ValidationException
from app.core.permissions import get_reporting_employee_ids
from app.models.organization import Employee, Department, User
from app.models.lifecycle import (
    EmployeeLifecycle,
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)
from app.models.compliance import EmployeeDocument, DocumentRequirement
from app.models.workflow import Task, FollowUp, Escalation
from app.models.intelligence import ActivityLog
from app.schemas.employee import (
    EmployeeRead,
    EmployeeDetail,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeProfileResponse,
    EmployeeTaskItem,
    EmployeeActivityItem,
    EmployeeFilterOptions,
)
from app.schemas.lifecycle import (
    EmployeeLifecycleRead,
    OnboardingRecordRead,
    ProbationRecordRead,
    ConfirmationRecordRead,
    PerformanceReviewRead,
    OffboardingRecordRead,
)
from app.schemas.document import EmployeeDocumentRead
from app.schemas.common import PaginatedResponse, PaginationMeta

APPROVED_SORT_FIELDS = {
    "id": Employee.id,
    "employee_code": Employee.employee_code,
    "first_name": Employee.first_name,
    "last_name": Employee.last_name,
    "date_of_joining": Employee.date_of_joining,
    "employment_status": Employee.employment_status,
    "location": Employee.location,
    "designation": Employee.designation,
}

CATEGORY_LINK_MAP = {
    "ONBOARDING": "/onboarding",
    "PROBATION": "/probation",
    "CONFIRMATION": "/confirmation",
    "DOCUMENTATION": "/compliance",
    "COMPLIANCE": "/compliance",
    "PERFORMANCE": "/performance",
    "OFFBOARDING": "/offboarding",
}


class EmployeeService:
    @staticmethod
    def _check_reporting_cycle(db: Session, employee_id: int, new_manager_id: Optional[int]) -> bool:
        """
        Check if assigning new_manager_id creates a circular reporting chain or self-reporting loop.
        Returns True if a cycle is detected, False otherwise.
        """
        if not new_manager_id:
            return False
        if new_manager_id == employee_id:
            return True

        curr = new_manager_id
        visited: Set[int] = set()
        while curr:
            if curr in visited:
                break
            visited.add(curr)
            if curr == employee_id:
                return True
            curr = db.scalar(select(Employee.manager_id).where(Employee.id == curr))
        return False

    @staticmethod
    def _get_executive_assigned_employee_ids(db: Session, user_id: int) -> Set[int]:
        """
        Calculates employee IDs with active assigned responsibilities for HR_EXECUTIVE:
        - Tasks owned or where executive is an active party in pending follow-up / open escalation
        - Confirmation workflows assigned to the executive pending approval
        - Document verifications assigned to the executive pending verification
        """
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
        assigned_emp_ids.discard(None)
        return assigned_emp_ids

    @staticmethod
    def list_employees(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        employment_status: Optional[str] = None,
        manager_id: Optional[int] = None,
        location: Optional[str] = None,
        designation: Optional[str] = None,
        joining_date_from: Optional[date] = None,
        joining_date_to: Optional[date] = None,
        sort_by: str = "id",
        sort_order: str = "asc",
    ) -> PaginatedResponse[EmployeeDetail]:
        """
        List employees with pagination, search, multi-field filtering, sorting, and RBAC query scoping.
        - ADMIN & HR_MANAGER: Full organization-wide visibility.
        - HR_EXECUTIVE: Scoped strictly to assigned responsibilities.
        - REPORTING_MANAGER: Scoped strictly to direct and indirect reporting hierarchy.
        """
        Manager = aliased(Employee)
        stmt = (
            select(
                Employee,
                Department.name.label("department_name"),
                func.concat(Manager.first_name, " ", Manager.last_name).label("manager_name")
            )
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Manager, Employee.manager_id == Manager.id)
        )

        # RBAC Query Scoping
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            reporting_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if not reporting_ids:
                return PaginatedResponse(
                    items=[],
                    pagination=PaginationMeta(page=page, size=size, total=0, total_pages=0)
                )
            stmt = stmt.where(Employee.id.in_(reporting_ids))
        elif role_code == "HR_EXECUTIVE":
            assigned_ids = EmployeeService._get_executive_assigned_employee_ids(db, current_user.id)
            if not assigned_ids:
                return PaginatedResponse(
                    items=[],
                    pagination=PaginationMeta(page=page, size=size, total=0, total_pages=0)
                )
            stmt = stmt.where(Employee.id.in_(assigned_ids))
        elif role_code not in ["ADMIN", "HR_MANAGER"]:
            # Fallback strict deny for unknown roles
            return PaginatedResponse(
                items=[],
                pagination=PaginationMeta(page=page, size=size, total=0, total_pages=0)
            )

        # Filters
        if department_id is not None:
            stmt = stmt.where(Employee.department_id == department_id)

        if employment_status:
            stmt = stmt.where(Employee.employment_status == employment_status.strip().upper())

        if manager_id is not None:
            stmt = stmt.where(Employee.manager_id == manager_id)

        if location:
            stmt = stmt.where(Employee.location.ilike(f"%{location.strip()}%"))

        if designation:
            stmt = stmt.where(Employee.designation == designation.strip())

        if joining_date_from:
            stmt = stmt.where(Employee.date_of_joining >= joining_date_from)

        if joining_date_to:
            stmt = stmt.where(Employee.date_of_joining <= joining_date_to)

        # Search across code, first_name, last_name, full name, email, designation
        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Employee.employee_code.ilike(search_pattern),
                    Employee.first_name.ilike(search_pattern),
                    Employee.last_name.ilike(search_pattern),
                    func.concat(Employee.first_name, " ", Employee.last_name).ilike(search_pattern),
                    Employee.email.ilike(search_pattern),
                    Employee.designation.ilike(search_pattern)
                )
            )

        # Count total matching
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        # Sorting
        sort_column = APPROVED_SORT_FIELDS.get(sort_by, Employee.id)
        if sort_order.lower() == "desc":
            stmt = stmt.order_by(desc(sort_column))
        else:
            stmt = stmt.order_by(asc(sort_column))

        # Pagination
        offset = (page - 1) * size
        stmt = stmt.offset(offset).limit(size)
        rows = db.execute(stmt).all()

        if not rows:
            return PaginatedResponse(
                items=[],
                pagination=PaginationMeta(page=page, size=size, total=total, total_pages=(total + size - 1) // size if size > 0 else 1)
            )

        emp_ids = [emp.id for emp, _, _ in rows]

        # Batch fetch in-progress / active lifecycle stages for the page
        lifecycle_stmt = (
            select(EmployeeLifecycle.employee_id, EmployeeLifecycle.current_stage)
            .where(
                EmployeeLifecycle.employee_id.in_(emp_ids),
                EmployeeLifecycle.stage_status.in_(["IN_PROGRESS", "ACTIVE"])
            )
            .order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        active_stages = dict(db.execute(lifecycle_stmt).all())

        items = []
        for emp, dept_name, mgr_name in rows:
            detail = EmployeeDetail.model_validate(emp)
            detail.department_name = dept_name
            detail.manager_name = mgr_name
            # Set current lifecycle stage if active; otherwise None or employment_status
            detail.current_lifecycle_stage = active_stages.get(emp.id)
            items.append(detail)

        total_pages = (total + size - 1) // size if size > 0 else 1

        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(
                page=page,
                size=size,
                total=total,
                total_pages=total_pages
            )
        )

    @staticmethod
    def get_employee_by_id(db: Session, current_user: User, employee_id: int) -> EmployeeDetail:
        """
        Get employee by ID with department and manager details, enforcing strict RBAC scoping.
        """
        # RBAC Check before querying
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            reporting_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if employee_id not in reporting_ids:
                raise PermissionDeniedException(
                    "Access denied: You are only authorized to view employees within your direct reporting hierarchy."
                )
        elif role_code == "HR_EXECUTIVE":
            assigned_ids = EmployeeService._get_executive_assigned_employee_ids(db, current_user.id)
            if employee_id not in assigned_ids:
                raise PermissionDeniedException(
                    "Access denied: You are only authorized to view employees with active assigned responsibilities."
                )
        elif role_code not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Access denied.")

        Manager = aliased(Employee)
        stmt = (
            select(
                Employee,
                Department.name.label("department_name"),
                func.concat(Manager.first_name, " ", Manager.last_name).label("manager_name")
            )
            .outerjoin(Department, Employee.department_id == Department.id)
            .outerjoin(Manager, Employee.manager_id == Manager.id)
            .where(Employee.id == employee_id)
        )
        row = db.execute(stmt).first()

        if not row:
            raise ResourceNotFoundException(f"Employee with ID {employee_id} does not exist.")

        employee, dept_name, mgr_name = row
        detail = EmployeeDetail.model_validate(employee)
        detail.department_name = dept_name
        detail.manager_name = mgr_name

        # Check active lifecycle stage
        active_stage = db.scalar(
            select(EmployeeLifecycle.current_stage)
            .where(
                EmployeeLifecycle.employee_id == employee_id,
                EmployeeLifecycle.stage_status.in_(["IN_PROGRESS", "ACTIVE"])
            )
            .order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        detail.current_lifecycle_stage = active_stage

        return detail

    @staticmethod
    def create_employee(db: Session, current_user: User, data: EmployeeCreate) -> EmployeeDetail:
        """
        Create a new employee with full validation and initial lifecycle record.
        Strictly restricted to ADMIN and HR_MANAGER.
        """
        user_role = current_user.role.role_code if current_user.role else ""
        if user_role not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only ADMIN and HR_MANAGER are authorized to add new employees.")

        # Validate unique employee_code
        existing_code = db.scalar(select(Employee).where(Employee.employee_code == data.employee_code.strip().upper()))
        if existing_code:
            raise ValidationException(f"Employee with code '{data.employee_code}' already exists.")

        # Validate unique email
        existing_email = db.scalar(select(Employee).where(Employee.email == str(data.email).strip().lower()))
        if existing_email:
            raise ValidationException(f"Employee with email '{data.email}' already exists.")

        # Validate department
        dept = db.scalar(select(Department).where(Department.id == data.department_id))
        if not dept:
            raise ValidationException(f"Department ID {data.department_id} does not exist.")

        # Validate manager if specified
        if data.manager_id is not None:
            mgr = db.scalar(select(Employee).where(Employee.id == data.manager_id))
            if not mgr:
                raise ValidationException(f"Reporting Manager ID {data.manager_id} does not exist.")

        # Create employee record
        new_emp = Employee(
            employee_code=data.employee_code.strip().upper(),
            first_name=data.first_name.strip(),
            last_name=data.last_name.strip(),
            email=str(data.email).strip().lower(),
            phone_number=data.phone_number.strip(),
            department_id=data.department_id,
            designation=data.designation.strip(),
            location=data.location.strip(),
            employment_status=data.employment_status.strip().upper(),
            date_of_joining=data.date_of_joining,
            manager_id=data.manager_id,
        )
        db.add(new_emp)
        db.flush()

        # Initialize lifecycle record
        initial_stage = "ONBOARDING" if data.employment_status in ["PROBATION", "ONBOARDING"] else "CONFIRMED"
        lifecycle_entry = EmployeeLifecycle(
            employee_id=new_emp.id,
            current_stage=initial_stage,
            stage_start_date=data.date_of_joining,
            stage_target_date=data.date_of_joining + timedelta(days=90 if initial_stage == "PROBATION" else 30),
            stage_status="IN_PROGRESS",
            notes=f"Initial lifecycle stage {initial_stage} created upon employee onboarding."
        )
        db.add(lifecycle_entry)

        # If onboarding/probation, also create corresponding stage records
        if initial_stage == "ONBOARDING" or data.employment_status == "PROBATION":
            onboarding_rec = OnboardingRecord(
                employee_id=new_emp.id,
                start_date=data.date_of_joining,
                target_completion_date=data.date_of_joining + timedelta(days=30),
                buddy_id=data.manager_id,
                it_asset_status="PENDING",
                bgv_status="PENDING",
                orientation_completed=False,
                overall_status="IN_PROGRESS"
            )
            db.add(onboarding_rec)

            probation_rec = ProbationRecord(
                employee_id=new_emp.id,
                probation_start_date=data.date_of_joining,
                probation_end_date=data.date_of_joining + timedelta(days=90),
                status="UNDER_REVIEW"
            )
            db.add(probation_rec)

        # Log activity
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="EMPLOYEE",
            entity_id=new_emp.id,
            action="CREATE",
            details={
                "employee_code": new_emp.employee_code,
                "name": f"{new_emp.first_name} {new_emp.last_name}",
                "department_id": new_emp.department_id,
                "designation": new_emp.designation,
                "employment_status": new_emp.employment_status,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(new_emp)

        return EmployeeService.get_employee_by_id(db, current_user, new_emp.id)

    @staticmethod
    def update_employee(
        db: Session,
        current_user: User,
        employee_id: int,
        data: EmployeeUpdate
    ) -> EmployeeDetail:
        """
        Update employee details with relation validation, cycle prevention, and audit logging.
        Strictly restricted to ADMIN and HR_MANAGER.
        """
        user_role = current_user.role.role_code if current_user.role else ""
        if user_role not in ["ADMIN", "HR_MANAGER"]:
            raise PermissionDeniedException("Only ADMIN and HR_MANAGER are authorized to edit employees.")

        emp = db.scalar(select(Employee).where(Employee.id == employee_id))
        if not emp:
            raise ResourceNotFoundException(f"Employee with ID {employee_id} does not exist.")

        # Check self-reporting and circular reporting chains
        if data.manager_id is not None:
            if data.manager_id == employee_id:
                raise ValidationException("An employee cannot be designated as their own reporting manager.")
            if EmployeeService._check_reporting_cycle(db, employee_id, data.manager_id):
                raise ValidationException("Circular reporting chain detected. A subordinate cannot be assigned as reporting manager.")

            mgr = db.scalar(select(Employee).where(Employee.id == data.manager_id))
            if not mgr:
                raise ValidationException(f"Reporting Manager ID {data.manager_id} does not exist.")
            emp.manager_id = data.manager_id

        # Validate unique email if updated
        if data.email is not None and str(data.email).strip().lower() != emp.email:
            existing_email = db.scalar(
                select(Employee).where(Employee.email == str(data.email).strip().lower(), Employee.id != employee_id)
            )
            if existing_email:
                raise ValidationException(f"Employee with email '{data.email}' already exists.")
            emp.email = str(data.email).strip().lower()

        # Validate department if updated
        if data.department_id is not None and data.department_id != emp.department_id:
            dept = db.scalar(select(Department).where(Department.id == data.department_id))
            if not dept:
                raise ValidationException(f"Department ID {data.department_id} does not exist.")
            emp.department_id = data.department_id

        changes = {}
        if data.first_name is not None:
            changes["first_name"] = (emp.first_name, data.first_name.strip())
            emp.first_name = data.first_name.strip()
        if data.last_name is not None:
            changes["last_name"] = (emp.last_name, data.last_name.strip())
            emp.last_name = data.last_name.strip()
        if data.phone_number is not None:
            emp.phone_number = data.phone_number.strip()
        if data.designation is not None:
            changes["designation"] = (emp.designation, data.designation.strip())
            emp.designation = data.designation.strip()
        if data.location is not None:
            changes["location"] = (emp.location, data.location.strip())
            emp.location = data.location.strip()
        if data.employment_status is not None:
            changes["employment_status"] = (emp.employment_status, data.employment_status.strip().upper())
            emp.employment_status = data.employment_status.strip().upper()
        if data.date_of_joining is not None:
            emp.date_of_joining = data.date_of_joining

        # Log activity
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="EMPLOYEE",
            entity_id=employee_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(emp)

        return EmployeeService.get_employee_by_id(db, current_user, employee_id)

    @staticmethod
    def get_employee_profile(db: Session, current_user: User, employee_id: int) -> EmployeeProfileResponse:
        """
        Retrieve comprehensive employee profile spanning personal details and all 6 lifecycle dimensions:
        Onboarding, Probation, Confirmation, Documents, Performance Reviews, Offboarding,
        clearly distinguishing between HR tasks concerning the employee and tasks assigned to the employee.
        """
        # 1. Fetch base employee with RBAC validation
        employee_detail = EmployeeService.get_employee_by_id(db, current_user, employee_id)
        role_code = current_user.role.role_code if current_user.role else ""
        can_edit = role_code in ["ADMIN", "HR_MANAGER"]

        # Check linked user account for this employee (if any)
        linked_user = db.scalar(select(User).where(User.employee_id == employee_id))
        linked_user_id = linked_user.id if linked_user else None

        # 2. Lifecycle Timeline & Current Stage
        lifecycle_stmt = (
            select(EmployeeLifecycle)
            .where(EmployeeLifecycle.employee_id == employee_id)
            .order_by(desc(EmployeeLifecycle.stage_start_date))
        )
        lifecycle_entries = db.scalars(lifecycle_stmt).all()
        active_stage_rec = next((l for l in lifecycle_entries if l.stage_status in ["IN_PROGRESS", "ACTIVE"]), None)
        current_stage = active_stage_rec.current_stage if active_stage_rec else (lifecycle_entries[0].current_stage if lifecycle_entries else employee_detail.employment_status)

        # 3. Onboarding Record & Checklist Tasks
        onboarding_stmt = select(OnboardingRecord).where(OnboardingRecord.employee_id == employee_id)
        onboarding_rec = db.scalar(onboarding_stmt)
        onboarding_read = OnboardingRecordRead.model_validate(onboarding_rec) if onboarding_rec else None

        # Onboarding checklist tasks
        onboarding_tasks_stmt = (
            select(Task, User, Employee)
            .outerjoin(User, Task.owner_id == User.id)
            .outerjoin(Employee, User.employee_id == Employee.id)
            .where(Task.employee_id == employee_id, Task.category == "ONBOARDING")
            .order_by(Task.due_date)
        )
        onboarding_rows = db.execute(onboarding_tasks_stmt).all()
        onboarding_checklist: List[EmployeeTaskItem] = []
        for t, u, e in onboarding_rows:
            owner_display = f"{e.first_name} {e.last_name}" if e else (u.email if u else "Unassigned")
            onboarding_checklist.append(
                EmployeeTaskItem(
                    id=t.id,
                    task_code=t.task_code,
                    title=t.title,
                    category=t.category,
                    priority=t.priority,
                    status=t.status,
                    due_date=t.due_date,
                    completed_at=t.completed_at,
                    owner_id=t.owner_id,
                    owner_name=owner_display,
                    is_subject=True,
                    link_path="/onboarding",
                )
            )

        # 4. Probation Record
        probation_stmt = (
            select(ProbationRecord)
            .where(ProbationRecord.employee_id == employee_id)
            .order_by(desc(ProbationRecord.created_at))
        )
        probation_rec = db.scalar(probation_stmt)
        probation_read = ProbationRecordRead.model_validate(probation_rec) if probation_rec else None

        # 5. Confirmation Record
        confirmation_stmt = (
            select(ConfirmationRecord)
            .where(ConfirmationRecord.employee_id == employee_id)
            .order_by(desc(ConfirmationRecord.created_at))
        )
        confirmation_rec = db.scalar(confirmation_stmt)
        confirmation_read = ConfirmationRecordRead.model_validate(confirmation_rec) if confirmation_rec else None

        # 6. Document Checklist & Submissions
        doc_stmt = (
            select(EmployeeDocument, DocumentRequirement.name.label("requirement_name"))
            .join(DocumentRequirement, EmployeeDocument.requirement_id == DocumentRequirement.id)
            .where(EmployeeDocument.employee_id == employee_id)
            .order_by(EmployeeDocument.submission_date)
        )
        doc_rows = db.execute(doc_stmt).all()
        doc_list = []
        for d, req_name in doc_rows:
            d_read = EmployeeDocumentRead.model_validate(d)
            d_read.requirement_name = req_name
            doc_list.append(d_read)

        # 7. Performance Reviews History
        perf_stmt = (
            select(PerformanceReview)
            .where(PerformanceReview.employee_id == employee_id)
            .order_by(desc(PerformanceReview.review_submission_deadline))
        )
        perf_reviews = db.scalars(perf_stmt).all()
        perf_list = [PerformanceReviewRead.model_validate(pr) for pr in perf_reviews]

        # 8. Offboarding Record
        offboarding_stmt = select(OffboardingRecord).where(OffboardingRecord.employee_id == employee_id)
        offboarding_rec = db.scalar(offboarding_stmt)
        offboarding_read = OffboardingRecordRead.model_validate(offboarding_rec) if offboarding_rec else None

        # 9. Tasks concerning the employee (Subject = Employee)
        hr_tasks_stmt = (
            select(Task, User, Employee)
            .outerjoin(User, Task.owner_id == User.id)
            .outerjoin(Employee, User.employee_id == Employee.id)
            .where(Task.employee_id == employee_id)
            .order_by(desc(Task.due_date))
        )
        hr_tasks_rows = db.execute(hr_tasks_stmt).all()
        hr_tasks: List[EmployeeTaskItem] = []
        for t, u, e in hr_tasks_rows:
            owner_display = f"{e.first_name} {e.last_name}" if e else (u.email if u else "Unassigned")
            hr_tasks.append(
                EmployeeTaskItem(
                    id=t.id,
                    task_code=t.task_code,
                    title=t.title,
                    category=t.category,
                    priority=t.priority,
                    status=t.status,
                    due_date=t.due_date,
                    completed_at=t.completed_at,
                    owner_id=t.owner_id,
                    owner_name=owner_display,
                    is_subject=True,
                    link_path=CATEGORY_LINK_MAP.get(t.category, "/tasks"),
                )
            )

        # 10. Tasks assigned to the employee (Owner = Linked User)
        assigned_tasks: List[EmployeeTaskItem] = []
        if linked_user_id:
            assigned_stmt = (
                select(Task, User, Employee)
                .outerjoin(User, Task.owner_id == User.id)
                .outerjoin(Employee, User.employee_id == Employee.id)
                .where(Task.owner_id == linked_user_id)
                .order_by(desc(Task.due_date))
            )
            assigned_rows = db.execute(assigned_stmt).all()
            for t, u, e in assigned_rows:
                owner_display = f"{e.first_name} {e.last_name}" if e else (u.email if u else "Unassigned")
                assigned_tasks.append(
                    EmployeeTaskItem(
                        id=t.id,
                        task_code=t.task_code,
                        title=t.title,
                        category=t.category,
                        priority=t.priority,
                        status=t.status,
                        due_date=t.due_date,
                        completed_at=t.completed_at,
                        owner_id=t.owner_id,
                        owner_name=owner_display,
                        is_subject=False,
                        link_path=CATEGORY_LINK_MAP.get(t.category, "/tasks"),
                    )
                )

        # All tasks combined with deduplication
        all_tasks_map = {t.id: t for t in hr_tasks}
        for t in assigned_tasks:
            if t.id not in all_tasks_map:
                all_tasks_map[t.id] = t
        combined_tasks = list(all_tasks_map.values())

        # 11. Pending actions concerning the employee
        pending_actions: List[Dict[str, Any]] = []
        # A. Open HR tasks concerning employee
        for t in hr_tasks:
            if t.status in ["PENDING", "IN_PROGRESS", "BLOCKED", "DELAYED"]:
                pending_actions.append({
                    "id": f"task-{t.id}",
                    "category": t.category,
                    "title": t.title,
                    "status": t.status,
                    "priority": t.priority,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "responsible_party": t.owner_name,
                    "link_path": t.link_path,
                })

        # B. Pending probation review
        if probation_rec and probation_rec.status in ["UNDER_REVIEW", "PENDING", "EXTENDED"]:
            pending_actions.append({
                "id": f"probation-{probation_rec.id}",
                "category": "PROBATION",
                "title": f"Probation Review ({probation_rec.status})",
                "status": probation_rec.status,
                "priority": "HIGH",
                "due_date": probation_rec.probation_end_date.isoformat() if probation_rec.probation_end_date else None,
                "responsible_party": employee_detail.manager_name or "Reporting Manager",
                "link_path": "/probation",
            })

        # C. Pending confirmation decision
        if confirmation_rec and confirmation_rec.status in ["PENDING_APPROVAL", "UNDER_REVIEW", "INITIATED"]:
            pending_actions.append({
                "id": f"confirmation-{confirmation_rec.id}",
                "category": "CONFIRMATION",
                "title": f"Confirmation Decision ({confirmation_rec.status})",
                "status": confirmation_rec.status,
                "priority": "CRITICAL" if confirmation_rec.status == "PENDING_APPROVAL" else "HIGH",
                "due_date": confirmation_rec.scheduled_confirmation_date.isoformat() if confirmation_rec.scheduled_confirmation_date else None,
                "responsible_party": "HR Operations",
                "link_path": "/confirmation",
            })

        # D. Unverified documents
        for doc in doc_list:
            if doc.status in ["PENDING_SUBMISSION", "SUBMITTED", "PENDING_VERIFICATION"]:
                pending_actions.append({
                    "id": f"doc-{doc.id}",
                    "category": "DOCUMENTATION",
                    "title": f"Document Verification: {getattr(doc, 'requirement_name', 'Required Document')}",
                    "status": doc.status,
                    "priority": "MEDIUM",
                    "due_date": None,
                    "responsible_party": "HR Compliance",
                    "link_path": "/compliance",
                })

        # E. In-progress offboarding clearance
        if offboarding_rec and offboarding_rec.overall_status in ["INITIATED", "IN_PROGRESS", "CLEARANCE_PENDING"]:
            pending_actions.append({
                "id": f"offboarding-{offboarding_rec.id}",
                "category": "OFFBOARDING",
                "title": f"Offboarding Clearance ({offboarding_rec.overall_status})",
                "status": offboarding_rec.overall_status,
                "priority": "HIGH",
                "due_date": offboarding_rec.last_working_day.isoformat() if offboarding_rec.last_working_day else None,
                "responsible_party": "HR Operations",
                "link_path": "/offboarding",
            })

        # 12. Activity & History from ActivityLog
        lifecycle_ids = [l.id for l in lifecycle_entries]
        hr_task_ids = [t.id for t in hr_tasks]

        activity_filter = or_(
            and_(ActivityLog.entity_type == "EMPLOYEE", ActivityLog.entity_id == employee_id),
            and_(ActivityLog.entity_type == "LIFECYCLE", ActivityLog.entity_id.in_(lifecycle_ids)) if lifecycle_ids else false(),
            and_(ActivityLog.entity_type == "CONFIRMATION", ActivityLog.entity_id == confirmation_rec.id) if confirmation_rec else false(),
            and_(ActivityLog.entity_type == "TASK", ActivityLog.entity_id.in_(hr_task_ids)) if hr_task_ids else false(),
        )

        ActUser = aliased(User)
        ActEmp = aliased(Employee)
        activity_stmt = (
            select(
                ActivityLog,
                func.coalesce(func.concat(ActEmp.first_name, " ", ActEmp.last_name), ActUser.email, "System").label("user_name")
            )
            .outerjoin(ActUser, ActivityLog.user_id == ActUser.id)
            .outerjoin(ActEmp, ActUser.employee_id == ActEmp.id)
            .where(activity_filter)
            .order_by(desc(ActivityLog.created_at))
            .limit(50)
        )
        activity_rows = db.execute(activity_stmt).all()

        activity_history: List[EmployeeActivityItem] = []
        for act, user_disp in activity_rows:
            activity_history.append(
                EmployeeActivityItem(
                    id=act.id,
                    action=act.action,
                    entity_type=act.entity_type,
                    entity_id=act.entity_id or employee_id,
                    user_id=act.user_id,
                    user_name=user_disp,
                    details=act.details or {},
                    created_at=act.created_at,
                )
            )

        return EmployeeProfileResponse(
            employee=employee_detail,
            current_lifecycle_stage=current_stage,
            lifecycle_history=[EmployeeLifecycleRead.model_validate(l) for l in lifecycle_entries],
            onboarding=onboarding_read,
            onboarding_checklist=onboarding_checklist,
            probation=probation_read,
            confirmation=confirmation_read,
            documents=doc_list,
            performance_reviews=perf_list,
            offboarding=offboarding_read,
            hr_tasks=hr_tasks,
            assigned_tasks=assigned_tasks,
            tasks=combined_tasks,
            pending_actions=pending_actions,
            activity_history=activity_history,
            can_edit=can_edit,
        )

    @staticmethod
    def get_filter_options(db: Session, current_user: User) -> EmployeeFilterOptions:
        """
        Return available filter options: distinct designations, active managers, departments, and employment statuses.
        """
        # Designations
        designations_stmt = (
            select(Employee.designation)
            .where(Employee.designation.isnot(None))
            .distinct()
            .order_by(Employee.designation)
        )
        designations = [d for d in db.scalars(designations_stmt).all() if d]

        # Managers (employees who manage someone)
        mgr_subquery = select(Employee.manager_id).where(Employee.manager_id.isnot(None)).distinct()
        managers_stmt = (
            select(Employee.id, Employee.first_name, Employee.last_name, Employee.designation)
            .where(Employee.id.in_(mgr_subquery))
            .order_by(Employee.first_name, Employee.last_name)
        )
        manager_rows = db.execute(managers_stmt).all()
        managers = [
            {"id": mid, "name": f"{fname} {lname}", "designation": desig}
            for mid, fname, lname, desig in manager_rows
        ]

        # Departments
        depts_stmt = select(Department.id, Department.name).order_by(Department.name)
        depts_rows = db.execute(depts_stmt).all()
        departments = [{"id": did, "name": dname} for did, dname in depts_rows]

        # Employment Statuses
        statuses_stmt = select(Employee.employment_status).distinct().order_by(Employee.employment_status)
        raw_statuses = [s for s in db.scalars(statuses_stmt).all() if s]
        standard_statuses = ["CONFIRMED", "PROBATION", "NOTICE_PERIOD", "RESIGNED", "ACTIVE"]
        combined_statuses = sorted(list(set(raw_statuses + standard_statuses)))

        return EmployeeFilterOptions(
            designations=designations,
            managers=managers,
            departments=departments,
            employment_statuses=combined_statuses,
        )
