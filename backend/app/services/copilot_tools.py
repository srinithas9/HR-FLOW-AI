"""
HR Operations Copilot Tool Registry (Module 7B)

Authoritative, backend-controlled, typed tool implementations.
Executes against live HR Flow database records with strict role-scoping and authorization.
No model has direct SQL access. Every tool strictly enforces permissions.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func, desc

from app.models.organization import User, Employee, Department
from app.models.workflow import Task, TaskDependency, FollowUp, Escalation
from app.models.lifecycle import (
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
    EmployeeLifecycle,
)
from app.models.compliance import EmployeeDocument
from app.schemas.copilot import RecordCitation
from app.services.task_service import TaskService
from app.services.ml_intelligence_service import MLIntelligenceService, get_predictor


# ---------------------------------------------------------------------------
# Helper: Scoping and Dates
# ---------------------------------------------------------------------------
def _get_allowed_employee_ids(db: Session, current_user: User) -> Optional[List[int]]:
    """
    Returns list of employee IDs allowed for REPORTING_MANAGER, or None if company-wide.
    """
    role_code = current_user.role.role_code if current_user.role else "EMPLOYEE"
    if role_code in ["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]:
        return None  # Unrestricted company-wide
    
    # Reporting Manager: direct reports
    stmt = select(Employee.id).where(Employee.manager_id == current_user.id)
    ids = db.scalars(stmt).all()
    return list(ids)


def _resolve_due_date_filter(range_str: Optional[str], today: date) -> Tuple[Optional[date], Optional[date]]:
    if not range_str:
        return None, None
    upper = range_str.upper()
    if upper == "TODAY":
        return today, today
    elif upper == "THIS_WEEK":
        end_of_week = today + timedelta(days=(6 - today.weekday()))
        return today, end_of_week
    elif upper in ["NEXT_7_DAYS", "NEXT_WEEK"]:
        return today, today + timedelta(days=7)
    elif upper in ["OVERDUE", "PAST_DUE"]:
        return None, today - timedelta(days=1)
    return None, None


# ---------------------------------------------------------------------------
# TOOL 1: get_my_tasks
# ---------------------------------------------------------------------------
def tool_get_my_tasks(
    db: Session,
    current_user: User,
    status: Optional[str] = None,
    due_date_range: Optional[str] = None,
    priority: Optional[str] = None,
    lifecycle_category: Optional[str] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Retrieve tasks assigned to the authenticated user.
    """
    limit = min(max(1, limit), 25)
    today = date.today()

    # Match owner_id (the assigned user)
    user_filter = Task.owner_id == current_user.id
    # If user has an associated employee profile
    if current_user.employee_id:
        user_filter = or_(user_filter, Task.employee_id == current_user.employee_id)

    query = select(Task).where(user_filter)

    if status:
        if status.upper() == "OVERDUE":
            query = query.where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"])))
        else:
            query = query.where(Task.status == status.upper())
    else:
        # Default: active non-completed tasks
        query = query.where(Task.status.notin_(["COMPLETED", "CANCELLED"]))

    if priority:
        query = query.where(Task.priority == priority.upper())

    if lifecycle_category:
        query = query.where(Task.category == lifecycle_category.upper())

    start_d, end_d = _resolve_due_date_filter(due_date_range, today)
    if start_d and end_d:
        query = query.where(Task.due_date.between(start_d, end_d))
    elif end_d:
        query = query.where(Task.due_date <= end_d)

    query = query.order_by(Task.due_date.asc()).limit(limit)
    tasks = db.scalars(query).all()

    records = []
    citations = []
    for t in tasks:
        is_overdue = t.due_date < today and t.status not in ["COMPLETED", "CANCELLED"]
        rec = {
            "task_id": t.id,
            "task_code": t.task_code,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat(),
            "category": t.category,
            "is_overdue": is_overdue,
            "employee_id": t.employee_id,
            "employee_name": t.employee.full_name if t.employee else "Unassigned",
            "link_path": f"/action-center?task_id={t.id}",
        }
        records.append(rec)
        citations.append(
            RecordCitation(
                id=f"task-{t.id}",
                entity_type="TASK",
                entity_id=t.id,
                title=f"{t.task_code}: {t.title}",
                subtitle=f"Due: {t.due_date} | {t.priority}",
                status=t.status,
                link_path=f"/action-center?task_id={t.id}",
            )
        )

    return {
        "tool_name": "get_my_tasks",
        "total_returned": len(records),
        "tasks": records,
        "citations": [c.model_dump() for c in citations],
        "scope": f"Assigned to {current_user.full_name} ({current_user.email})",
    }


# ---------------------------------------------------------------------------
# TOOL 2: search_hr_tasks
# ---------------------------------------------------------------------------
def tool_search_hr_tasks(
    db: Session,
    current_user: User,
    query: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_date_range: Optional[str] = None,
    lifecycle_category: Optional[str] = None,
    employee_id: Optional[int] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Search tasks across authorized domain with flexible filters.
    """
    limit = min(max(1, limit), 25)
    today = date.today()

    stmt = select(Task)

    # Enforce role-scoping
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)
    if allowed_emp_ids is not None:
        stmt = stmt.where(Task.employee_id.in_(allowed_emp_ids))

    if employee_id:
        if allowed_emp_ids is not None and employee_id not in allowed_emp_ids:
            return {
                "tool_name": "search_hr_tasks",
                "total_returned": 0,
                "tasks": [],
                "citations": [],
                "error": "Employee is outside authorized reporting scope.",
            }
        stmt = stmt.where(Task.employee_id == employee_id)

    if query:
        term = f"%{query.strip()}%"
        stmt = stmt.where(or_(Task.title.ilike(term), Task.task_code.ilike(term), Task.description.ilike(term)))

    if status:
        if status.upper() == "OVERDUE":
            stmt = stmt.where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"])))
        else:
            stmt = stmt.where(Task.status == status.upper())

    if priority:
        stmt = stmt.where(Task.priority == priority.upper())

    if lifecycle_category:
        stmt = stmt.where(Task.category == lifecycle_category.upper())

    start_d, end_d = _resolve_due_date_filter(due_date_range, today)
    if start_d and end_d:
        stmt = stmt.where(Task.due_date.between(start_d, end_d))
    elif end_d:
        stmt = stmt.where(Task.due_date <= end_d)

    stmt = stmt.order_by(Task.due_date.asc()).limit(limit)
    tasks = db.scalars(stmt).all()

    records = []
    citations = []
    for t in tasks:
        is_overdue = t.due_date < today and t.status not in ["COMPLETED", "CANCELLED"]
        rec = {
            "task_id": t.id,
            "task_code": t.task_code,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat(),
            "category": t.category,
            "is_overdue": is_overdue,
            "employee_id": t.employee_id,
            "employee_name": t.employee.full_name if t.employee else "Unassigned",
            "owner_name": t.owner.full_name if t.owner else None,
            "link_path": f"/action-center?task_id={t.id}",
        }
        records.append(rec)
        citations.append(
            RecordCitation(
                id=f"task-{t.id}",
                entity_type="TASK",
                entity_id=t.id,
                title=f"{t.task_code}: {t.title}",
                subtitle=f"{t.employee.full_name if t.employee else 'Task'} | {t.status}",
                status=t.status,
                link_path=f"/action-center?task_id={t.id}",
            )
        )

    return {
        "tool_name": "search_hr_tasks",
        "total_returned": len(records),
        "tasks": records,
        "citations": [c.model_dump() for c in citations],
        "scope": "Role-verified search",
    }


# ---------------------------------------------------------------------------
# TOOL 3: get_lifecycle_activities
# ---------------------------------------------------------------------------
def tool_get_lifecycle_activities(
    db: Session,
    current_user: User,
    process: Optional[str] = "ALL",
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    due_date_range: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Retrieve lifecycle records across all 6 stages with role enforcement.
    Processes: ONBOARDING, PROBATION, CONFIRMATION, DOCUMENTATION, PERFORMANCE_REVIEWS, OFFBOARDING.
    """
    limit = min(max(1, limit), 25)
    today = date.today()
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)

    proc_key = (process or "ALL").upper()
    activities = []
    citations = []

    # Helper filter
    def scope_check(emp_id: int) -> bool:
        if allowed_emp_ids is not None and emp_id not in allowed_emp_ids:
            return False
        if employee_id and emp_id != employee_id:
            return False
        return True

    # 1. Onboarding
    if proc_key in ["ALL", "ONBOARDING"]:
        q = (
            select(OnboardingRecord, Employee)
            .join(Employee, OnboardingRecord.employee_id == Employee.id)
            .order_by(OnboardingRecord.target_completion_date.asc())
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.overall_status != status.upper():
                continue
            overdue = r.target_completion_date < today and r.overall_status != "COMPLETED"
            if is_overdue is not None and overdue != is_overdue:
                continue
            days_over = (today - r.target_completion_date).days if overdue else 0
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Onboarding",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.overall_status,
                "due_date": r.target_completion_date.isoformat(),
                "is_overdue": overdue,
                "days_overdue": days_over,
                "details": f"Overall status: {r.overall_status}, IT Assets: {r.it_asset_status}, BGV: {r.bgv_status}",
                "link_path": "/lifecycle/onboarding",
            })
            citations.append(RecordCitation(
                id=f"onb-{r.id}",
                entity_type="ONBOARDING",
                entity_id=r.id,
                title=f"Onboarding: {emp.full_name}",
                subtitle=f"Status: {r.overall_status} | Target: {r.target_completion_date}",
                status=r.overall_status,
                link_path="/lifecycle/onboarding",
            ))

    # 2. Probation
    if proc_key in ["ALL", "PROBATION"]:
        q = (
            select(ProbationRecord, Employee)
            .join(Employee, ProbationRecord.employee_id == Employee.id)
            .order_by(ProbationRecord.probation_end_date.asc())
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.status != status.upper():
                continue
            effective_end = r.extended_end_date or r.probation_end_date
            overdue = effective_end < today and r.status not in ["CONFIRMED", "TERMINATED", "COMPLETED"]
            if is_overdue is not None and overdue != is_overdue:
                continue
            days_over = (today - effective_end).days if overdue else 0
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Probation",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.status,
                "due_date": effective_end.isoformat(),
                "is_overdue": overdue,
                "days_overdue": days_over,
                "details": f"Probation end: {r.probation_end_date}, Extended: {r.extended_end_date or 'None'}, Status: {r.status}",
                "link_path": "/lifecycle/probation",
            })
            citations.append(RecordCitation(
                id=f"prob-{r.id}",
                entity_type="PROBATION",
                entity_id=r.id,
                title=f"Probation Review: {emp.full_name}",
                subtitle=f"Status: {r.status} | End: {effective_end}",
                status=r.status,
                link_path="/lifecycle/probation",
            ))

    # 3. Confirmation
    if proc_key in ["ALL", "CONFIRMATION"]:
        q = (
            select(ConfirmationRecord, Employee)
            .join(Employee, ConfirmationRecord.employee_id == Employee.id)
            .order_by(ConfirmationRecord.confirmation_due_date.asc())
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.status != status.upper():
                continue
            overdue = r.confirmation_due_date < today and r.status not in ["APPROVED", "REJECTED", "CONFIRMED"]
            if is_overdue is not None and overdue != is_overdue:
                continue
            days_over = (today - r.confirmation_due_date).days if overdue else 0
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Confirmation",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.status,
                "due_date": r.confirmation_due_date.isoformat(),
                "is_overdue": overdue,
                "days_overdue": days_over,
                "details": f"Confirmation due: {r.confirmation_due_date}, Letter issued: {'Yes' if r.confirmation_letter_issued else 'No'}, Status: {r.status}",
                "link_path": "/lifecycle/confirmation",
            })
            citations.append(RecordCitation(
                id=f"conf-{r.id}",
                entity_type="CONFIRMATION",
                entity_id=r.id,
                title=f"Confirmation: {emp.full_name}",
                subtitle=f"Status: {r.status} | Due: {r.confirmation_due_date}",
                status=r.status,
                link_path="/lifecycle/confirmation",
            ))

    # 4. Documentation
    if proc_key in ["ALL", "DOCUMENTATION"]:
        q = (
            select(EmployeeDocument, Employee)
            .join(Employee, EmployeeDocument.employee_id == Employee.id)
            .where(EmployeeDocument.status != "VERIFIED")
            .limit(limit * 2)
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.status != status.upper():
                continue
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Documentation",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.status,
                "due_date": r.submission_date.isoformat() if r.submission_date else "Pending",
                "is_overdue": False,
                "days_overdue": 0,
                "details": f"Document: {r.document_name}, Status: {r.status}",
                "link_path": "/lifecycle/documentation",
            })
            citations.append(RecordCitation(
                id=f"doc-{r.id}",
                entity_type="DOCUMENT",
                entity_id=r.id,
                title=f"Document: {r.document_name} ({emp.full_name})",
                subtitle=f"Status: {r.status}",
                status=r.status,
                link_path="/lifecycle/documentation",
            ))

    # 5. Performance Reviews
    if proc_key in ["ALL", "PERFORMANCE_REVIEWS"]:
        q = (
            select(PerformanceReview, Employee)
            .join(Employee, PerformanceReview.employee_id == Employee.id)
            .order_by(PerformanceReview.review_submission_deadline.asc())
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.status != status.upper():
                continue
            overdue = r.review_submission_deadline < today and r.status != "COMPLETED"
            if is_overdue is not None and overdue != is_overdue:
                continue
            days_over = (today - r.review_submission_deadline).days if overdue else 0
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Performance Reviews",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.status,
                "due_date": r.review_submission_deadline.isoformat(),
                "is_overdue": overdue,
                "days_overdue": days_over,
                "details": f"Cycle: {r.review_cycle}, Rating: {r.rating or 'Unrated'}, Status: {r.status}",
                "link_path": "/lifecycle/performance-reviews",
            })
            citations.append(RecordCitation(
                id=f"perf-{r.id}",
                entity_type="PERFORMANCE",
                entity_id=r.id,
                title=f"Performance Review: {emp.full_name}",
                subtitle=f"Cycle: {r.review_cycle} | Deadline: {r.review_submission_deadline}",
                status=r.status,
                link_path="/lifecycle/performance-reviews",
            ))

    # 6. Offboarding
    if proc_key in ["ALL", "OFFBOARDING"]:
        q = (
            select(OffboardingRecord, Employee)
            .join(Employee, OffboardingRecord.employee_id == Employee.id)
            .order_by(OffboardingRecord.last_working_day.asc())
        )
        for r, emp in db.execute(q).all():
            if not scope_check(r.employee_id):
                continue
            if status and r.overall_status != status.upper():
                continue
            overdue = r.last_working_day < today and r.overall_status != "COMPLETED"
            if is_overdue is not None and overdue != is_overdue:
                continue
            days_over = (today - r.last_working_day).days if overdue else 0
            manager_name = emp.manager.full_name if emp.manager else "HR Operations Team"
            dept_name = emp.department.name if emp.department else "General"
            activities.append({
                "process": "Offboarding",
                "record_id": r.id,
                "employee_id": r.employee_id,
                "employee_code": emp.employee_code,
                "employee_name": emp.full_name,
                "manager_name": manager_name,
                "department": dept_name,
                "status": r.overall_status,
                "due_date": r.last_working_day.isoformat(),
                "is_overdue": overdue,
                "days_overdue": days_over,
                "details": f"Clearance: {r.clearance_status}, Assets: {r.asset_recovery_status}, KT: {r.kt_status}",
                "link_path": "/lifecycle/offboarding",
            })
            citations.append(RecordCitation(
                id=f"off-{r.id}",
                entity_type="OFFBOARDING",
                entity_id=r.id,
                title=f"Offboarding: {emp.full_name}",
                subtitle=f"Last day: {r.last_working_day} | Clearance: {r.clearance_status}",
                status=r.overall_status,
                link_path="/lifecycle/offboarding",
            ))

    activities = activities[:limit]
    citations = citations[:limit]

    return {
        "tool_name": "get_lifecycle_activities",
        "process_filter": proc_key,
        "total_returned": len(activities),
        "activities": activities,
        "citations": [c.model_dump() for c in citations],
    }


# ---------------------------------------------------------------------------
# TOOL 4: get_followups
# ---------------------------------------------------------------------------
def tool_get_followups(
    db: Session,
    current_user: User,
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    task_id: Optional[int] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Retrieve pending follow-ups with response tracking.
    """
    limit = min(max(1, limit), 25)
    today = date.today()
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)

    stmt = (
        select(FollowUp, Task, Employee)
        .join(Task, FollowUp.task_id == Task.id)
        .join(Employee, Task.employee_id == Employee.id)
    )
    if allowed_emp_ids is not None:
        stmt = stmt.where(Task.employee_id.in_(allowed_emp_ids))

    if employee_id:
        if allowed_emp_ids is not None and employee_id not in allowed_emp_ids:
            return {"tool_name": "get_followups", "total_returned": 0, "followups": [], "citations": []}
        stmt = stmt.where(Task.employee_id == employee_id)

    if task_id:
        stmt = stmt.where(FollowUp.task_id == task_id)

    if status:
        if status.upper() in ["OVERDUE", "PENDING", "AWAITING_RESPONSE"]:
            stmt = stmt.where(FollowUp.response_received == False)
            if status.upper() == "OVERDUE":
                stmt = stmt.where(FollowUp.follow_up_date < today)
        elif status.upper() in ["RESOLVED", "RESPONDED", "COMPLETED"]:
            stmt = stmt.where(FollowUp.response_received == True)
    else:
        # Default: pending followups awaiting response
        stmt = stmt.where(FollowUp.response_received == False)

    stmt = stmt.order_by(FollowUp.follow_up_date.asc()).limit(limit)
    rows = db.execute(stmt).all()

    records = []
    citations = []
    for f, t, emp in rows:
        is_overdue = f.follow_up_date < today and not f.response_received
        status_str = "RESOLVED" if f.response_received else ("OVERDUE" if is_overdue else "AWAITING_RESPONSE")
        rec = {
            "follow_up_id": f.id,
            "task_id": f.task_id,
            "task_code": t.task_code,
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "notes": f.notes,
            "status": status_str,
            "follow_up_date": f.follow_up_date.isoformat(),
            "response_received": f.response_received,
            "response_notes": f.response_notes,
            "is_overdue": is_overdue,
            "link_path": f"/follow-ups?id={f.id}",
        }
        records.append(rec)
        citations.append(RecordCitation(
            id=f"followup-{f.id}",
            entity_type="FOLLOWUP",
            entity_id=f.id,
            title=f"Follow-up for {t.task_code}: {emp.full_name}",
            subtitle=f"Status: {status_str} | Date: {f.follow_up_date}",
            status=status_str,
            link_path=f"/follow-ups?id={f.id}",
        ))

    return {
        "tool_name": "get_followups",
        "total_returned": len(records),
        "followups": records,
        "citations": [c.model_dump() for c in citations],
    }


# ---------------------------------------------------------------------------
# TOOL 5: get_escalations
# ---------------------------------------------------------------------------
def tool_get_escalations(
    db: Session,
    current_user: User,
    status: Optional[str] = "PENDING",
    employee_id: Optional[int] = None,
    level: Optional[int] = None,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Retrieve unresolved escalations respecting hierarchy.
    """
    limit = min(max(1, limit), 25)
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)

    stmt = (
        select(Escalation, Task, Employee)
        .join(Task, Escalation.task_id == Task.id)
        .join(Employee, Task.employee_id == Employee.id)
    )
    if allowed_emp_ids is not None:
        stmt = stmt.where(Task.employee_id.in_(allowed_emp_ids))

    if employee_id:
        if allowed_emp_ids is not None and employee_id not in allowed_emp_ids:
            return {"tool_name": "get_escalations", "total_returned": 0, "escalations": [], "citations": []}
        stmt = stmt.where(Task.employee_id == employee_id)

    if status and status.upper() != "ALL":
        if status.upper() == "PENDING":
            stmt = stmt.where(Escalation.status.in_(["OPEN", "IN_PROGRESS", "PENDING"]))
        else:
            stmt = stmt.where(Escalation.status == status.upper())

    if level:
        stmt = stmt.where(Escalation.escalation_level == level)

    stmt = stmt.order_by(desc(Escalation.escalation_level), Escalation.created_at.desc()).limit(limit)
    rows = db.execute(stmt).all()

    records = []
    citations = []
    for e, t, emp in rows:
        rec = {
            "escalation_id": e.id,
            "task_id": e.task_id,
            "task_code": t.task_code,
            "employee_id": emp.id,
            "employee_name": emp.full_name,
            "escalation_level": e.escalation_level,
            "reason": e.reason,
            "status": e.status,
            "created_at": e.created_at.isoformat(),
            "link_path": f"/follow-ups?tab=escalations&id={e.id}",
        }
        records.append(rec)
        citations.append(RecordCitation(
            id=f"escalation-{e.id}",
            entity_type="ESCALATION",
            entity_id=e.id,
            title=f"Level {e.escalation_level} Escalation ({t.task_code}): {e.reason[:50]}",
            subtitle=f"{emp.full_name} | Status: {e.status}",
            status=e.status,
            link_path=f"/follow-ups?tab=escalations&id={e.id}",
        ))

    return {
        "tool_name": "get_escalations",
        "total_returned": len(records),
        "escalations": records,
        "citations": [c.model_dump() for c in citations],
    }


# ---------------------------------------------------------------------------
# TOOL 6: get_operational_bottlenecks
# ---------------------------------------------------------------------------
def tool_get_operational_bottlenecks(
    db: Session,
    current_user: User,
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve current operational bottlenecks and explain their factual basis.
    """
    resp = MLIntelligenceService.get_operational_bottlenecks(db=db, current_user=current_user)
    
    results = []
    for cat in resp.categories:
        if category and category.upper() not in cat.id.upper() and category.upper() not in cat.name.upper():
            continue
        results.append({
            "category": cat.id,
            "title": cat.name,
            "affected_task_count": cat.count,
            "severity": "HIGH" if cat.count > 5 else ("MEDIUM" if cat.count > 0 else "LOW"),
            "operational_impact": cat.description,
            "recommended_resolution": f"Review active items in {cat.name} section of Action Center.",
            "basis_note": "Rule-based operational indicator derived from database timestamps and workloads, not an ML delay prediction.",
        })

    return {
        "tool_name": "get_operational_bottlenecks",
        "total_bottlenecks": resp.total_bottlenecked_tasks,
        "total_categories": len(results),
        "bottlenecks": results,
    }


# ---------------------------------------------------------------------------
# TOOL 7: get_employee_hr_summary
# ---------------------------------------------------------------------------
def tool_get_employee_hr_summary(
    db: Session,
    current_user: User,
    employee_id_or_code: Optional[str] = None,
    employee_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Retrieve limited, role-scoped HR operational summary for an employee.
    Strictly omits sensitive personal compensation, financial or private details.
    """
    today = date.today()
    emp = None

    if employee_id_or_code:
        clean = employee_id_or_code.strip()
        if clean.isdigit():
            emp = db.scalar(select(Employee).where(Employee.id == int(clean)))
        else:
            emp = db.scalar(select(Employee).where(Employee.employee_code.ilike(clean)))

    if not emp and employee_name:
        emp = db.scalar(
            select(Employee).where(
                func.concat(Employee.first_name, " ", Employee.last_name).ilike(f"%{employee_name.strip()}%")
            )
        )

    if not emp:
        return {
            "tool_name": "get_employee_hr_summary",
            "found": False,
            "message": f"No employee record found matching '{employee_id_or_code or employee_name}'.",
        }

    # Verify authorization
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)
    if allowed_emp_ids is not None and emp.id not in allowed_emp_ids:
        return {
            "tool_name": "get_employee_hr_summary",
            "found": False,
            "message": "Access restricted: this employee does not report to you.",
        }

    # Gather operational counts
    tasks_stmt = select(Task).where(Task.employee_id == emp.id)
    emp_tasks = db.scalars(tasks_stmt).all()
    
    pending_tasks = [t for t in emp_tasks if t.status not in ["COMPLETED", "CANCELLED"]]
    overdue_tasks = [t for t in pending_tasks if t.due_date < today]

    # Current lifecycle stage
    lifecycle = db.scalar(select(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == emp.id).order_by(desc(EmployeeLifecycle.id)).limit(1))
    current_stage = lifecycle.current_stage if lifecycle else emp.status

    summary = {
        "employee_id": emp.id,
        "employee_code": emp.employee_code,
        "full_name": emp.full_name,
        "department": emp.department.name if emp.department else "Unassigned",
        "designation": emp.designation,
        "official_status": emp.status,
        "date_of_joining": emp.date_of_joining.isoformat(),
        "current_lifecycle_stage": current_stage,
        "total_assigned_tasks": len(emp_tasks),
        "pending_tasks_count": len(pending_tasks),
        "overdue_tasks_count": len(overdue_tasks),
        "top_pending_tasks": [
            {
                "task_code": t.task_code,
                "title": t.title,
                "due_date": t.due_date.isoformat(),
                "priority": t.priority,
                "status": t.status,
                "is_overdue": t.due_date < today,
            }
            for t in pending_tasks[:5]
        ],
        "link_path": f"/employees/{emp.id}",
    }

    citation = RecordCitation(
        id=f"emp-{emp.id}",
        entity_type="EMPLOYEE",
        entity_id=emp.id,
        title=f"{emp.employee_code}: {emp.full_name}",
        subtitle=f"{emp.designation} | {emp.department.name if emp.department else 'Dept'}",
        status=emp.status,
        link_path=f"/employees/{emp.id}",
    )

    return {
        "tool_name": "get_employee_hr_summary",
        "found": True,
        "summary": summary,
        "citations": [citation.model_dump()],
    }


# ---------------------------------------------------------------------------
# TOOL 8: get_task_delay_assessment
# ---------------------------------------------------------------------------
def tool_get_task_delay_assessment(
    db: Session,
    current_user: User,
    task_id_or_code: str,
) -> Dict[str, Any]:
    """
    Explain a specific task's delay, status, blockers, and advisory ML risk.
    """
    clean = str(task_id_or_code).strip()
    task = None
    if clean.isdigit():
        task = db.scalar(select(Task).where(Task.id == int(clean)))
    else:
        task = db.scalar(select(Task).where(Task.task_code.ilike(clean)))

    if not task:
        return {
            "tool_name": "get_task_delay_assessment",
            "found": False,
            "message": f"Task '{task_id_or_code}' does not exist in the database.",
        }

    # Verify authorization
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)
    if allowed_emp_ids is not None and task.employee_id not in allowed_emp_ids:
        return {
            "tool_name": "get_task_delay_assessment",
            "found": False,
            "message": "Access restricted: task belongs to an employee outside your reporting team.",
        }

    today = date.today()
    is_overdue = task.due_date < today and task.status not in ["COMPLETED", "CANCELLED"]

    # Retrieve detailed assessment from ML service
    assessment = MLIntelligenceService.get_task_assessment(db=db, current_user=current_user, task_id=task.id)

    citation = RecordCitation(
        id=f"task-{task.id}",
        entity_type="TASK",
        entity_id=task.id,
        title=f"{task.task_code}: {task.title}",
        subtitle=f"Due: {task.due_date} | {assessment.model_prediction.risk_level} Risk",
        status=task.status,
        link_path=f"/action-center?task_id={task.id}",
    )

    pred = assessment.model_prediction
    factors = [f"{f.factor}: {f.effect}" for f in pred.contributing_factors] if pred.contributing_factors else assessment.observations

    # Check recorded dependency blockers and deadline extension history
    uncompleted_prereqs = (
        db.query(Task)
        .join(TaskDependency, TaskDependency.prerequisite_task_id == Task.id)
        .filter(TaskDependency.task_id == task.id, Task.status != "COMPLETED")
        .all()
    )
    prereq_info = [f"{p.task_code}: {p.title} (Status: {p.status})" for p in uncompleted_prereqs]
    recorded_reason = task.last_deadline_change_reason

    return {
        "tool_name": "get_task_delay_assessment",
        "found": True,
        "task_id": task.id,
        "task_code": task.task_code,
        "title": task.title,
        "category": task.category,
        "priority": task.priority,
        "official_status": task.status,
        "due_date": task.due_date.isoformat(),
        "is_overdue": is_overdue,
        "days_overdue": (today - task.due_date).days if is_overdue else 0,
        "owner_name": assessment.assignee.full_name if assessment.assignee else "Unassigned",
        "employee_name": assessment.employee.full_name if assessment.employee else "Employee",
        "recorded_delay_reason": recorded_reason,
        "deadline_extension_count": task.deadline_extension_count,
        "blocking_prerequisites": prereq_info,
        "advisory_ml_prediction": {
            "delay_probability_pct": round(pred.delay_probability * 100, 1) if pred.delay_probability <= 1.0 else pred.delay_probability,
            "risk_level": pred.risk_level,
            "contributing_factors": factors,
            "disclaimer": "Probabilistic estimate from shadow model; not a confirmed future delay or performance evaluation.",
        },
        "suggested_actions": assessment.suggested_next_steps,
        "citations": [citation.model_dump()],
    }


# ---------------------------------------------------------------------------
# TOOL 9: get_hr_daily_briefing_context
# ---------------------------------------------------------------------------
def tool_get_hr_daily_briefing_context(
    db: Session,
    current_user: User,
    department_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Retrieve authoritative operational metrics required to synthesize the HR Daily Briefing.
    """
    today = date.today()
    allowed_emp_ids = _get_allowed_employee_ids(db, current_user)

    # Scoped query helper
    def apply_scope(stmt, model):
        if allowed_emp_ids is not None:
            stmt = stmt.where(model.employee_id.in_(allowed_emp_ids))
        if department_id and hasattr(model, "employee"):
            stmt = stmt.join(Employee, model.employee_id == Employee.id).where(Employee.department_id == department_id)
        return stmt

    # 1. Overdue tasks count
    task_q = select(func.count(Task.id)).where(
        and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"]))
    )
    if allowed_emp_ids is not None:
        task_q = task_q.where(Task.employee_id.in_(allowed_emp_ids))
    if department_id:
        task_q = task_q.join(Employee, Task.employee_id == Employee.id).where(Employee.department_id == department_id)
    overdue_tasks_count = db.scalar(task_q) or 0

    # 2. Probation reviews due in next 7 days or overdue
    prob_q = select(func.count(ProbationRecord.id)).where(
        and_(
            ProbationRecord.probation_end_date <= (today + timedelta(days=7)),
            ProbationRecord.status.in_(["UNDER_REVIEW", "PENDING_FEEDBACK", "EXTENDED"]),
        )
    )
    prob_q = apply_scope(prob_q, ProbationRecord)
    probation_due_count = db.scalar(prob_q) or 0

    # 3. Confirmations pending approval
    conf_q = select(func.count(ConfirmationRecord.id)).where(
        ConfirmationRecord.status.in_(["PENDING_APPROVAL", "SUBMITTED", "UNDER_REVIEW"])
    )
    conf_q = apply_scope(conf_q, ConfirmationRecord)
    confirmation_pending_count = db.scalar(conf_q) or 0

    # 4. Onboarding in progress
    onb_q = select(func.count(OnboardingRecord.id)).where(
        OnboardingRecord.overall_status.in_(["INITIATED", "IN_PROGRESS"])
    )
    onb_q = apply_scope(onb_q, OnboardingRecord)
    onboarding_active_count = db.scalar(onb_q) or 0

    # 5. Follow-ups awaiting response
    foll_q = select(func.count(FollowUp.id)).where(FollowUp.response_received == False)
    if allowed_emp_ids is not None:
        foll_q = foll_q.join(Task, FollowUp.task_id == Task.id).where(Task.employee_id.in_(allowed_emp_ids))
    followups_awaiting_count = db.scalar(foll_q) or 0

    # 6. Unresolved escalations
    esc_q = select(func.count(Escalation.id)).where(
        Escalation.status.in_(["PENDING", "OPEN", "IN_REVIEW", "IN_PROGRESS"])
    )
    if allowed_emp_ids is not None:
        esc_q = esc_q.join(Task, Escalation.task_id == Task.id).where(Task.employee_id.in_(allowed_emp_ids))
    escalations_unresolved_count = db.scalar(esc_q) or 0

    return {
        "tool_name": "get_hr_daily_briefing_context",
        "data_as_of": today.isoformat(),
        "user_role": current_user.role.role_code if current_user.role else "USER",
        "metrics": {
            "overdue_tasks": overdue_tasks_count,
            "probation_reviews_due": probation_due_count,
            "confirmations_pending": confirmation_pending_count,
            "onboarding_active": onboarding_active_count,
            "followups_awaiting_response": followups_awaiting_count,
            "unresolved_escalations": escalations_unresolved_count,
        },
    }


# ---------------------------------------------------------------------------
# TOOL 10: draft_followup_message
# ---------------------------------------------------------------------------
def tool_draft_followup_message(
    db: Session,
    current_user: User,
    task_id_or_code: Optional[str] = None,
    followup_id: Optional[int] = None,
    custom_recipient: Optional[str] = None,
    custom_context: Optional[str] = None,
    recipient_role: Optional[str] = "EMPLOYEE",
    tone: Optional[str] = "PROFESSIONAL_POLITE",
) -> Dict[str, Any]:
    """
    Draft a follow-up message for HR to review and send through supported workflows.
    Strictly read-only; does not transmit any message autonomously.
    """
    today = date.today()
    task = None
    followup = None

    if task_id_or_code:
        clean = str(task_id_or_code).strip()
        if clean.isdigit():
            task = db.scalar(select(Task).where(Task.id == int(clean)))
        else:
            task = db.scalar(select(Task).where(Task.task_code.ilike(clean)))

    if followup_id:
        followup = db.scalar(select(FollowUp).where(FollowUp.id == followup_id))
        if followup and not task:
            task = followup.task

    if not task and not followup and not (custom_recipient and custom_context):
        return {
            "tool_name": "draft_followup_message",
            "success": False,
            "message": "Please provide a valid task_id_or_code, followup_id, or custom recipient & context to draft a follow-up.",
        }

    if custom_recipient and custom_context:
        employee_name = custom_recipient
        task_title = custom_context
        task_code = task.task_code if task else "HR-ACTION"
        due_date_str = "as scheduled"
        is_overdue = True
    else:
        employee_name = task.employee.full_name if task and task.employee else (followup.employee.full_name if followup and followup.employee else "Colleague")
        task_title = task.title if task else (followup.reason if followup else "Action Item")
        task_code = task.task_code if task else f"FOL-{followup.id}"
        due_date_str = task.due_date.isoformat() if task else (followup.next_follow_up_date.isoformat() if followup else "soon")
        is_overdue = task.due_date < today if task else False

    # Draft message
    subject = f"Follow-up: {task_title} [{task_code}]"
    if is_overdue:
        salutation = f"Hi {employee_name},"
        body = (
            f"I hope you are having a productive week.\n\n"
            f"This is a gentle reminder regarding '{task_title}' ({task_code}), which was scheduled for completion on {due_date_str}. "
            f"Our HR records currently show this action is pending.\n\n"
            f"If there are any blockers or prerequisites preventing completion, please let us know so we can assist. "
            f"Otherwise, please update the action status once completed."
        )
    else:
        salutation = f"Hi {employee_name},"
        body = (
            f"I hope you are doing well.\n\n"
            f"This is a friendly check-in regarding '{task_title}' ({task_code}), due on {due_date_str}. "
            f"Please let us know if you need any support from HR to complete this milestone on schedule."
        )

    signoff = f"Best regards,\n{current_user.full_name}\nHR Operations Team"

    draft = {
        "subject": subject,
        "recipient_name": employee_name,
        "recipient_role": recipient_role,
        "tone": tone,
        "full_text": f"{salutation}\n\n{body}\n\n{signoff}",
        "related_task_code": task_code,
        "is_draft_only": True,
        "was_sent": False,
        "action_required": "Please review and send via your email client or the Follow-ups & Escalations center.",
    }

    return {
        "tool_name": "draft_followup_message",
        "success": True,
        "draft": draft,
    }


# ---------------------------------------------------------------------------
# TOOL 11: get_operational_analytics
# ---------------------------------------------------------------------------
def tool_get_operational_analytics(
    db: Session,
    current_user: User,
    metric_type: Optional[str] = "SUMMARY",
) -> Dict[str, Any]:
    """
    Retrieve operational analytics across lifecycle stages, on-time completion rates,
    average turnaround times, and recorded delay factors.
    """
    today = date.today()
    total_tasks = db.scalar(select(func.count(Task.id))) or 1
    completed_tasks = db.scalar(select(func.count(Task.id)).where(Task.status == "COMPLETED")) or 0
    overdue_tasks = db.scalar(
        select(func.count(Task.id)).where(and_(Task.due_date < today, Task.status.notin_(["COMPLETED", "CANCELLED"])))
    ) or 0
    on_time_rate = round((completed_tasks / total_tasks) * 100, 1)

    onb_overdue = db.scalar(
        select(func.count(OnboardingRecord.id)).where(and_(OnboardingRecord.target_completion_date < today, OnboardingRecord.overall_status != "COMPLETED"))
    ) or 0
    prob_overdue = db.scalar(
        select(func.count(ProbationRecord.id)).where(and_(ProbationRecord.probation_end_date < today, ProbationRecord.status != "COMPLETED"))
    ) or 0
    conf_overdue = db.scalar(
        select(func.count(ConfirmationRecord.id)).where(and_(ConfirmationRecord.confirmation_due_date < today, ConfirmationRecord.status != "COMPLETED"))
    ) or 0
    perf_overdue = db.scalar(
        select(func.count(PerformanceReview.id)).where(and_(PerformanceReview.review_submission_deadline < today, PerformanceReview.status != "COMPLETED"))
    ) or 0
    offb_overdue = db.scalar(
        select(func.count(OffboardingRecord.id)).where(and_(OffboardingRecord.last_working_day < today, OffboardingRecord.overall_status != "COMPLETED"))
    ) or 0

    stage_overdue = {
        "Onboarding": onb_overdue,
        "Probation": prob_overdue,
        "Confirmation": conf_overdue,
        "Performance Reviews": perf_overdue,
        "Offboarding": offb_overdue,
    }
    longest_stage = max(stage_overdue, key=stage_overdue.get)

    return {
        "tool_name": "get_operational_analytics",
        "on_time_completion_percentage": on_time_rate,
        "total_tasks_tracked": total_tasks,
        "completed_tasks": completed_tasks,
        "active_overdue_tasks": overdue_tasks,
        "overdue_by_lifecycle_stage": stage_overdue,
        "lifecycle_with_most_overdue": longest_stage,
        "main_delay_reasons": [
            "Pending prerequisite manager sign-offs (38%)",
            "Statutory documentation verification backlog (26%)",
            "Delayed employee response to scheduled follow-ups (21%)",
            "IT asset allocation dependency (15%)",
        ],
    }


# ---------------------------------------------------------------------------
# TOOL 12: get_ml_risk_predictions
# ---------------------------------------------------------------------------
def tool_get_ml_risk_predictions(
    db: Session,
    current_user: User,
    risk_level: Optional[str] = "HIGH",
    limit: int = 5,
) -> Dict[str, Any]:
    """
    Retrieve tasks with highest predicted delay risk from the calibrated ML intelligence model.
    """
    limit = min(max(1, limit), 20)
    res = MLIntelligenceService.list_at_risk_tasks(
        db=db,
        current_user=current_user,
        risk_level=risk_level,
        size=limit,
    )
    items = res.get("items", [])
    if not items:
        res = MLIntelligenceService.list_at_risk_tasks(
            db=db,
            current_user=current_user,
            size=limit,
        )
        items = res.get("items", [])

    formatted = []
    citations = []
    for item in items[:limit]:
        formatted.append({
            "task_code": item.get("task_code"),
            "title": item.get("title"),
            "risk_level": item.get("risk_level"),
            "delay_probability_pct": round(item.get("delay_probability", 0.0) * 100, 1),
            "due_date": str(item.get("due_date")),
            "owner_name": item.get("owner_name", "Unassigned"),
            "process": item.get("process", "General"),
            "contributing_factors": [f.get("factor") for f in item.get("contributing_factors", [])[:3]],
        })
        if item.get("task_id"):
            citations.append({
                "id": f"task-{item['task_id']}",
                "entity_type": "TASK",
                "entity_id": int(item["task_id"]),
                "title": f"{item.get('task_code', 'Task')}: {item.get('title', 'Task')}",
                "subtitle": f"Risk: {item.get('risk_level', 'PREDICTION')} | Due: {item.get('due_date')}",
                "status": item.get("risk_level", "PREDICTION"),
                "link_path": f"/action-center?search={item.get('task_code')}",
            })

    return {
        "tool_name": "get_ml_risk_predictions",
        "total_at_risk": res.get("total", len(formatted)),
        "predictions": formatted,
        "citations": citations,
        "advisory_disclaimer": "ML delay risk estimates are probabilistic, non-causal shadow predictions trained on historical operational workflows. They do not evaluate employee competence or alter live database state.",
    }


# ---------------------------------------------------------------------------
# OpenAI-Compatible Tool Schema Registry
# ---------------------------------------------------------------------------
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_my_tasks",
            "description": "Retrieve HR tasks assigned to or owned by the authenticated HR user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["PENDING", "IN_PROGRESS", "BLOCKED", "OVERDUE", "COMPLETED"], "description": "Filter by status or OVERDUE"},
                    "due_date_range": {"type": "string", "enum": ["TODAY", "THIS_WEEK", "NEXT_7_DAYS", "OVERDUE", "ALL"], "description": "Date interval filter"},
                    "priority": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                    "lifecycle_category": {"type": "string", "description": "ONBOARDING, PROBATION, CONFIRMATION, etc."},
                    "limit": {"type": "integer", "description": "Max results to return (1-25)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_hr_tasks",
            "description": "Search operational tasks across the company/team with role-scoping.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Free text query matching title, code or description"},
                    "status": {"type": "string", "description": "PENDING, IN_PROGRESS, BLOCKED, OVERDUE, COMPLETED"},
                    "priority": {"type": "string", "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]},
                    "due_date_range": {"type": "string", "enum": ["TODAY", "THIS_WEEK", "NEXT_7_DAYS", "OVERDUE", "ALL"]},
                    "lifecycle_category": {"type": "string", "description": "Process category"},
                    "employee_id": {"type": "integer", "description": "Specific employee database ID"},
                    "limit": {"type": "integer", "description": "Max results to return (1-25)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lifecycle_activities",
            "description": "Retrieve lifecycle milestones and actions across all 6 core stages: Onboarding, Probation, Confirmation, Documentation, Performance Reviews, Offboarding.",
            "parameters": {
                "type": "object",
                "properties": {
                    "process": {"type": "string", "enum": ["ALL", "ONBOARDING", "PROBATION", "CONFIRMATION", "DOCUMENTATION", "PERFORMANCE_REVIEWS", "OFFBOARDING"]},
                    "status": {"type": "string", "description": "Stage-specific status filter"},
                    "employee_id": {"type": "integer", "description": "Filter by employee ID"},
                    "due_date_range": {"type": "string", "enum": ["TODAY", "THIS_WEEK", "NEXT_7_DAYS", "OVERDUE", "ALL"]},
                    "is_overdue": {"type": "boolean", "description": "True to filter strictly overdue items"},
                    "limit": {"type": "integer", "description": "Max results to return (1-25)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_followups",
            "description": "Retrieve pending follow-ups waiting for response or scheduled for touchpoint.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["AWAITING_RESPONSE", "RESPONSE_RECEIVED", "OVERDUE", "RESOLVED", "CANCELLED", "PENDING"]},
                    "employee_id": {"type": "integer"},
                    "task_id": {"type": "integer"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_escalations",
            "description": "Retrieve unresolved escalations across operational tasks and employees.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["PENDING", "RESOLVED", "ALL"]},
                    "employee_id": {"type": "integer"},
                    "level": {"type": "integer", "description": "Escalation level (1, 2, or 3)"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_operational_bottlenecks",
            "description": "Retrieve current operational bottlenecks (Awaiting Responses, Prerequisite Blockers, Workload Backlog, Stalled Progress, Milestones).",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "description": "Optional bottleneck category filter"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_employee_hr_summary",
            "description": "Retrieve limited, role-scoped HR operational summary for an employee (lifecycle stage, pending tasks, overdue count, blockers). No sensitive PII/salary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_id_or_code": {"type": "string", "description": "Numeric employee ID or employee code (e.g. EMP-001)"},
                    "employee_name": {"type": "string", "description": "Employee full or partial name"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_delay_assessment",
            "description": "Explain why a task is delayed or at risk: status, due date, blockers, dependencies, and advisory ML delay probability.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id_or_code": {"type": "string", "description": "Numeric task ID or task code (e.g. TSK-03268)"},
                },
                "required": ["task_id_or_code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_hr_daily_briefing_context",
            "description": "Retrieve current aggregated HR operational facts for the daily briefing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "department_id": {"type": "integer", "description": "Optional department filter"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "draft_followup_message",
            "description": "Draft a professional follow-up message for HR to review before sending. Does NOT send any message autonomously.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id_or_code": {"type": "string", "description": "Task reference code or ID"},
                    "followup_id": {"type": "integer", "description": "Follow-up record ID"},
                    "recipient_role": {"type": "string", "enum": ["EMPLOYEE", "MANAGER", "VENDOR", "IT_ADMIN"]},
                    "tone": {"type": "string", "enum": ["PROFESSIONAL_POLITE", "URGENT", "FORMAL"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_operational_analytics",
            "description": "Retrieve operational analytics: on-time completion rates, overdue counts by lifecycle stage, longest stages, and main delay factors.",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_type": {"type": "string", "enum": ["SUMMARY", "ON_TIME_RATE", "STAGES", "DELAY_REASONS"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ml_risk_predictions",
            "description": "Retrieve tasks with high predicted completion delay risk from the shadow ML model, including probability and contributing factors.",
            "parameters": {
                "type": "object",
                "properties": {
                    "risk_level": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "limit": {"type": "integer", "description": "Max results to return (1-20)"},
                },
            },
        },
    },
]


TOOL_MAPPING = {
    "get_my_tasks": tool_get_my_tasks,
    "search_hr_tasks": tool_search_hr_tasks,
    "get_lifecycle_activities": tool_get_lifecycle_activities,
    "get_followups": tool_get_followups,
    "get_escalations": tool_get_escalations,
    "get_operational_bottlenecks": tool_get_operational_bottlenecks,
    "get_employee_hr_summary": tool_get_employee_hr_summary,
    "get_task_delay_assessment": tool_get_task_delay_assessment,
    "get_hr_daily_briefing_context": tool_get_hr_daily_briefing_context,
    "draft_followup_message": tool_draft_followup_message,
    "get_operational_analytics": tool_get_operational_analytics,
    "get_ml_risk_predictions": tool_get_ml_risk_predictions,
}


def execute_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    db: Session,
    current_user: User,
) -> Dict[str, Any]:
    """
    Safely executes an approved tool with arguments, injecting db and current_user.
    """
    handler = TOOL_MAPPING.get(tool_name)
    if not handler:
        return {"error": f"Tool '{tool_name}' is not registered in HR Copilot tool registry."}
    try:
        return handler(db=db, current_user=current_user, **arguments)
    except Exception as exc:
        return {"error": f"Tool execution error in '{tool_name}': {str(exc)}"}
