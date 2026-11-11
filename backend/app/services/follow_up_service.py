from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, and_, or_, func, desc
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
    FollowUp,
    Notification,
    Escalation,
    TaskStatusHistory,
)
from app.models.intelligence import ActivityLog
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.schemas.sla import (
    FollowUpRead,
    FollowUpCreate,
    FollowUpAcknowledge,
    FollowUpOverviewMetrics,
    EscalationRead,
    EscalationCreate,
    EscalationResolve,
    NotificationRead,
    ReminderTriggerResponse,
)


class FollowUpService:

    @staticmethod
    def _verify_reporting_manager_scope(db: Session, current_user: User, employee_id: int):
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            if employee_id not in rep_ids:
                raise PermissionDeniedException(
                    "Access denied: You are only authorized to access follow-ups for employees within your direct reporting hierarchy."
                )

    # ------------------------------------------------------------------------
    # 1. Follow-ups Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_follow_ups(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        task_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        target_user_id: Optional[int] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        view: Optional[str] = None,
        response_received: Optional[bool] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[FollowUpRead]:
        Initiator = aliased(User)
        InitiatorRole = aliased(Role)
        Target = aliased(User)
        TargetRole = aliased(Role)
        today = date.today()

        stmt = (
            select(
                FollowUp,
                Initiator.full_name.label("initiator_name"),
                InitiatorRole.role_name.label("initiator_role_name"),
                Target.full_name.label("target_name"),
                TargetRole.role_name.label("target_role_name"),
                Task.task_code,
                Task.title.label("task_title"),
                Task.category.label("task_category"),
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Employee.id.label("employee_id"),
                Department.name.label("department_name"),
            )
            .join(Task, FollowUp.task_id == Task.id)
            .join(Employee, Task.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .join(Initiator, FollowUp.initiator_user_id == Initiator.id)
            .outerjoin(InitiatorRole, Initiator.role_id == InitiatorRole.id)
            .join(Target, FollowUp.target_user_id == Target.id)
            .outerjoin(TargetRole, Target.role_id == TargetRole.id)
        )

        # Scoping for reporting managers
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(Task.employee_id.in_(rep_ids))

        # Primary View handling
        if view:
            v = view.strip().upper()
            if v == "AWAITING_RESPONSE":
                stmt = stmt.where(FollowUp.response_received == False)
            elif v == "OVERDUE":
                stmt = stmt.where(FollowUp.response_received == False, FollowUp.follow_up_date < today)
            elif v in ["RESPONSE_RECEIVED", "ACKNOWLEDGED"]:
                stmt = stmt.where(FollowUp.response_received == True)
            elif v == "COMPLETED":
                stmt = stmt.where(FollowUp.response_received == True)

        # Filters
        if task_id:
            stmt = stmt.where(FollowUp.task_id == task_id)
        if employee_id:
            FollowUpService._verify_reporting_manager_scope(db, current_user, employee_id)
            stmt = stmt.where(Task.employee_id == employee_id)
        if target_user_id:
            stmt = stmt.where(FollowUp.target_user_id == target_user_id)
        if category:
            stmt = stmt.where(func.upper(Task.category) == category.strip().upper())
        if response_received is not None:
            stmt = stmt.where(FollowUp.response_received == response_received)
        if status:
            st = status.strip().upper()
            if st in ["PENDING", "PENDING_ACKNOWLEDGEMENT", "PENDING_RESPONSE", "AWAITING_RESPONSE"]:
                stmt = stmt.where(FollowUp.response_received == False)
            elif st in ["RESPONSE_RECEIVED", "ACKNOWLEDGED"]:
                stmt = stmt.where(FollowUp.response_received == True)
            elif st == "COMPLETED":
                stmt = stmt.where(FollowUp.response_received == True)
            elif st == "CANCELLED":
                stmt = stmt.where(FollowUp.response_notes.ilike("%[CANCEL%"))
            elif st == "OVERDUE":
                stmt = stmt.where(FollowUp.response_received == False, FollowUp.follow_up_date < today)
        if date_from:
            stmt = stmt.where(FollowUp.follow_up_date >= date_from)
        if date_to:
            stmt = stmt.where(FollowUp.follow_up_date <= date_to)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Task.task_code).like(term),
                    func.lower(Task.title).like(term),
                    func.lower(FollowUp.notes).like(term),
                    func.lower(FollowUp.response_notes).like(term),
                    func.lower(Employee.first_name).like(term),
                    func.lower(Employee.last_name).like(term),
                    func.lower(Employee.employee_code).like(term),
                    func.lower(Target.full_name).like(term),
                    func.lower(Initiator.full_name).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(FollowUp.follow_up_date), desc(FollowUp.created_at)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for fu, init_name, init_role, target_name, target_role, t_code, t_title, t_cat, emp_name, emp_code, emp_id, dept_name in rows:
            r = FollowUpRead.model_validate(fu)
            r.initiator_name = init_name
            r.initiator_role_name = init_role
            r.target_name = target_name
            r.target_role_name = target_role
            r.task_code = t_code
            r.task_title = t_title
            r.category = t_cat
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.employee_id = emp_id
            r.department_name = dept_name
            r.status = "ACKNOWLEDGED" if fu.response_received else "PENDING_ACKNOWLEDGEMENT"
            r.is_overdue = not fu.response_received and fu.follow_up_date < today
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def schedule_follow_up(db: Session, current_user: User, data: FollowUpCreate) -> FollowUpRead:
        task = db.scalar(select(Task).where(Task.id == data.task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {data.task_id} does not exist.")
        FollowUpService._verify_reporting_manager_scope(db, current_user, task.employee_id)

        target_user_id = data.target_user_id or task.owner_id
        target_user = db.scalar(select(User).where(User.id == target_user_id))
        if not target_user:
            raise ValidationException(f"Target User ID {target_user_id} does not exist.")

        new_fu = FollowUp(
            task_id=data.task_id,
            initiator_user_id=current_user.id,
            target_user_id=target_user_id,
            follow_up_date=data.follow_up_date,
            notes=data.notes.strip(),
            response_received=False,
            response_notes=None,
        )
        db.add(new_fu)
        db.flush()

        # Send notification to target owner
        emp = db.scalar(select(Employee).where(Employee.id == task.employee_id))
        emp_name = f"{emp.first_name} {emp.last_name}" if emp else "Employee"
        notif = Notification(
            user_id=target_user_id,
            task_id=task.id,
            title=f"Follow-up: {task.title}",
            message=f"{current_user.full_name} scheduled a follow-up for task {task.task_code} on {data.follow_up_date}: '{data.notes.strip()}'",
            notification_type="FOLLOW_UP",
        )
        db.add(notif)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="FOLLOW_UP",
            entity_id=new_fu.id,
            action="SCHEDULE",
            details={
                "task_id": task.id,
                "task_code": task.task_code,
                "target_user_id": target_user_id,
                "follow_up_date": str(data.follow_up_date),
                "notes": data.notes.strip(),
            }
        )
        db.add(log)
        db.commit()
        db.refresh(new_fu)

        read = FollowUpRead.model_validate(new_fu)
        read.initiator_name = current_user.full_name
        read.target_name = target_user.full_name
        read.task_code = task.task_code
        read.task_title = task.title
        read.employee_name = emp_name
        read.status = "PENDING_ACKNOWLEDGEMENT"
        read.is_overdue = new_fu.follow_up_date < date.today()
        return read

    @staticmethod
    def acknowledge_follow_up(db: Session, current_user: User, follow_up_id: int, data: FollowUpAcknowledge) -> FollowUpRead:
        fu = db.scalar(select(FollowUp).where(FollowUp.id == follow_up_id))
        if not fu:
            raise ResourceNotFoundException(f"Follow-up with ID {follow_up_id} does not exist.")

        task = db.scalar(select(Task).where(Task.id == fu.task_id))
        if task:
            FollowUpService._verify_reporting_manager_scope(db, current_user, task.employee_id)

        action = data.action.strip().upper()
        if action not in ["ACKNOWLEDGE", "RESCHEDULE", "CANCEL", "COMPLETE"]:
            raise ValidationException("Action must be one of: ACKNOWLEDGE, RESCHEDULE, CANCEL, COMPLETE.")

        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        audit_note = f"[{action} by {current_user.full_name} at {timestamp_str}]: {data.response_notes.strip()}"

        if action == "RESCHEDULE":
            if not data.rescheduled_date:
                raise ValidationException("Rescheduled date is mandatory when rescheduling a follow-up.")
            fu.follow_up_date = data.rescheduled_date
            fu.response_received = False
            fu.response_notes = (fu.response_notes + "\n" if fu.response_notes else "") + audit_note
        elif action in ["ACKNOWLEDGE", "COMPLETE"]:
            fu.response_received = True
            fu.response_notes = (fu.response_notes + "\n" if fu.response_notes else "") + audit_note
        elif action == "CANCEL":
            fu.response_received = True
            fu.response_notes = (fu.response_notes + "\n" if fu.response_notes else "") + audit_note

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="FOLLOW_UP",
            entity_id=fu.id,
            action=action,
            details={
                "action": action,
                "response_notes": data.response_notes.strip(),
                "rescheduled_date": str(data.rescheduled_date) if data.rescheduled_date else None,
            }
        )
        db.add(log)
        db.commit()
        db.refresh(fu)

        # Retrieve joined details safely with outer joins
        stmt = (
            select(
                FollowUp,
                User.full_name.label("initiator_name"),
                Task.task_code,
                Task.title.label("task_title"),
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
            )
            .outerjoin(User, FollowUp.initiator_user_id == User.id)
            .outerjoin(Task, FollowUp.task_id == Task.id)
            .outerjoin(Employee, Task.employee_id == Employee.id)
            .where(FollowUp.id == fu.id)
        )
        row = db.execute(stmt).first()
        read = FollowUpRead.model_validate(fu)
        if row:
            read.initiator_name = row[1]
            read.task_code = row[2]
            read.task_title = row[3]
            read.employee_name = row[4]
        read.target_name = current_user.full_name
        read.status = action if action in ["RESCHEDULED", "CANCELLED", "COMPLETED"] else ("ACKNOWLEDGED" if fu.response_received else "PENDING_ACKNOWLEDGEMENT")
        read.is_overdue = not fu.response_received and fu.follow_up_date < date.today()
        return read

    # ------------------------------------------------------------------------
    # 2. Escalations Management
    # ------------------------------------------------------------------------
    @staticmethod
    def list_escalations(
        db: Session,
        current_user: User,
        page: int = 1,
        size: int = 20,
        task_id: Optional[int] = None,
        employee_id: Optional[int] = None,
        escalated_to_user_id: Optional[int] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        level: Optional[int] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[EscalationRead]:
        EscBy = aliased(User)
        EscTo = aliased(User)
        EscToRole = aliased(Role)

        stmt = (
            select(
                Escalation,
                EscBy.full_name.label("escalated_by_name"),
                EscTo.full_name.label("escalated_to_name"),
                EscToRole.role_name.label("escalated_to_role_name"),
                Task.task_code,
                Task.title.label("task_title"),
                Task.category.label("task_category"),
                func.concat(Employee.first_name, " ", Employee.last_name).label("employee_name"),
                Employee.employee_code,
                Employee.id.label("employee_id"),
                Department.name.label("department_name"),
            )
            .join(Task, Escalation.task_id == Task.id)
            .join(Employee, Task.employee_id == Employee.id)
            .outerjoin(Department, Employee.department_id == Department.id)
            .join(EscBy, Escalation.escalated_by_user_id == EscBy.id)
            .join(EscTo, Escalation.escalated_to_user_id == EscTo.id)
            .outerjoin(EscToRole, EscTo.role_id == EscToRole.id)
        )

        role_code = current_user.role.role_code if current_user.role else ""
        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            stmt = stmt.where(Task.employee_id.in_(rep_ids))

        if task_id:
            stmt = stmt.where(Escalation.task_id == task_id)
        if employee_id:
            FollowUpService._verify_reporting_manager_scope(db, current_user, employee_id)
            stmt = stmt.where(Task.employee_id == employee_id)
        if escalated_to_user_id:
            stmt = stmt.where(Escalation.escalated_to_user_id == escalated_to_user_id)
        if status:
            stmt = stmt.where(Escalation.status == status.strip().upper())
        if category:
            stmt = stmt.where(func.upper(Task.category) == category.strip().upper())
        if level:
            stmt = stmt.where(Escalation.escalation_level == level)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(Task.task_code).like(term),
                    func.lower(Task.title).like(term),
                    func.lower(Escalation.reason).like(term),
                    func.lower(Escalation.resolution_notes).like(term),
                    func.lower(Employee.first_name).like(term),
                    func.lower(Employee.last_name).like(term),
                    func.lower(Employee.employee_code).like(term),
                    func.lower(EscBy.full_name).like(term),
                    func.lower(EscTo.full_name).like(term),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(Escalation.created_at)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for esc, by_name, to_name, to_role, t_code, t_title, t_cat, emp_name, emp_code, emp_id, dept_name in rows:
            r = EscalationRead.model_validate(esc)
            r.escalated_by_name = by_name
            r.escalated_to_name = to_name
            r.escalated_to_role_name = to_role
            r.task_code = t_code
            r.task_title = t_title
            r.category = t_cat
            r.employee_name = emp_name
            r.employee_code = emp_code
            r.employee_id = emp_id
            r.department_name = dept_name
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def create_escalation(db: Session, current_user: User, data: EscalationCreate) -> EscalationRead:
        task = db.scalar(select(Task).where(Task.id == data.task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {data.task_id} does not exist.")
        FollowUpService._verify_reporting_manager_scope(db, current_user, task.employee_id)

        target_user = db.scalar(select(User).where(User.id == data.escalated_to_user_id))
        if not target_user:
            raise ValidationException(f"Target User ID {data.escalated_to_user_id} does not exist.")

        # Duplicate Escalation Prevention:
        # Check if an OPEN escalation already exists for this task at this level
        existing_open = db.scalar(
            select(Escalation).where(
                Escalation.task_id == data.task_id,
                Escalation.escalation_level == data.escalation_level,
                Escalation.status == "OPEN",
            )
        )
        if existing_open:
            raise ValidationException(
                f"An active OPEN escalation already exists for task {task.task_code} at Level {data.escalation_level}. Please resolve or acknowledge the existing escalation before raising another."
            )

        new_esc = Escalation(
            task_id=data.task_id,
            escalated_by_user_id=current_user.id,
            escalated_to_user_id=data.escalated_to_user_id,
            escalation_level=data.escalation_level,
            reason=data.reason.strip(),
            status="OPEN",
        )
        db.add(new_esc)
        db.flush()

        # Send high priority notification
        notif = Notification(
            user_id=data.escalated_to_user_id,
            task_id=task.id,
            title=f"URGENT: Escalation (Level {data.escalation_level}) - {task.title}",
            message=f"{current_user.full_name} has escalated task {task.task_code}. Reason: {data.reason.strip()}",
            notification_type="ESCALATION",
        )
        db.add(notif)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="ESCALATION",
            entity_id=new_esc.id,
            action="CREATE",
            details={
                "task_id": task.id,
                "task_code": task.task_code,
                "escalated_to_user_id": data.escalated_to_user_id,
                "level": data.escalation_level,
                "reason": data.reason.strip(),
            }
        )
        db.add(log)
        db.commit()
        db.refresh(new_esc)

        read = EscalationRead.model_validate(new_esc)
        read.escalated_by_name = current_user.full_name
        read.escalated_to_name = target_user.full_name
        read.task_code = task.task_code
        read.task_title = task.title
        return read

    @staticmethod
    def resolve_escalation(db: Session, current_user: User, escalation_id: int, data: EscalationResolve) -> EscalationRead:
        esc = db.scalar(select(Escalation).where(Escalation.id == escalation_id))
        if not esc:
            raise ResourceNotFoundException(f"Escalation with ID {escalation_id} does not exist.")

        task = db.scalar(select(Task).where(Task.id == esc.task_id))
        if task:
            FollowUpService._verify_reporting_manager_scope(db, current_user, task.employee_id)

        # Authorization: Only ADMIN, HR_MANAGER, or the designated escalation recipient can resolve
        role_code = current_user.role.role_code if current_user.role else ""
        if role_code not in ["ADMIN", "HR_MANAGER"] and esc.escalated_to_user_id != current_user.id:
            raise PermissionDeniedException(
                "Access denied: Only System Administrators, HR Managers, or the assigned escalation recipient are authorized to resolve this escalation."
            )

        new_status = data.status.strip().upper()
        if new_status not in ["RESOLVED", "ACKNOWLEDGED"]:
            raise ValidationException("Status must be either RESOLVED or ACKNOWLEDGED.")

        esc.status = new_status
        esc.resolved_at = datetime.now()
        esc.resolution_notes = f"[{new_status} by {current_user.full_name}]: {data.resolution_notes.strip()}"

        # Notify initiator of escalation
        if esc.escalated_by_user_id != current_user.id and task:
            notif = Notification(
                user_id=esc.escalated_by_user_id,
                task_id=task.id,
                title=f"Escalation {new_status}: {task.title}",
                message=f"Escalation on task {task.task_code} was marked {new_status} by {current_user.full_name}: '{data.resolution_notes.strip()}'",
                notification_type="ESCALATION_RESOLVED",
            )
            db.add(notif)

        # Audit log
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="ESCALATION",
            entity_id=esc.id,
            action="RESOLVE",
            details={
                "status": new_status,
                "resolution_notes": data.resolution_notes.strip(),
            }
        )
        db.add(log)
        db.commit()
        db.refresh(esc)

        read = EscalationRead.model_validate(esc)
        if task:
            read.task_code = task.task_code
            read.task_title = task.title
        return read

    # ------------------------------------------------------------------------
    # 3. Notifications
    # ------------------------------------------------------------------------
    @staticmethod
    def list_notifications(
        db: Session,
        current_user: User,
        unread_only: bool = False,
        page: int = 1,
        size: int = 20,
    ) -> PaginatedResponse[NotificationRead]:
        stmt = (
            select(Notification, Task.task_code)
            .outerjoin(Task, Notification.task_id == Task.id)
            .where(Notification.user_id == current_user.id)
        )
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)

        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(desc(Notification.sent_at)).offset((page - 1) * size).limit(size)
        rows = db.execute(stmt).all()

        items = []
        for notif, t_code in rows:
            r = NotificationRead.model_validate(notif)
            r.task_code = t_code
            items.append(r)

        total_pages = (total + size - 1) // size if size > 0 else 1
        return PaginatedResponse(
            items=items,
            pagination=PaginationMeta(page=page, size=size, total=total, total_pages=total_pages)
        )

    @staticmethod
    def mark_notification_read(db: Session, current_user: User, notification_id: int) -> NotificationRead:
        notif = db.scalar(
            select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
        )
        if not notif:
            raise ResourceNotFoundException(f"Notification with ID {notification_id} not found.")

        notif.is_read = True
        notif.read_at = datetime.now()
        db.commit()
        db.refresh(notif)
        return NotificationRead.model_validate(notif)

    @staticmethod
    def mark_all_notifications_read(db: Session, current_user: User) -> int:
        now = datetime.now()
        stmt = (
            select(Notification)
            .where(Notification.user_id == current_user.id, Notification.is_read == False)
        )
        unread = db.scalars(stmt).all()
        count = len(unread)
        for n in unread:
            n.is_read = True
            n.read_at = now
        db.commit()
        return count

    # ------------------------------------------------------------------------
    # 4. Reminders & SLA Verification Engine
    # ------------------------------------------------------------------------
    @staticmethod
    def trigger_sla_reminders(db: Session, current_user: User) -> ReminderTriggerResponse:
        today = date.today()
        upcoming_threshold = today + timedelta(days=2)

        # Query all active tasks that are either overdue or due within 2 days
        stmt = (
            select(Task, User)
            .join(User, Task.owner_id == User.id)
            .where(
                Task.status.in_(["PENDING", "IN_PROGRESS", "BLOCKED"]),
                Task.due_date <= upcoming_threshold,
            )
        )
        tasks_and_owners = db.execute(stmt).all()
        scanned = len(tasks_and_owners)

        # Batch check today's existing SLA reminders to prevent duplicate spam
        today_start = datetime.combine(today, datetime.min.time())
        existing_reminder_task_ids = set(
            db.scalars(
                select(Notification.task_id)
                .where(
                    Notification.notification_type == "SLA_REMINDER",
                    Notification.sent_at >= today_start,
                )
            ).all()
        )

        notif_count = 0
        esc_count = 0

        for task, owner in tasks_and_owners:
            if task.id in existing_reminder_task_ids:
                continue

            days_diff = (task.due_date - today).days
            if days_diff < 0:
                title = f"OVERDUE Task Reminder: {task.title}"
                message = f"Task {task.task_code} is {abs(days_diff)} days overdue (Due Date: {task.due_date}). Immediate operational action is required."
            elif days_diff == 0:
                title = f"Due Today: {task.title}"
                message = f"Task {task.task_code} is due TODAY ({task.due_date}). Please finalize execution and update status."
            else:
                title = f"Upcoming Due Date: {task.title}"
                message = f"Task {task.task_code} is due in {days_diff} days ({task.due_date})."

            notif = Notification(
                user_id=owner.id,
                task_id=task.id,
                title=title,
                message=message,
                notification_type="SLA_REMINDER",
            )
            db.add(notif)
            notif_count += 1

        # Audit log for operational SLA scan
        log = ActivityLog(
            user_id=current_user.id,
            entity_type="SLA_ENGINE",
            entity_id=0,
            action="TRIGGER_REMINDERS",
            details={
                "tasks_scanned": scanned,
                "notifications_created": notif_count,
                "escalations_created": esc_count,
            }
        )
        db.add(log)
        db.commit()
        return ReminderTriggerResponse(
            tasks_scanned=scanned,
            notifications_created=notif_count,
            escalations_created=esc_count,
            summary=f"Scanned {scanned} active tasks. Dispatched {notif_count} SLA reminder notifications."
        )

    # ------------------------------------------------------------------------
    # 5. Operational Overview Metrics (Follow-ups & Escalations)
    # ------------------------------------------------------------------------
    @staticmethod
    def get_overview_metrics(db: Session, current_user: User) -> FollowUpOverviewMetrics:
        today = date.today()
        role_code = current_user.role.role_code if current_user.role else ""

        # Base FollowUp query
        fu_stmt = select(FollowUp).join(Task, FollowUp.task_id == Task.id)
        esc_stmt = select(Escalation).join(Task, Escalation.task_id == Task.id)

        if role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            fu_stmt = fu_stmt.where(Task.employee_id.in_(rep_ids))
            esc_stmt = esc_stmt.where(Task.employee_id.in_(rep_ids))

        # FollowUp counts
        all_fus = db.scalars(fu_stmt).all()
        total_fu = len(all_fus)
        awaiting_resp = sum(1 for f in all_fus if not f.response_received)
        overdue_fu = sum(1 for f in all_fus if not f.response_received and f.follow_up_date < today)
        resp_rec = sum(1 for f in all_fus if f.response_received)
        completed_fu = sum(1 for f in all_fus if f.response_received and (f.response_notes and "[COMPLETE" in f.response_notes))

        # Escalation counts
        all_escs = db.scalars(esc_stmt).all()
        total_esc = len(all_escs)
        open_esc = sum(1 for e in all_escs if e.status == "OPEN")
        ack_esc = sum(1 for e in all_escs if e.status == "ACKNOWLEDGED")
        res_esc = sum(1 for e in all_escs if e.status == "RESOLVED")

        return FollowUpOverviewMetrics(
            total_follow_ups=total_fu,
            awaiting_response=awaiting_resp,
            overdue=overdue_fu,
            response_received=resp_rec,
            completed=completed_fu,
            total_escalations=total_esc,
            open_escalations=open_esc,
            acknowledged_escalations=ack_esc,
            resolved_escalations=res_esc,
        )


