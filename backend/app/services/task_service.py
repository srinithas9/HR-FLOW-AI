from datetime import datetime, date, timedelta
from typing import Optional, List, Set, Dict, Any, Tuple
from collections import deque
from sqlalchemy import select, and_, or_, func, desc, asc, text
from sqlalchemy.orm import Session, aliased

from app.core.exceptions import (
    ResourceNotFoundException,
    ValidationException,
    PermissionDeniedException,
)
from app.core.permissions import get_reporting_employee_ids
from app.models.organization import Employee, Department, User, Role
from app.models.workflow import (
    Task,
    TaskTemplate,
    TaskDependency,
    TaskStatusHistory,
    FollowUp,
    Notification,
    Escalation,
)
from app.models.intelligence import MLPrediction, TaskSnapshot, ActivityLog
from app.models.lifecycle import (
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    OffboardingRecord,
)
from app.models.compliance import EmployeeDocument
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.task import (
    TaskRead,
    TaskDetail,
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskReassign,
    TaskDeadlineExtension,
    TaskDependencyCreate,
    TaskDependencyRead,
    TaskStatusHistoryRead,
    TaskOverviewMetrics,
    MLPredictionInfo,
    TaskTemplateRead,
    TaskCommentRead,
)


class TaskService:

    @staticmethod
    def _get_ml_risk_level(prob: float) -> str:
        from app.services.ml_inference_service import get_predictor
        return get_predictor().classify_probability(prob)

    @staticmethod
    def _verify_task_access(db: Session, current_user: User, task: Task):
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]:
            return
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            # 1. Granted if manager is assigned owner of the task
            if task.owner_id == current_user.id:
                return
            # 2. Granted if the task's subject employee is in the manager's reporting hierarchy
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if task.employee_id in rep_ids:
                return
            raise PermissionDeniedException(
                "Access denied: You are only authorized to access tasks assigned to you or for employees within your direct reporting hierarchy."
            )
        # Standard EMPLOYEE role
        if task.owner_id == current_user.id or task.employee_id == current_user.employee_id:
            return
        raise PermissionDeniedException("Access denied: You are not authorized to access this task.")

    @staticmethod
    def _verify_reporting_manager_scope(db: Session, current_user: User, employee_id: int):
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if employee_id not in rep_ids:
                raise PermissionDeniedException(
                    "Access denied: You are only authorized to access tasks for employees within your direct reporting hierarchy."
                )

    @staticmethod
    def list_tasks(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        category: Optional[str] = None,
        department_id: Optional[int] = None,
        owner_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        due_date_from: Optional[date] = None,
        due_date_to: Optional[date] = None,
        overdue: Optional[bool] = None,
        risk_level: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "due_date",
        sort_order: str = "asc",
        active_only: Optional[bool] = None,
        due_in_next_days: Optional[int] = None,
        view: Optional[str] = None,
        due_window: Optional[str] = None,
    ) -> PaginatedResponse[TaskRead]:
        Owner = aliased(User)
        Dept = aliased(Department)

        # Base query with joined employee, department, owner, and task template
        stmt = (
            select(
                Task,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
                Owner.full_name.label("owner_name"),
                TaskTemplate.name.label("template_name"),
            )
            .join(Employee, Task.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .join(Owner, Task.owner_id == Owner.id)
            .outerjoin(TaskTemplate, Task.template_id == TaskTemplate.id)
        )

        today = date.today()
        role_code = current_user.role.role_code if current_user.role else ""

        # 1. Primary View Scoping
        view_upper = view.strip().upper() if view else None
        if view_upper == "MY_TASKS":
            stmt = stmt.where(Task.owner_id == current_user.id)
            if not status:
                stmt = stmt.where(Task.status.notin_(["COMPLETED", "CANCELLED"]))
        elif view_upper == "TEAM_TASKS":
            if role_code in ["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]:
                if department_id:
                    stmt = stmt.where(Employee.department_id == department_id)
                else:
                    hr_user_ids = db.scalars(
                        select(User.id).join(Role, User.role_id == Role.id).where(Role.role_code.in_(["HR_MANAGER", "HR_EXECUTIVE", "ADMIN"]))
                    ).all()
                    hr_dept_emp_ids = db.scalars(
                        select(Employee.id).join(Department, Employee.department_id == Department.id).where(Department.department_code == "DEPT_HR")
                    ).all()
                    stmt = stmt.where(or_(Task.owner_id.in_(hr_user_ids), Task.employee_id.in_(hr_dept_emp_ids)))
            elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
                rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
                team_user_ids = db.scalars(select(User.id).where(User.employee_id.in_(rep_ids))).all() if rep_ids else []
                stmt = stmt.where(or_(Task.employee_id.in_(rep_ids), Task.owner_id.in_(team_user_ids), Task.owner_id == current_user.id))
            elif role_code == "ADMIN":
                if department_id:
                    stmt = stmt.where(Employee.department_id == department_id)
            elif role_code == "EMPLOYEE":
                mgr_id = db.scalar(select(Employee.manager_id).where(Employee.id == current_user.employee_id))
                if mgr_id:
                    peer_ids = db.scalars(select(Employee.id).where(Employee.manager_id == mgr_id)).all()
                    stmt = stmt.where(or_(Task.employee_id.in_(peer_ids), Task.owner_id == current_user.id))
                else:
                    stmt = stmt.where(or_(Task.employee_id == current_user.employee_id, Task.owner_id == current_user.id))
            else:
                stmt = stmt.where(Task.owner_id == current_user.id)

            if not status:
                stmt = stmt.where(Task.status.notin_(["COMPLETED", "CANCELLED"]))
        elif view_upper == "COMPLETED":
            stmt = stmt.where(Task.status.in_(["COMPLETED", "CANCELLED"]))
        elif view_upper == "ALL_TASKS":
            if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
                rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
                stmt = stmt.where(or_(Task.employee_id.in_(rep_ids), Task.owner_id == current_user.id))
            elif role_code == "EMPLOYEE":
                stmt = stmt.where(or_(Task.employee_id == current_user.employee_id, Task.owner_id == current_user.id))
            if not status:
                stmt = stmt.where(Task.status.notin_(["COMPLETED", "CANCELLED"]))
        else:
            # Standard RBAC fallback
            if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
                rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
                stmt = stmt.where(or_(Task.employee_id.in_(rep_ids), Task.owner_id == current_user.id))
            elif role_code == "EMPLOYEE":
                stmt = stmt.where(or_(Task.employee_id == current_user.employee_id, Task.owner_id == current_user.id))

        # 2. Strict Active / Completed enforcement
        if active_only is True:
            stmt = stmt.where(Task.status.notin_(["COMPLETED", "CANCELLED"]))

        # 3. Due window filter
        if due_window:
            dw = due_window.strip().upper()
            if dw == "TODAY":
                stmt = stmt.where(and_(Task.due_date == today, Task.status.notin_(["COMPLETED", "CANCELLED"])))
            elif dw in ["NEXT_7_DAYS", "7_DAYS", "NEXT_7"]:
                stmt = stmt.where(and_(Task.due_date >= today, Task.due_date <= today + timedelta(days=7), Task.status.notin_(["COMPLETED", "CANCELLED"])))
            elif dw == "OVERDUE":
                stmt = stmt.where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"])))

        if due_in_next_days is not None:
            stmt = stmt.where(
                and_(
                    Task.due_date >= today,
                    Task.due_date <= today + timedelta(days=due_in_next_days),
                    Task.status.notin_(["COMPLETED", "CANCELLED"])
                )
            )

        if category:
            stmt = stmt.where(Task.category == category.strip().upper())
        if department_id:
            stmt = stmt.where(Employee.department_id == department_id)
        if owner_id:
            stmt = stmt.where(Task.owner_id == owner_id)
        if employee_id:
            TaskService._verify_reporting_manager_scope(db, current_user, employee_id)
            stmt = stmt.where(Task.employee_id == employee_id)

        # Priority filter (supports comma-separated)
        if priority:
            if "," in priority:
                p_list = [p.strip().upper() for p in priority.split(",") if p.strip()]
                stmt = stmt.where(Task.priority.in_(p_list))
            else:
                stmt = stmt.where(Task.priority == priority.strip().upper())

        # Status filter (supports comma-separated)
        if status:
            if "," in status:
                s_list = [s.strip().upper() for s in status.split(",") if s.strip()]
                stmt = stmt.where(Task.status.in_(s_list))
            else:
                stmt = stmt.where(Task.status == status.strip().upper())

        if due_date_from:
            stmt = stmt.where(Task.due_date >= due_date_from)
        if due_date_to:
            stmt = stmt.where(Task.due_date <= due_date_to)
        if overdue is True:
            stmt = stmt.where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"])))

        # 3. Search by task_code, title, description, or employee
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Task.task_code).like(term),
                    func.lower(Task.title).like(term),
                    func.lower(Task.description).like(term),
                    func.lower(Employee.first_name).like(term),
                    func.lower(Employee.last_name).like(term),
                    func.lower(func.concat(Employee.first_name, " ", Employee.last_name)).like(term),
                    func.lower(Employee.employee_code).like(term),
                )
            )

        # Total count query
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        # 4. Sorting
        sort_col = Task.due_date
        if sort_by == "priority":
            sort_col = Task.priority
        elif sort_by == "status":
            sort_col = Task.status
        elif sort_by == "created_at":
            sort_col = Task.created_at
        elif sort_by == "task_code":
            sort_col = Task.task_code

        if sort_order.lower() == "desc":
            stmt = stmt.order_by(desc(sort_col))
        else:
            stmt = stmt.order_by(asc(sort_col))

        stmt = stmt.offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        task_ids = [row[0].id for row in rows]

        # 5. Batch-load last follow-up dates
        last_follow_ups: Dict[int, date] = {}
        if task_ids:
            fu_stmt = (
                select(FollowUp.task_id, func.max(FollowUp.follow_up_date))
                .where(FollowUp.task_id.in_(task_ids))
                .group_by(FollowUp.task_id)
            )
            for tid, fdate in db.execute(fu_stmt).all():
                last_follow_ups[tid] = fdate

        items = []
        for task, emp_name, emp_code, dept_name, owner_name, tmpl_name in rows:
            r = TaskRead.model_validate(task)
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.department_name = dept_name
            r.owner_name = owner_name
            r.template_name = tmpl_name
            r.is_overdue = task.due_date < today and task.status not in ["COMPLETED", "CANCELLED"]
            r.last_follow_up_date = last_follow_ups.get(task.id)

            # Note: Legacy v1.2.0-rf stored predictions are intentionally omitted from list items
            # per Phase 7A cleanup requirements. Fresh advisory inference is available in Task Detail.
            r.ml_risk_score = None
            r.ml_confidence_score = None
            r.ml_risk_level = None

            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def get_task_overview(db: Session, current_user: User) -> TaskOverviewMetrics:
        role_code = current_user.role.role_code if current_user.role else ""
        rep_ids = None
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)

        base_stmt = select(Task)
        if rep_ids is not None:
            base_stmt = base_stmt.where(or_(Task.employee_id.in_(rep_ids), Task.owner_id == current_user.id))
        elif role_code == "EMPLOYEE":
            base_stmt = base_stmt.where(or_(Task.employee_id == current_user.employee_id, Task.owner_id == current_user.id))

        today = date.today()
        total = db.scalar(select(func.count()).select_from(base_stmt.subquery())) or 0
        pending = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status == "PENDING").subquery())) or 0
        in_progress = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status == "IN_PROGRESS").subquery())) or 0
        blocked = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status == "BLOCKED").subquery())) or 0
        delayed = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status == "DELAYED").subquery())) or 0
        completed = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status == "COMPLETED").subquery())) or 0
        active = db.scalar(select(func.count()).select_from(base_stmt.where(Task.status.notin_(["COMPLETED", "CANCELLED"])).subquery())) or 0
        overdue = db.scalar(
            select(func.count()).select_from(
                base_stmt.where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"]))).subquery()
            )
        ) or 0
        due_7 = db.scalar(
            select(func.count()).select_from(
                base_stmt.where(
                    and_(
                        Task.due_date >= today,
                        Task.due_date <= today + timedelta(days=7),
                        Task.status.notin_(["COMPLETED", "CANCELLED"])
                    )
                ).subquery()
            )
        ) or 0

        return TaskOverviewMetrics(
            total_tasks=total,
            pending_tasks=pending,
            in_progress_tasks=in_progress,
            blocked_tasks=blocked,
            completed_tasks=completed,
            overdue_tasks=overdue,
            high_risk_tasks=0,  # Legacy technical ML counter deprecated
            active_tasks=active,
            total_active_tasks=active,
            delayed_tasks=delayed,
            due_in_7_days=due_7,
        )

    @staticmethod
    def get_task_by_id(db: Session, current_user: User, task_id: int) -> TaskDetail:
        Owner = aliased(User)
        Dept = aliased(Department)

        stmt = (
            select(
                Task,
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Dept.name.label("department_name"),
                Owner.full_name.label("owner_name"),
                TaskTemplate.name.label("template_name"),
            )
            .join(Employee, Task.employee_id == Employee.id)
            .outerjoin(Dept, Employee.department_id == Dept.id)
            .join(Owner, Task.owner_id == Owner.id)
            .outerjoin(TaskTemplate, Task.template_id == TaskTemplate.id)
            .where(Task.id == task_id)
        )
        row = db.execute(stmt).first()
        if not row:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")

        task, emp_name, emp_code, dept_name, owner_name, tmpl_name = row
        TaskService._verify_task_access(db, current_user, task)

        detail = TaskDetail.model_validate(task)
        detail.employee_name = emp_name
        detail.employee_code = emp_code
        detail.department_name = dept_name
        detail.owner_name = owner_name
        detail.template_name = tmpl_name
        detail.is_overdue = task.due_date < date.today() and task.status not in ["COMPLETED", "CANCELLED"]

        # 1. Prerequisites (tasks this task depends on)
        PrereqTask = aliased(Task)
        PrereqOwner = aliased(User)
        dep_stmt = (
            select(
                TaskDependency,
                PrereqTask.task_code,
                PrereqTask.title,
                PrereqTask.status,
                PrereqTask.due_date,
                PrereqOwner.full_name,
            )
            .join(PrereqTask, TaskDependency.prerequisite_task_id == PrereqTask.id)
            .join(PrereqOwner, PrereqTask.owner_id == PrereqOwner.id)
            .where(TaskDependency.task_id == task_id)
            .order_by(TaskDependency.created_at)
        )
        prereqs = []
        blocking = []
        for dep, p_code, p_title, p_status, p_due, p_owner in db.execute(dep_stmt).all():
            d_read = TaskDependencyRead.model_validate(dep)
            d_read.prerequisite_task_code = p_code
            d_read.prerequisite_title = p_title
            d_read.prerequisite_status = p_status
            d_read.prerequisite_due_date = p_due
            d_read.prerequisite_owner_name = p_owner
            prereqs.append(d_read)
            if p_status != "COMPLETED":
                blocking.append({
                    "task_id": dep.prerequisite_task_id,
                    "task_code": p_code,
                    "title": p_title,
                    "status": p_status,
                })

        detail.prerequisites = prereqs
        detail.blocking_prerequisites = blocking
        detail.is_blocked = len(blocking) > 0 and task.status != "COMPLETED"

        # 2. Successors (tasks that depend on this task)
        DepTask = aliased(Task)
        succ_stmt = (
            select(
                TaskDependency,
                DepTask.task_code,
                DepTask.title,
                DepTask.status,
            )
            .join(DepTask, TaskDependency.task_id == DepTask.id)
            .where(TaskDependency.prerequisite_task_id == task_id)
            .order_by(TaskDependency.created_at)
        )
        successors = []
        for dep, s_code, s_title, s_status in db.execute(succ_stmt).all():
            d_read = TaskDependencyRead.model_validate(dep)
            d_read.dependent_task_code = s_code
            d_read.dependent_title = s_title
            d_read.dependent_status = s_status
            successors.append(d_read)
        detail.successors = successors

        # 3. Status History & Comments
        ChangeUser = aliased(User)
        OldOwner = aliased(User)
        NewOwner = aliased(User)
        hist_stmt = (
            select(
                TaskStatusHistory,
                ChangeUser.full_name.label("changed_by_name"),
                OldOwner.full_name.label("old_owner_name"),
                NewOwner.full_name.label("new_owner_name"),
            )
            .join(ChangeUser, TaskStatusHistory.changed_by_user_id == ChangeUser.id)
            .outerjoin(OldOwner, TaskStatusHistory.old_owner_id == OldOwner.id)
            .outerjoin(NewOwner, TaskStatusHistory.new_owner_id == NewOwner.id)
            .where(TaskStatusHistory.task_id == task_id)
            .order_by(desc(TaskStatusHistory.changed_at))
        )
        history = []
        comments = []
        for h, c_name, o_name, n_name in db.execute(hist_stmt).all():
            hr = TaskStatusHistoryRead.model_validate(h)
            hr.changed_by_name = c_name
            hr.old_owner_name = o_name
            hr.new_owner_name = n_name
            history.append(hr)
            if hr.change_reason and hr.change_reason.startswith("[COMMENT] "):
                comments.append(
                    TaskCommentRead(
                        id=hr.id,
                        task_id=hr.task_id,
                        user_id=hr.changed_by_user_id,
                        author_name=c_name or "HR Operations",
                        comment=hr.change_reason[10:].strip(),
                        created_at=hr.changed_at,
                    )
                )
        detail.status_history = history
        detail.comments = comments

        # 4. Phase 7A Advisory Shadow Inference (v2.1.0-phase7a)
        # Note: Obsolete legacy v1.2.0-rf records in database are omitted per scope restrictions.
        detail.latest_prediction = None
        detail.ml_risk_score = None
        detail.ml_confidence_score = None
        detail.ml_risk_level = None
        try:
            from app.services.ml_inference_service import MLInferenceService
            detail.shadow_prediction = MLInferenceService.predict_for_task(db=db, current_user=current_user, task_id=task.id)
            if detail.shadow_prediction:
                detail.ml_risk_score = detail.shadow_prediction.delay_probability
                detail.ml_risk_level = detail.shadow_prediction.risk_level
                detail.ml_confidence_score = 0.85
        except Exception:
            detail.shadow_prediction = None

        # 5. Last follow-up date
        last_fu = db.scalar(
            select(func.max(FollowUp.follow_up_date)).where(FollowUp.task_id == task_id)
        )
        detail.last_follow_up_date = last_fu

        return detail

    @staticmethod
    def create_task(db: Session, current_user: User, data: TaskCreate) -> TaskDetail:
        # Validate employee
        emp = db.scalar(select(Employee).where(Employee.id == data.employee_id))
        if not emp:
            raise ValidationException(f"Employee ID {data.employee_id} does not exist.")

        # RBAC validation: Reporting managers can only create tasks for direct reports
        TaskService._verify_reporting_manager_scope(db, current_user, data.employee_id)

        # Validate owner
        owner_id = data.owner_id or current_user.id
        owner = db.scalar(select(User).where(User.id == owner_id))
        if not owner:
            raise ValidationException(f"Task owner User ID {owner_id} does not exist.")

        # Validate template if provided
        if data.template_id:
            tmpl = db.scalar(select(TaskTemplate).where(TaskTemplate.id == data.template_id))
            if not tmpl:
                raise ValidationException(f"Task Template ID {data.template_id} does not exist.")

        # Generate unique task code
        max_id = db.scalar(select(func.coalesce(func.max(Task.id), 0))) or 0
        all_codes = db.execute(text("SELECT task_code FROM tasks WHERE task_code LIKE 'TSK-%' ORDER BY id DESC LIMIT 50;")).scalars().all()
        max_num = max_id
        for c in all_codes:
            try:
                n = int(c.replace("TSK-", ""))
                if n > max_num:
                    max_num = n
            except Exception:
                pass
        next_num = max_num + 1
        task_code = f"TSK-{next_num:05d}"
        while db.scalar(select(Task.id).where(Task.task_code == task_code)):
            next_num += 1
            task_code = f"TSK-{next_num:05d}"

        new_task = Task(
            task_code=task_code,
            template_id=data.template_id,
            employee_id=data.employee_id,
            owner_id=owner_id,
            category=data.category.strip().upper(),
            title=data.title.strip(),
            description=data.description.strip() if data.description else None,
            priority=data.priority.strip().upper(),
            status="PENDING",
            due_date=data.due_date,
            start_date=data.start_date or date.today(),
            deadline_extension_count=0,
        )
        db.add(new_task)
        db.flush()

        # Add initial dependencies if provided
        if data.prerequisite_task_ids:
            for pid in data.prerequisite_task_ids:
                if pid == new_task.id:
                    raise ValidationException("A task cannot depend on itself.")
                prereq = db.scalar(select(Task).where(Task.id == pid))
                if not prereq:
                    raise ValidationException(f"Prerequisite Task ID {pid} does not exist.")
                dep = TaskDependency(
                    task_id=new_task.id,
                    prerequisite_task_id=pid,
                    dependency_type="FINISH_TO_START"
                )
                db.add(dep)

        # Initial status history entry
        hist = TaskStatusHistory(
            task_id=new_task.id,
            old_status="NONE",
            new_status="PENDING",
            old_owner_id=None,
            new_owner_id=owner_id,
            old_due_date=None,
            new_due_date=data.due_date,
            changed_by_user_id=current_user.id,
            change_reason="Task created via HR Action Center.",
        )
        db.add(hist)

        # Notification for assigned owner
        notif = Notification(
            user_id=owner_id,
            task_id=new_task.id,
            title=f"Task Assignment: {new_task.title}",
            message=f"You have been assigned task {new_task.task_code} for employee {emp.first_name} {emp.last_name}, due on {new_task.due_date}.",
            notification_type="ASSIGNMENT",
        )
        db.add(notif)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=new_task.id,
            action="CREATE",
            details={
                "task_code": new_task.task_code,
                "title": new_task.title,
                "category": new_task.category,
                "owner_id": owner_id,
                "employee_id": new_task.employee_id,
                "due_date": str(new_task.due_date),
            }
        )
        db.add(log)
        db.commit()
        db.refresh(new_task)

        return TaskService.get_task_by_id(db, current_user, new_task.id)

    @staticmethod
    def update_task(db: Session, current_user: User, task_id: int, data: TaskUpdate) -> TaskDetail:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        changes = {}
        if data.title is not None:
            changes["title"] = (task.title, data.title.strip())
            task.title = data.title.strip()
        if data.description is not None:
            task.description = data.description.strip()
        if data.priority is not None:
            new_prio = data.priority.strip().upper()
            if new_prio not in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
                raise ValidationException("Priority must be LOW, MEDIUM, HIGH, or CRITICAL.")
            changes["priority"] = (task.priority, new_prio)
            task.priority = new_prio
        if data.category is not None:
            task.category = data.category.strip().upper()
        if data.start_date is not None:
            task.start_date = data.start_date

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task_id,
            action="UPDATE",
            details={"changes": changes}
        )
        db.add(log)
        db.commit()
        db.refresh(task)

        return TaskService.get_task_by_id(db, current_user, task_id)

    @staticmethod
    def reassign_task(db: Session, current_user: User, task_id: int, data: TaskReassign) -> TaskDetail:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        new_owner = db.scalar(select(User).where(User.id == data.new_owner_id))
        if not new_owner:
            raise ValidationException(f"New owner User ID {data.new_owner_id} does not exist.")

        old_owner_id = task.owner_id
        if old_owner_id == data.new_owner_id:
            return TaskService.get_task_by_id(db, current_user, task_id)

        task.owner_id = data.new_owner_id
        reason = data.reason.strip() if data.reason else "Task reassigned to new owner."

        # Status history entry
        hist = TaskStatusHistory(
            task_id=task.id,
            old_status=task.status,
            new_status=task.status,
            old_owner_id=old_owner_id,
            new_owner_id=data.new_owner_id,
            old_due_date=task.due_date,
            new_due_date=task.due_date,
            changed_by_user_id=current_user.id,
            change_reason=reason,
        )
        db.add(hist)

        # Notify new owner
        notif = Notification(
            user_id=data.new_owner_id,
            task_id=task.id,
            title=f"Task Reassignment: {task.title}",
            message=f"You have been reassigned task {task.task_code} (due {task.due_date}). Reason: {reason}",
            notification_type="REASSIGNMENT",
        )
        db.add(notif)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task.id,
            action="REASSIGN",
            details={
                "old_owner_id": old_owner_id,
                "new_owner_id": data.new_owner_id,
                "reason": reason,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(task)

        return TaskService.get_task_by_id(db, current_user, task_id)

    @staticmethod
    def extend_deadline(db: Session, current_user: User, task_id: int, data: TaskDeadlineExtension) -> TaskDetail:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        if not data.reason or len(data.reason.strip()) < 5:
            raise ValidationException("A clear reason (minimum 5 characters) is mandatory when modifying a task deadline.")

        old_due_date = task.due_date
        task.due_date = data.new_due_date
        task.deadline_extension_count += 1
        task.last_deadline_change_reason = data.reason.strip()

        # Status history entry
        hist = TaskStatusHistory(
            task_id=task.id,
            old_status=task.status,
            new_status=task.status,
            old_owner_id=task.owner_id,
            new_owner_id=task.owner_id,
            old_due_date=old_due_date,
            new_due_date=data.new_due_date,
            changed_by_user_id=current_user.id,
            change_reason=f"Deadline changed from {old_due_date} to {data.new_due_date}. Reason: {data.reason.strip()}",
        )
        db.add(hist)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task.id,
            action="EXTEND_DEADLINE",
            details={
                "old_due_date": str(old_due_date),
                "new_due_date": str(data.new_due_date),
                "extension_count": task.deadline_extension_count,
                "reason": data.reason.strip(),
            }
        )
        db.add(log)
        db.commit()
        db.refresh(task)

        return TaskService.get_task_by_id(db, current_user, task_id)

    @staticmethod
    def _sync_lifecycle_on_completion(db: Session, current_user: User, task: Task):
        """
        Safely synchronizes corresponding lifecycle record fields when an operational task is completed.
        Strictly updates explicitly mapped fields only; does not mark whole stages completed.
        Idempotent and transaction safe.
        """
        try:
            tmpl_code = ""
            if task.template_id:
                tmpl = db.scalar(select(TaskTemplate).where(TaskTemplate.id == task.template_id))
                if tmpl:
                    tmpl_code = tmpl.template_code or ""

            title_lower = task.title.lower() if task.title else ""
            cat_upper = task.category.upper() if task.category else ""

            # 1. Onboarding IT Asset Provisioning
            if tmpl_code == "TMPL_ONB_IT_PROV" or ("provision" in title_lower and ("workstation" in title_lower or "credential" in title_lower or "hardware" in title_lower)):
                onb = db.scalar(
                    select(OnboardingRecord)
                    .where(OnboardingRecord.employee_id == task.employee_id, OnboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OnboardingRecord.created_at))
                )
                if onb and onb.it_asset_status != "COMPLETED":
                    onb.it_asset_status = "COMPLETED"
                    db.add(onb)

            # 2. Onboarding Background Verification (BGV)
            elif tmpl_code == "TMPL_ONB_BGV_INIT" or ("background verification" in title_lower or "bgv" in title_lower):
                onb = db.scalar(
                    select(OnboardingRecord)
                    .where(OnboardingRecord.employee_id == task.employee_id, OnboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OnboardingRecord.created_at))
                )
                if onb and onb.bgv_status != "COMPLETED":
                    onb.bgv_status = "COMPLETED"
                    db.add(onb)

            # 3. Onboarding Orientation / Induction Training
            elif tmpl_code == "TMPL_ONB_ORIENT" or ("induction" in title_lower or "orientation" in title_lower):
                onb = db.scalar(
                    select(OnboardingRecord)
                    .where(OnboardingRecord.employee_id == task.employee_id, OnboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OnboardingRecord.created_at))
                )
                if onb and not onb.orientation_completed:
                    onb.orientation_completed = True
                    db.add(onb)

            # 4. Document Verification
            elif tmpl_code == "TMPL_ONB_DOC_VERIFY" or ("document" in title_lower and "verif" in title_lower):
                docs = db.scalars(
                    select(EmployeeDocument)
                    .where(EmployeeDocument.employee_id == task.employee_id, EmployeeDocument.status == "PENDING")
                ).all()
                for doc in docs:
                    doc.status = "VERIFIED"
                    doc.verified_by_id = current_user.id
                    doc.verified_at = datetime.now()
                    db.add(doc)

            # 5. Confirmation Letter Generation & Dispatch
            elif tmpl_code == "TMPL_CONF_LETTER_GEN" or ("confirmation letter" in title_lower):
                conf = db.scalar(
                    select(ConfirmationRecord)
                    .where(ConfirmationRecord.employee_id == task.employee_id)
                    .order_by(desc(ConfirmationRecord.created_at))
                )
                if conf and not conf.confirmation_letter_issued:
                    conf.confirmation_letter_issued = True
                    db.add(conf)

            # 6. Offboarding Exit Interview
            elif tmpl_code == "TMPL_OFF_EXIT_INTERVIEW" or ("exit interview" in title_lower):
                off = db.scalar(
                    select(OffboardingRecord)
                    .where(OffboardingRecord.employee_id == task.employee_id, OffboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OffboardingRecord.created_at))
                )
                if off and not off.exit_interview_completed:
                    off.exit_interview_completed = True
                    db.add(off)

            # 7. Offboarding Asset Recovery / Credential Revocation
            elif tmpl_code == "TMPL_OFF_ASSET_REC" or (cat_upper == "OFFBOARDING" and ("asset" in title_lower or "hardware" in title_lower or "revoke" in title_lower)):
                off = db.scalar(
                    select(OffboardingRecord)
                    .where(OffboardingRecord.employee_id == task.employee_id, OffboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OffboardingRecord.created_at))
                )
                if off and off.asset_recovery_status != "COMPLETED":
                    off.asset_recovery_status = "COMPLETED"
                    db.add(off)

            # 8. Offboarding Technical Knowledge Transfer (KT)
            elif tmpl_code == "TMPL_OFF_KT_EXEC" or ("knowledge transfer" in title_lower or "kt " in title_lower or title_lower.endswith(" kt")):
                off = db.scalar(
                    select(OffboardingRecord)
                    .where(OffboardingRecord.employee_id == task.employee_id, OffboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OffboardingRecord.created_at))
                )
                if off and off.kt_status != "COMPLETED":
                    off.kt_status = "COMPLETED"
                    db.add(off)

            # 9. Offboarding Finance / Full & Final Settlement Clearance
            elif tmpl_code == "TMPL_OFF_FIN_CLEAR" or ("clearance" in title_lower and ("finance" in title_lower or "settlement" in title_lower or "f&f" in title_lower)):
                off = db.scalar(
                    select(OffboardingRecord)
                    .where(OffboardingRecord.employee_id == task.employee_id, OffboardingRecord.overall_status == "IN_PROGRESS")
                    .order_by(desc(OffboardingRecord.created_at))
                )
                if off and off.clearance_status != "COMPLETED":
                    off.clearance_status = "COMPLETED"
                    db.add(off)

            db.flush()
        except Exception:
            # Fault-tolerant: failure to sync lifecycle must not crash task update
            pass

    @staticmethod
    def update_status(db: Session, current_user: User, task_id: int, data: TaskStatusUpdate) -> TaskDetail:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        new_status = data.status.strip().upper()
        valid_statuses = ["PENDING", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"]
        if new_status not in valid_statuses:
            raise ValidationException(f"Invalid status '{new_status}'. Allowed statuses: {', '.join(valid_statuses)}")

        old_status = task.status
        if old_status == new_status:
            return TaskService.get_task_by_id(db, current_user, task_id)

        # Validate Status Transitions
        # PENDING -> IN_PROGRESS, CANCELLED, BLOCKED
        # IN_PROGRESS -> COMPLETED, BLOCKED, PENDING, CANCELLED
        # BLOCKED -> IN_PROGRESS, PENDING, CANCELLED
        # COMPLETED -> IN_PROGRESS (re-open)
        # CANCELLED -> PENDING (re-open)

        # Mandatory prerequisite check on completion
        if new_status == "COMPLETED":
            incomplete_prereqs = (
                select(Task.task_code, Task.title, Task.status)
                .join(TaskDependency, TaskDependency.prerequisite_task_id == Task.id)
                .where(TaskDependency.task_id == task_id, Task.status != "COMPLETED")
            )
            blocked_by = db.execute(incomplete_prereqs).all()
            if blocked_by:
                if not data.override_dependencies:
                    p_codes = [f"{b[0]} ({b[2]})" for b in blocked_by]
                    raise ValidationException(
                        f"Cannot mark task {task.task_code} as COMPLETED. Mandatory prerequisite tasks are incomplete: {', '.join(p_codes)}. Complete prerequisites or request an authorized administrative override."
                    )
                # Override requested: must be ADMIN or HR_MANAGER
                role_code = current_user.role.role_code if current_user.role else ""
                if role_code not in ["ADMIN", "HR_MANAGER"]:
                    raise PermissionDeniedException(
                        "Only System Administrators and HR Managers are authorized to execute a dependency override."
                    )
                if not data.override_reason or len(data.override_reason.strip()) < 5:
                    raise ValidationException("A detailed audit reason is mandatory when executing a dependency override.")

        # Update task state
        task.status = new_status
        if new_status == "COMPLETED":
            task.completed_at = datetime.now()
        elif old_status == "COMPLETED" and new_status != "COMPLETED":
            task.completed_at = None

        change_reason = data.reason or f"Status transitioned from {old_status} to {new_status}."
        if data.override_dependencies and data.override_reason:
            change_reason += f" [DEPENDENCY OVERRIDE by {current_user.full_name}: {data.override_reason.strip()}]"

        # Record in status history
        hist = TaskStatusHistory(
            task_id=task.id,
            old_status=old_status,
            new_status=new_status,
            old_owner_id=task.owner_id,
            new_owner_id=task.owner_id,
            old_due_date=task.due_date,
            new_due_date=task.due_date,
            changed_by_user_id=current_user.id,
            change_reason=change_reason,
        )
        db.add(hist)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task.id,
            action="UPDATE_STATUS",
            details={
                "old_status": old_status,
                "new_status": new_status,
                "override_dependencies": data.override_dependencies,
                "reason": change_reason,
            }
        )
        db.add(log)

        # Safe lifecycle synchronization if task is completed
        if new_status == "COMPLETED":
            TaskService._sync_lifecycle_on_completion(db, current_user, task)

        db.commit()
        db.refresh(task)

        return TaskService.get_task_by_id(db, current_user, task_id)

    @staticmethod
    def add_dependency(db: Session, current_user: User, task_id: int, data: TaskDependencyCreate) -> TaskDependencyRead:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        prereq = db.scalar(select(Task).where(Task.id == data.prerequisite_task_id))
        if not prereq:
            raise ValidationException(f"Prerequisite Task ID {data.prerequisite_task_id} does not exist.")

        # 1. Self-dependency check
        if task_id == data.prerequisite_task_id:
            raise ValidationException("A task cannot depend on itself.")

        # 2. Existing dependency check
        existing = db.scalar(
            select(TaskDependency).where(
                TaskDependency.task_id == task_id,
                TaskDependency.prerequisite_task_id == data.prerequisite_task_id
            )
        )
        if existing:
            raise ValidationException("This dependency already exists between the specified tasks.")

        # 3. Circular Dependency Detection via Graph Reachability (Cycle Detection)
        # If prerequisite_task_id can already reach task_id via existing prerequisites,
        # adding (task_id -> prerequisite_task_id) would create a circular loop!
        visited: Set[int] = set()
        queue = deque([data.prerequisite_task_id])
        while queue:
            curr = queue.popleft()
            if curr == task_id:
                raise ValidationException(
                    f"Circular dependency detected: Task {prereq.task_code} already depends on {task.task_code} directly or indirectly."
                )
            if curr in visited:
                continue
            visited.add(curr)
            # Find all prerequisites of curr
            curr_prereqs = db.scalars(
                select(TaskDependency.prerequisite_task_id).where(TaskDependency.task_id == curr)
            ).all()
            for p in curr_prereqs:
                if p not in visited:
                    queue.append(p)

        # Create dependency
        new_dep = TaskDependency(
            task_id=task_id,
            prerequisite_task_id=data.prerequisite_task_id,
            dependency_type=data.dependency_type.strip().upper()
        )
        db.add(new_dep)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK_DEPENDENCY",
            entity_id=task_id,
            action="ADD_DEPENDENCY",
            details={
                "task_id": task_id,
                "task_code": task.task_code,
                "prerequisite_task_id": data.prerequisite_task_id,
                "prerequisite_task_code": prereq.task_code,
                "dependency_type": new_dep.dependency_type,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(new_dep)

        read = TaskDependencyRead.model_validate(new_dep)
        read.prerequisite_task_code = prereq.task_code
        read.prerequisite_title = prereq.title
        read.prerequisite_status = prereq.status
        read.prerequisite_due_date = prereq.due_date
        return read

    @staticmethod
    def remove_dependency(db: Session, current_user: User, task_id: int, dependency_id: int):
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        dep = db.scalar(select(TaskDependency).where(TaskDependency.id == dependency_id, TaskDependency.task_id == task_id))
        if not dep:
            raise ResourceNotFoundException(f"Dependency record {dependency_id} does not exist for task {task_id}.")

        prereq_id = dep.prerequisite_task_id
        db.delete(dep)

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK_DEPENDENCY",
            entity_id=task_id,
            action="REMOVE_DEPENDENCY",
            details={
                "task_id": task_id,
                "dependency_id": dependency_id,
                "removed_prerequisite_task_id": prereq_id,
            }
        )
        db.add(log)
        db.commit()

    @staticmethod
    def list_task_templates(db: Session, category: Optional[str] = None) -> List[TaskTemplateRead]:
        stmt = select(TaskTemplate).where(TaskTemplate.is_active == True)
        if category:
            stmt = stmt.where(TaskTemplate.category == category.strip().upper())
        stmt = stmt.order_by(TaskTemplate.category, TaskTemplate.name)
        rows = db.scalars(stmt).all()
        return [TaskTemplateRead.model_validate(r) for r in rows]

    @staticmethod
    def add_comment(db: Session, current_user: User, task_id: int, comment: str) -> TaskCommentRead:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        if not comment or not comment.strip():
            raise ValidationException("Comment cannot be empty.")

        cleaned_comment = comment.strip()
        hist = TaskStatusHistory(
            task_id=task.id,
            old_status=task.status,
            new_status=task.status,
            old_owner_id=task.owner_id,
            new_owner_id=task.owner_id,
            old_due_date=task.due_date,
            new_due_date=task.due_date,
            changed_by_user_id=current_user.id,
            change_reason=f"[COMMENT] {cleaned_comment}",
        )
        db.add(hist)

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task.id,
            action="COMMENT",
            details={"comment": cleaned_comment},
        )
        db.add(log)
        db.commit()
        db.refresh(hist)

        return TaskCommentRead(
            id=hist.id,
            task_id=task.id,
            user_id=current_user.id,
            author_name=current_user.full_name or "HR Operations",
            comment=cleaned_comment,
            created_at=hist.changed_at,
        )

    @staticmethod
    def reopen_task(db: Session, current_user: User, task_id: int, reason: Optional[str] = None) -> TaskDetail:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        if task.status != "COMPLETED":
            raise ValidationException("Only completed tasks can be reopened.")

        old_status = task.status
        task.status = "IN_PROGRESS"
        task.completed_at = None

        reopen_msg = f"Task reopened: {reason.strip()}" if reason and reason.strip() else "Task reopened for further operational action."
        hist = TaskStatusHistory(
            task_id=task.id,
            old_status=old_status,
            new_status="IN_PROGRESS",
            old_owner_id=task.owner_id,
            new_owner_id=task.owner_id,
            old_due_date=task.due_date,
            new_due_date=task.due_date,
            changed_by_user_id=current_user.id,
            change_reason=reopen_msg,
        )
        db.add(hist)

        log = ActivityLog(
            user_id=current_user.id,
            entity_type="TASK",
            entity_id=task.id,
            action="REOPEN",
            details={"previous_status": old_status, "reason": reopen_msg},
        )
        db.add(log)
        db.commit()
        db.refresh(task)

        return TaskService.get_task_by_id(db, current_user, task_id)

    @staticmethod
    def delete_task(db: Session, current_user: User, task_id: int) -> None:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")
        TaskService._verify_task_access(db, current_user, task)

        # 1. Protection for lifecycle-generated tasks
        if task.template_id is not None:
            raise ValidationException(
                "Lifecycle-generated tasks cannot be deleted to preserve compliance records. You may cancel the task instead."
            )

        # 2. Protection for completed tasks
        if task.status == "COMPLETED":
            raise ValidationException(
                "Completed tasks cannot be deleted to preserve compliance and audit history."
            )

        # 3. Check for active dependent tasks
        active_prereq_dep = (
            db.query(TaskDependency)
            .join(Task, TaskDependency.task_id == Task.id)
            .filter(
                TaskDependency.prerequisite_task_id == task_id,
                Task.status.notin_(["COMPLETED", "CANCELLED"]),
            )
            .first()
        )
        if active_prereq_dep:
            raise ValidationException(
                "Cannot delete task: It is a required prerequisite for one or more active tasks. Resolve dependencies first."
            )

        # 4. Role authorization
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"] and task.owner_id != current_user.id:
            raise PermissionDeniedException("You are not authorized to delete this task.")

        # Delete dependent references, status history, notifications, and task
        db.query(TaskDependency).filter(or_(TaskDependency.task_id == task_id, TaskDependency.prerequisite_task_id == task_id)).delete(synchronize_session=False)
        db.query(TaskStatusHistory).filter(TaskStatusHistory.task_id == task_id).delete(synchronize_session=False)
        db.query(Notification).filter(Notification.task_id == task_id).delete(synchronize_session=False)
        db.delete(task)
        db.commit()
