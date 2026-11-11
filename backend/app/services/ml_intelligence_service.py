from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any, Tuple
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_, desc, asc

from app.models.organization import User, Employee, Department, Role
from app.models.workflow import Task, TaskDependency, FollowUp, Escalation, Notification
from app.schemas.ml_intelligence import (
    TaskAssigneeInfo,
    TaskEmployeeInfo,
    PrerequisiteDetail,
    FollowUpDetail,
    EscalationDetail,
    WorkloadDetail,
    ContributingFactorInfo,
    ModelPredictionDetails,
    MLIntelligenceOverview,
    MLIntelligenceTaskItem,
    MLIntelligenceTaskAssessment,
    BottleneckCategorySummary,
    MLIntelligenceBottlenecksResponse,
)
from app.core.exceptions import ResourceNotFoundException, PermissionDeniedException
from app.core.permissions import get_reporting_employee_ids
from app.services.task_service import TaskService
import sys
from pathlib import Path

# Ensure root directory is in sys.path for ml package
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.predictor import TaskDelayRiskPredictor

_predictor_instance: Optional[TaskDelayRiskPredictor] = None


def get_predictor() -> TaskDelayRiskPredictor:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = TaskDelayRiskPredictor()
    return _predictor_instance


class MLIntelligenceService:
    """
    Certified ML Intelligence & Task Delay Risk Service.
    
    Provides real-time task delay risk prediction, verified operational evidence extraction,
    actionable HR attention classification, and bottleneck analytics across all active operations.
    """

    @staticmethod
    def _get_scoped_task_query(db: Session, current_user: User, department_id: Optional[int] = None):
        """
        Builds the base query for active tasks scoped strictly according to the user's role and hierarchy.
        """
        role_code = current_user.role.role_code if current_user.role else ""
        
        query = (
            db.query(Task, Employee, User, Department)
            .join(Employee, Employee.id == Task.employee_id)
            .join(User, User.id == Task.owner_id)
            .outerjoin(Department, Department.id == Employee.department_id)
            .filter(Task.status.in_(["PENDING", "IN_PROGRESS", "BLOCKED"]))
        )

        if department_id:
            query = query.filter(Employee.department_id == department_id)

        if role_code in ["ADMIN", "HR_MANAGER", "HR_EXECUTIVE"]:
            return query
        elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            rep_ids = get_reporting_employee_ids(db, current_user.employee_id)
            return query.filter(
                or_(
                    Task.owner_id == current_user.id,
                    Task.employee_id.in_(rep_ids)
                )
            )
        else:
            return query.filter(
                or_(
                    Task.owner_id == current_user.id,
                    Task.employee_id == current_user.employee_id
                )
            )

    @classmethod
    def _gather_task_metadata(cls, db: Session, task_rows: List[Any], today: date):
        """
        Batch-gathers workloads, historical delay rates, dependencies, follow-ups, and escalations.
        """
        if not task_rows:
            return {}, {}, {}, {}, {}, {}, {}, {}

        task_ids = [t[0].id for t in task_rows]
        owner_ids = list({t[0].owner_id for t in task_rows})

        # 1. Owner active workloads
        wl_rows = (
            db.query(Task.owner_id, func.count(Task.id))
            .filter(Task.owner_id.in_(owner_ids), Task.status.in_(["PENDING", "IN_PROGRESS", "BLOCKED"]))
            .group_by(Task.owner_id)
            .all()
        )
        workload_map = dict(wl_rows)

        # 2. Owner historical delay rates
        owner_past = (
            db.query(Task.owner_id, Task.due_date, Task.completed_at)
            .filter(Task.owner_id.in_(owner_ids), Task.completed_at.is_not(None))
            .all()
        )
        owner_hist = {}
        for oid in owner_ids:
            past_records = [x for x in owner_past if x[0] == oid]
            n = len(past_records)
            if n > 0:
                k = sum(1 for _, due, comp in past_records if comp.date() > due)
                owner_hist[oid] = round((k + 2.0) / (n + 10.0), 4)
            else:
                owner_hist[oid] = 0.20

        # 3. Dependencies
        dep_rows = (
            db.query(
                TaskDependency.task_id,
                TaskDependency.prerequisite_task_id,
                Task.task_code,
                Task.title,
                Task.status,
                User.full_name
            )
            .join(Task, Task.id == TaskDependency.prerequisite_task_id)
            .join(User, User.id == Task.owner_id)
            .filter(TaskDependency.task_id.in_(task_ids))
            .all()
        )
        all_deps: Dict[int, List[Dict[str, Any]]] = {}
        unmet_deps: Dict[int, List[Dict[str, Any]]] = {}
        for tid, pid, pcode, ptitle, pstatus, powner in dep_rows:
            item = {
                "id": pid,
                "task_code": pcode,
                "title": ptitle,
                "status": pstatus,
                "owner_name": powner
            }
            if tid not in all_deps:
                all_deps[tid] = []
            all_deps[tid].append(item)
            if pstatus != "COMPLETED":
                if tid not in unmet_deps:
                    unmet_deps[tid] = []
                unmet_deps[tid].append(item)

        # 4. Follow-ups
        fu_rows = (
            db.query(
                FollowUp.task_id,
                FollowUp.id,
                FollowUp.follow_up_date,
                FollowUp.notes,
                FollowUp.response_received,
                FollowUp.response_notes
            )
            .filter(FollowUp.task_id.in_(task_ids))
            .order_by(desc(FollowUp.created_at))
            .all()
        )
        all_fus: Dict[int, List[Dict[str, Any]]] = {}
        open_fus: Dict[int, List[Dict[str, Any]]] = {}
        for tid, fid, fdate, fnotes, rcvd, rnotes in fu_rows:
            fitem = {
                "id": fid,
                "follow_up_date": str(fdate),
                "notes": fnotes,
                "response_received": rcvd,
                "response_notes": rnotes
            }
            if tid not in all_fus:
                all_fus[tid] = []
            all_fus[tid].append(fitem)
            if not rcvd:
                if tid not in open_fus:
                    open_fus[tid] = []
                open_fus[tid].append(fitem)

        # 5. Escalations
        esc_rows = (
            db.query(
                Escalation.task_id,
                Escalation.id,
                Escalation.escalation_level,
                Escalation.reason,
                Escalation.status,
                User.full_name
            )
            .join(User, User.id == Escalation.escalated_to_user_id)
            .filter(Escalation.task_id.in_(task_ids))
            .order_by(desc(Escalation.created_at))
            .all()
        )
        all_escs: Dict[int, List[Dict[str, Any]]] = {}
        open_escs: Dict[int, List[Dict[str, Any]]] = {}
        for tid, eid, elevel, ereason, estatus, eto_name in esc_rows:
            eitem = {
                "id": eid,
                "escalation_level": elevel,
                "reason": ereason,
                "status": estatus,
                "escalated_to_name": eto_name
            }
            if tid not in all_escs:
                all_escs[tid] = []
            all_escs[tid].append(eitem)
            if estatus == "OPEN":
                if tid not in open_escs:
                    open_escs[tid] = []
                open_escs[tid].append(eitem)

        # 6. Reminders
        rem_rows = (
            db.query(Notification.task_id, func.count(Notification.id))
            .filter(
                Notification.task_id.in_(task_ids),
                Notification.notification_type.in_(["REMINDER", "SLA_REMINDER"])
            )
            .group_by(Notification.task_id)
            .all()
        )
        rem_map = dict(rem_rows)

        return workload_map, owner_hist, all_deps, unmet_deps, all_fus, open_fus, all_escs, open_escs, rem_map

    @classmethod
    def _evaluate_single_task(
        cls,
        task: Task,
        emp: Employee,
        owner: User,
        dept: Optional[Department],
        today: date,
        workload_map: Dict[int, int],
        owner_hist: Dict[int, float],
        all_deps: Dict[int, List[Any]],
        unmet_deps: Dict[int, List[Any]],
        all_fus: Dict[int, List[Any]],
        open_fus: Dict[int, List[Any]],
        all_escs: Dict[int, List[Any]],
        open_escs: Dict[int, List[Any]],
        rem_map: Dict[int, int],
        predictor: TaskDelayRiskPredictor,
        pred: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a single task, computing model risk, verified bottlenecks, attention priority, and concern text.
        """
        days_rem = (task.due_date - today).days
        is_overdue = days_rem < 0
        overdue_days = abs(days_rem) if is_overdue else 0

        unmet_list = unmet_deps.get(task.id, [])
        has_unmet_deps = len(unmet_list) > 0
        all_dep_list = all_deps.get(task.id, [])

        open_fu_list = open_fus.get(task.id, [])
        has_open_fu = len(open_fu_list) > 0

        open_esc_list = open_escs.get(task.id, [])
        has_open_esc = len(open_esc_list) > 0

        owner_wl = workload_map.get(task.owner_id, 1)
        owner_delay_rate = owner_hist.get(task.owner_id, 0.20)
        reminder_count = rem_map.get(task.id, 0)

        dep_status = "PENDING" if has_unmet_deps else ("NONE" if not all_dep_list else "ALL_MET")

        # 1. ML Model Prediction
        if pred is None:
            features = {
                "days_remaining": max(1, days_rem),
                "task_category": task.category or "ONBOARDING",
                "task_priority": task.priority or "MEDIUM",
                "current_status": task.status if task.status in ["IN_PROGRESS", "COMPLETED", "BLOCKED"] else "IN_PROGRESS",
                "reminder_count": reminder_count,
                "owner_previous_delay_rate": owner_delay_rate,
                "owner_current_workload": owner_wl,
                "dependency_status": dep_status
            }
            pred = predictor.predict(features)
        risk_tier = pred["risk_classification"]
        delay_prob = pred["delay_probability"]

        # 2. Verified Operational Bottlenecks
        bottlenecks = []
        if has_open_fu:
            bottlenecks.append("WAITING_RESPONSE")
        if has_unmet_deps:
            bottlenecks.append("PENDING_DEPENDENCY")
        if owner_wl >= 15:
            bottlenecks.append("WORKLOAD_PRESSURE")
        if has_open_esc or reminder_count >= 2:
            bottlenecks.append("REPEATED_REMINDERS")
        if task.status == "BLOCKED" or (task.status == "IN_PROGRESS" and overdue_days >= 3):
            bottlenecks.append("STALLED_PROGRESS")
        if task.category in ["ONBOARDING", "PROBATION", "CONFIRMATION", "OFFBOARDING"] and 0 <= days_rem <= 3:
            bottlenecks.append("LIFECYCLE_MILESTONE")

        # 3. Transparent HR Attention Priority Rules
        attention_rule = ""
        if overdue_days >= 3:
            priority = "CRITICAL"
            attention_rule = f"Task is overdue by {overdue_days} days."
        elif is_overdue and has_unmet_deps:
            priority = "CRITICAL"
            attention_rule = f"Task is overdue by {overdue_days} days and blocked by {len(unmet_list)} unfinished prerequisite task(s)."
        elif is_overdue and has_open_esc:
            priority = "CRITICAL"
            attention_rule = f"Task is overdue with an active open escalation."
        elif days_rem <= 2 and has_unmet_deps:
            priority = "CRITICAL"
            attention_rule = f"Deadline is in {days_rem} day(s) but prerequisite task is still incomplete."
        elif is_overdue:
            priority = "NEEDS_ATTENTION"
            attention_rule = f"Task is recently overdue by {overdue_days} day(s)."
        elif days_rem <= 5 and risk_tier == "HIGH":
            priority = "NEEDS_ATTENTION"
            attention_rule = f"High predicted delay risk ({round(delay_prob*100, 1)}%) with only {days_rem} day(s) remaining."
        elif has_open_esc:
            priority = "NEEDS_ATTENTION"
            attention_rule = "Task has an open escalation requiring management review."
        elif has_open_fu:
            priority = "NEEDS_ATTENTION"
            attention_rule = "Awaiting follow-up response from assignee or participant."
        elif risk_tier == "HIGH" and owner_wl >= 15:
            priority = "NEEDS_ATTENTION"
            attention_rule = f"High delay probability compounded by assignee workload backlog ({owner_wl} active tasks)."
        else:
            priority = "MONITOR"
            attention_rule = "Operating within acceptable progress buffer; maintain routine monitoring."

        # 4. Concise Main Concern Description
        if is_overdue and has_unmet_deps:
            main_concern = f"Overdue by {overdue_days}d; blocked by prerequisite '{unmet_list[0]['title'][:40]}...'"
        elif is_overdue:
            main_concern = f"Overdue by {overdue_days} day{'s' if overdue_days > 1 else ''} past target completion date."
        elif has_unmet_deps and days_rem <= 3:
            main_concern = f"Due in {days_rem}d; waiting on prerequisite '{unmet_list[0]['title'][:40]}...'"
        elif has_open_esc:
            main_concern = f"Active escalation flagged: {open_esc_list[0]['reason'][:60]}"
        elif has_open_fu:
            main_concern = f"Follow-up pending: '{open_fu_list[0]['notes'][:50]}...'"
        elif risk_tier == "HIGH":
            main_concern = f"High delay risk ({round(delay_prob*100, 1)}%) — deadline in {days_rem}d, assignee has {owner_wl} active tasks."
        elif owner_wl >= 15:
            main_concern = f"Assignee {owner.full_name} has high workload volume ({owner_wl} concurrent tasks)."
        else:
            main_concern = f"Standard progress: {days_rem} day{'s' if days_rem > 1 else ''} remaining."

        return {
            "task_id": task.id,
            "task_code": task.task_code,
            "title": task.title,
            "category": task.category,
            "priority": task.priority,
            "status": task.status,
            "due_date": str(task.due_date),
            "days_remaining": days_rem,
            "is_overdue": is_overdue,
            "overdue_days": overdue_days,
            "assignee": TaskAssigneeInfo(
                id=owner.id,
                full_name=owner.full_name,
                email=owner.email,
                role=owner.role.role_name if owner.role else None,
                department=dept.name if dept else None
            ),
            "employee": TaskEmployeeInfo(
                id=emp.id,
                full_name=f"{emp.first_name} {emp.last_name}",
                employee_code=emp.employee_code,
                department=dept.name if dept else None
            ) if emp else None,
            "delay_probability": delay_prob,
            "risk_level": risk_tier,
            "hr_attention_priority": priority,
            "hr_attention_rule": attention_rule,
            "main_concern": main_concern,
            "bottlenecks": bottlenecks,
            "active_blockers_count": len(unmet_list),
            "follow_ups_count": len(all_fus.get(task.id, [])),
            "escalations_count": len(all_escs.get(task.id, [])),
            "contributing_factors": pred.get("contributing_factors", []),
            "unmet_dependencies": unmet_list,
            "all_dependencies": all_dep_list,
            "open_follow_ups": open_fu_list,
            "all_follow_ups": all_fus.get(task.id, []),
            "open_escalations": open_esc_list,
            "all_escalations": all_escs.get(task.id, []),
            "owner_workload": owner_wl,
            "owner_delay_rate": owner_delay_rate,
            "model_version": pred.get("model_version", "v2.1.0-phase7a")
        }

    @classmethod
    def get_overview(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None
    ) -> MLIntelligenceOverview:
        """
        Computes high-level overview KPIs for the ML Intelligence dashboard.
        """
        today = date.today()
        predictor = get_predictor()
        rows = cls._get_scoped_task_query(db, current_user, department_id).all()

        if not rows:
            return MLIntelligenceOverview(
                high_risk_tasks=0,
                needs_attention=0,
                overdue_tasks=0,
                upcoming_at_risk_deadlines=0,
                total_active_tasks=0,
                last_updated=datetime.now(timezone.utc).isoformat()
            )

        meta = cls._gather_task_metadata(db, rows, today)
        (workload_map, owner_hist, all_deps, unmet_deps, all_fus, open_fus, all_escs, open_escs, rem_map) = meta

        high_risk_count = 0
        medium_risk_count = 0
        low_risk_count = 0
        needs_attention_count = 0
        overdue_count = 0
        upcoming_at_risk_count = 0

        # Batch predict for high performance
        feature_list = []
        for task, emp, owner, dept in rows:
            days_rem = (task.due_date - today).days
            unmet_list = unmet_deps.get(task.id, [])
            all_dep_list = all_deps.get(task.id, [])
            dep_status = "PENDING" if len(unmet_list) > 0 else ("NONE" if not all_dep_list else "ALL_MET")
            feature_list.append({
                "days_remaining": max(1, days_rem),
                "task_category": task.category or "ONBOARDING",
                "task_priority": task.priority or "MEDIUM",
                "current_status": task.status if task.status in ["IN_PROGRESS", "COMPLETED", "BLOCKED"] else "IN_PROGRESS",
                "reminder_count": rem_map.get(task.id, 0),
                "owner_previous_delay_rate": owner_hist.get(task.owner_id, 0.20),
                "owner_current_workload": workload_map.get(task.owner_id, 1),
                "dependency_status": dep_status
            })
        batch_preds = predictor.predict_batch(feature_list)

        for (task, emp, owner, dept), pred in zip(rows, batch_preds):
            eval_res = cls._evaluate_single_task(
                task, emp, owner, dept, today,
                workload_map, owner_hist, all_deps, unmet_deps,
                all_fus, open_fus, all_escs, open_escs, rem_map, predictor,
                pred=pred
            )
            if eval_res["risk_level"] == "HIGH":
                high_risk_count += 1
            elif eval_res["risk_level"] == "MEDIUM":
                medium_risk_count += 1
            elif eval_res["risk_level"] == "LOW":
                low_risk_count += 1

            if eval_res["hr_attention_priority"] in ["CRITICAL", "NEEDS_ATTENTION"]:
                needs_attention_count += 1
            if eval_res["is_overdue"]:
                overdue_count += 1
            if not eval_res["is_overdue"] and 0 <= eval_res["days_remaining"] <= 7 and eval_res["risk_level"] in ["HIGH", "MEDIUM"]:
                upcoming_at_risk_count += 1

        return MLIntelligenceOverview(
            high_risk_tasks=high_risk_count,
            medium_risk_tasks=medium_risk_count,
            low_risk_tasks=low_risk_count,
            needs_attention=needs_attention_count,
            overdue_tasks=overdue_count,
            upcoming_at_risk_deadlines=upcoming_at_risk_count,
            total_active_tasks=len(rows),
            last_updated=datetime.now(timezone.utc).isoformat()
        )

    @classmethod
    def list_at_risk_tasks(
        cls,
        db: Session,
        current_user: User,
        risk_level: Optional[str] = None,
        attention_priority: Optional[str] = None,
        process: Optional[str] = None,
        department_id: Optional[int] = None,
        owner_id: Optional[int] = None,
        bottleneck: Optional[str] = None,
        overdue_only: Optional[bool] = None,
        search: Optional[str] = None,
        sort_by: str = "priority",
        sort_order: str = "desc",
        page: int = 1,
        size: int = 20
    ) -> Dict[str, Any]:
        """
        Lists at-risk active tasks with real-time ML risk predictions, verified operational evidence, and HR attention priorities.
        """
        today = date.today()
        predictor = get_predictor()
        rows = cls._get_scoped_task_query(db, current_user, department_id).all()

        if not rows:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "size": size,
                "total_pages": 0
            }

        meta = cls._gather_task_metadata(db, rows, today)
        (workload_map, owner_hist, all_deps, unmet_deps, all_fus, open_fus, all_escs, open_escs, rem_map) = meta

        # Pre-filter by owner and process if provided to minimize evaluation overhead
        filtered_rows = []
        for r in rows:
            task = r[0]
            if owner_id and task.owner_id != owner_id:
                continue
            if process and task.category != process:
                continue
            filtered_rows.append(r)

        if not filtered_rows:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "size": size,
                "total_pages": 0
            }

        # Vectorized batch prediction pass
        feature_list = []
        for task, emp, owner, dept in filtered_rows:
            days_rem = (task.due_date - today).days
            unmet_list = unmet_deps.get(task.id, [])
            all_dep_list = all_deps.get(task.id, [])
            dep_status = "PENDING" if len(unmet_list) > 0 else ("NONE" if not all_dep_list else "ALL_MET")
            feature_list.append({
                "days_remaining": max(1, days_rem),
                "task_category": task.category or "ONBOARDING",
                "task_priority": task.priority or "MEDIUM",
                "current_status": task.status if task.status in ["IN_PROGRESS", "COMPLETED", "BLOCKED"] else "IN_PROGRESS",
                "reminder_count": rem_map.get(task.id, 0),
                "owner_previous_delay_rate": owner_hist.get(task.owner_id, 0.20),
                "owner_current_workload": workload_map.get(task.owner_id, 1),
                "dependency_status": dep_status
            })
        batch_preds = predictor.predict_batch(feature_list)

        evaluated_tasks = []
        for (task, emp, owner, dept), pred in zip(filtered_rows, batch_preds):
            eval_res = cls._evaluate_single_task(
                task, emp, owner, dept, today,
                workload_map, owner_hist, all_deps, unmet_deps,
                all_fus, open_fus, all_escs, open_escs, rem_map, predictor,
                pred=pred
            )

            # Apply post-evaluation filters
            if risk_level and risk_level.upper() != "ALL" and eval_res["risk_level"] != risk_level.upper():
                continue
            if attention_priority and attention_priority.upper() != "ALL" and eval_res["hr_attention_priority"] != attention_priority.upper():
                continue
            if bottleneck and bottleneck.upper() != "ALL" and bottleneck.upper() not in eval_res["bottlenecks"]:
                continue
            if overdue_only and not eval_res["is_overdue"]:
                continue

            if search:
                term = search.lower().strip()
                matches_code = term in eval_res["task_code"].lower()
                matches_title = term in eval_res["title"].lower()
                matches_emp = eval_res["employee"] and term in eval_res["employee"].full_name.lower()
                matches_owner = term in eval_res["assignee"].full_name.lower()
                if not (matches_code or matches_title or matches_emp or matches_owner):
                    continue

            evaluated_tasks.append(eval_res)

        # Priority rank mapping for sorting
        prio_rank = {"CRITICAL": 3, "NEEDS_ATTENTION": 2, "MONITOR": 1}
        risk_rank = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}

        # Sorting logic
        if sort_by == "priority":
            evaluated_tasks.sort(
                key=lambda x: (
                    prio_rank.get(x["hr_attention_priority"], 0),
                    x["overdue_days"],
                    x["delay_probability"]
                ),
                reverse=(sort_order.lower() == "desc")
            )
        elif sort_by == "risk":
            evaluated_tasks.sort(
                key=lambda x: x["delay_probability"],
                reverse=(sort_order.lower() == "desc")
            )
        elif sort_by == "due_date":
            evaluated_tasks.sort(
                key=lambda x: x["due_date"],
                reverse=(sort_order.lower() == "desc")
            )
        elif sort_by == "days_remaining":
            evaluated_tasks.sort(
                key=lambda x: x["days_remaining"],
                reverse=(sort_order.lower() == "desc")
            )
        else:
            evaluated_tasks.sort(
                key=lambda x: prio_rank.get(x["hr_attention_priority"], 0),
                reverse=True
            )

        total_records = len(evaluated_tasks)
        total_pages = max(1, (total_records + size - 1) // size)
        start_idx = (page - 1) * size
        end_idx = start_idx + size
        paged_items = evaluated_tasks[start_idx:end_idx]

        task_items = [
            MLIntelligenceTaskItem(
                task_id=t["task_id"],
                task_code=t["task_code"],
                title=t["title"],
                category=t["category"],
                priority=t["priority"],
                status=t["status"],
                due_date=t["due_date"],
                days_remaining=t["days_remaining"],
                is_overdue=t["is_overdue"],
                overdue_days=t["overdue_days"],
                assignee=t["assignee"],
                employee=t["employee"],
                delay_probability=t["delay_probability"],
                risk_level=t["risk_level"],
                hr_attention_priority=t["hr_attention_priority"],
                main_concern=t["main_concern"],
                bottlenecks=t["bottlenecks"],
                active_blockers_count=t["active_blockers_count"],
                follow_ups_count=t["follow_ups_count"],
                escalations_count=t["escalations_count"]
            )
            for t in paged_items
        ]

        return {
            "items": [item.model_dump() for item in task_items],
            "total": total_records,
            "page": page,
            "size": size,
            "total_pages": total_pages
        }

    @classmethod
    def get_task_assessment(
        cls,
        db: Session,
        current_user: User,
        task_id: int
    ) -> MLIntelligenceTaskAssessment:
        """
        Generates an in-depth operational risk assessment for a specific task.
        """
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} not found.")

        TaskService._verify_task_access(db, current_user, task)

        emp = db.scalar(select(Employee).where(Employee.id == task.employee_id))
        owner = db.scalar(select(User).where(User.id == task.owner_id))
        dept = db.scalar(select(Department).where(Department.id == emp.department_id)) if emp else None

        today = date.today()
        predictor = get_predictor()
        meta = cls._gather_task_metadata(db, [(task, emp, owner, dept)], today)
        (workload_map, owner_hist, all_deps, unmet_deps, all_fus, open_fus, all_escs, open_escs, rem_map) = meta

        eval_res = cls._evaluate_single_task(
            task, emp, owner, dept, today,
            workload_map, owner_hist, all_deps, unmet_deps,
            all_fus, open_fus, all_escs, open_escs, rem_map, predictor
        )

        # Observations from verified facts
        observations = []
        if eval_res["is_overdue"]:
            observations.append(f"Task passed its target due date ({task.due_date}) and is currently overdue by {eval_res['overdue_days']} calendar days.")
        else:
            observations.append(f"Target deadline is in {eval_res['days_remaining']} calendar days ({task.due_date}).")

        if eval_res["unmet_dependencies"]:
            observations.append(
                f"Blocked by {len(eval_res['unmet_dependencies'])} unfinished prerequisite task(s): "
                + ", ".join([f"'{d['title']}' ({d['status']})" for d in eval_res["unmet_dependencies"][:2]])
            )
        elif eval_res["all_dependencies"]:
            observations.append("All prerequisite task dependencies have been successfully verified and completed.")
        else:
            observations.append("No prerequisite dependency constraints defined for this task.")

        if eval_res["open_follow_ups"]:
            observations.append(f"{len(eval_res['open_follow_ups'])} follow-up reminder(s) currently open without recorded response.")
        
        if eval_res["open_escalations"]:
            observations.append(f"Active escalation in progress (Level {eval_res['open_escalations'][0]['escalation_level']}): {eval_res['open_escalations'][0]['reason']}")

        if eval_res["owner_workload"] >= 15:
            observations.append(f"Assignee ({owner.full_name}) has heavy operational capacity strain with {eval_res['owner_workload']} active tasks.")

        # Suggested Next Steps
        next_steps = []
        if eval_res["unmet_dependencies"]:
            next_steps.append(f"Expedite prerequisite task '{eval_res['unmet_dependencies'][0]['task_code']}' assigned to {eval_res['unmet_dependencies'][0]['owner_name']}.")
        if eval_res["is_overdue"]:
            next_steps.append("Contact assignee to review operational impediments or record an approved deadline adjustment.")
        if eval_res["open_follow_ups"]:
            next_steps.append("Review open follow-up notes and escalate to reporting manager if response remains unreceived.")
        if eval_res["owner_workload"] >= 15 and not eval_res["is_overdue"]:
            next_steps.append("Consider redistributing secondary backlog tasks to prevent cumulative SLA slippage.")
        if not next_steps:
            next_steps.append("Continue tracking standard progress according to operational lifecycle timelines.")

        # Prerequisite details
        prereqs = [
            PrerequisiteDetail(
                id=d["id"],
                task_code=d["task_code"],
                title=d["title"],
                status=d["status"],
                owner_name=d["owner_name"]
            )
            for d in eval_res["all_dependencies"]
        ]

        # Follow-up details
        follow_ups = [
            FollowUpDetail(
                id=f["id"],
                follow_up_date=f["follow_up_date"],
                notes=f["notes"],
                response_received=f["response_received"],
                response_notes=f["response_notes"]
            )
            for f in eval_res["all_follow_ups"]
        ]

        # Escalation details
        escalations = [
            EscalationDetail(
                id=e["id"],
                escalation_level=e["escalation_level"],
                reason=e["reason"],
                status=e["status"],
                escalated_to_name=e["escalated_to_name"]
            )
            for e in eval_res["all_escalations"]
        ]

        # Contributing factors
        contributions = [
            ContributingFactorInfo(
                factor=item.get("factor", "unknown"),
                effect=item.get("effect", ""),
                impact=float(item.get("impact", 0.0))
            )
            for item in eval_res["contributing_factors"]
        ]

        model_prediction = ModelPredictionDetails(
            delay_probability=eval_res["delay_probability"],
            risk_level=eval_res["risk_level"],
            model_version=eval_res["model_version"],
            advisory_note=(
                "Decision-support indicator calculated from historical execution patterns. "
                "Probabilities are non-causal and require operational HR judgment."
            ),
            contributing_factors=contributions
        )

        operational_facts = {
            "dependencies": [p.model_dump() for p in prereqs],
            "follow_ups": [f.model_dump() for f in follow_ups],
            "escalations": [e.model_dump() for e in escalations],
            "owner_workload": {
                "active_tasks_count": eval_res["owner_workload"],
                "historical_delay_rate": eval_res["owner_delay_rate"]
            }
        }

        available_actions = {
            "task_url": f"/tasks?taskId={task.id}",
            "follow_ups_url": f"/follow-ups?taskId={task.id}",
            "employee_url": f"/employees/{emp.id}" if emp else None,
            "can_escalate": len(eval_res["open_escalations"]) == 0,
            "can_prioritise": task.priority != "HIGH"
        }

        return MLIntelligenceTaskAssessment(
            task_id=task.id,
            task_code=task.task_code,
            title=task.title,
            category=task.category,
            priority=task.priority,
            status=task.status,
            due_date=eval_res["due_date"],
            days_remaining=eval_res["days_remaining"],
            is_overdue=eval_res["is_overdue"],
            overdue_days=eval_res["overdue_days"],
            assignee=eval_res["assignee"],
            employee=eval_res["employee"],
            model_prediction=model_prediction,
            hr_attention_priority=eval_res["hr_attention_priority"],
            hr_attention_rule=eval_res["hr_attention_rule"],
            main_concern=eval_res["main_concern"],
            operational_facts=operational_facts,
            observations=observations,
            suggested_next_steps=next_steps,
            available_actions=available_actions
        )

    @classmethod
    def get_operational_bottlenecks(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None
    ) -> MLIntelligenceBottlenecksResponse:
        """
        Computes grouped counts and descriptions for operational bottleneck categories.
        """
        today = date.today()
        predictor = get_predictor()
        rows = cls._get_scoped_task_query(db, current_user, department_id).all()

        counts = Counter()
        bottlenecked_task_ids = set()

        if rows:
            meta = cls._gather_task_metadata(db, rows, today)
            (workload_map, owner_hist, all_deps, unmet_deps, all_fus, open_fus, all_escs, open_escs, rem_map) = meta

            # Vectorized batch prediction for performance
            feature_list = []
            for task, emp, owner, dept in rows:
                days_rem = (task.due_date - today).days
                unmet_list = unmet_deps.get(task.id, [])
                all_dep_list = all_deps.get(task.id, [])
                dep_status = "PENDING" if len(unmet_list) > 0 else ("NONE" if not all_dep_list else "ALL_MET")
                feature_list.append({
                    "days_remaining": max(1, days_rem),
                    "task_category": task.category or "ONBOARDING",
                    "task_priority": task.priority or "MEDIUM",
                    "current_status": task.status if task.status in ["IN_PROGRESS", "COMPLETED", "BLOCKED"] else "IN_PROGRESS",
                    "reminder_count": rem_map.get(task.id, 0),
                    "owner_previous_delay_rate": owner_hist.get(task.owner_id, 0.20),
                    "owner_current_workload": workload_map.get(task.owner_id, 1),
                    "dependency_status": dep_status
                })
            batch_preds = predictor.predict_batch(feature_list)

            for (task, emp, owner, dept), pred in zip(rows, batch_preds):
                eval_res = cls._evaluate_single_task(
                    task, emp, owner, dept, today,
                    workload_map, owner_hist, all_deps, unmet_deps,
                    all_fus, open_fus, all_escs, open_escs, rem_map, predictor,
                    pred=pred
                )
                b_list = eval_res["bottlenecks"]
                if b_list:
                    bottlenecked_task_ids.add(task.id)
                for b in b_list:
                    counts[b] += 1

        categories = [
            BottleneckCategorySummary(
                id="WAITING_RESPONSE",
                name="Awaiting Responses",
                count=counts["WAITING_RESPONSE"],
                description="Follow-ups sent to assignees or departments with no recorded response.",
                filter_key="WAITING_RESPONSE"
            ),
            BottleneckCategorySummary(
                id="PENDING_DEPENDENCY",
                name="Prerequisite Blockers",
                count=counts["PENDING_DEPENDENCY"],
                description="Tasks waiting on prior dependent operational activities to complete.",
                filter_key="PENDING_DEPENDENCY"
            ),
            BottleneckCategorySummary(
                id="WORKLOAD_PRESSURE",
                name="Workload Backlog",
                count=counts["WORKLOAD_PRESSURE"],
                description="Tasks assigned to team members managing 15 or more concurrent active items.",
                filter_key="WORKLOAD_PRESSURE"
            ),
            BottleneckCategorySummary(
                id="REPEATED_REMINDERS",
                name="Repeated Reminders & Escalations",
                count=counts["REPEATED_REMINDERS"],
                description="Tasks requiring 2+ notifications or under active escalation review.",
                filter_key="REPEATED_REMINDERS"
            ),
            BottleneckCategorySummary(
                id="STALLED_PROGRESS",
                name="Stalled Progress",
                count=counts["STALLED_PROGRESS"],
                description="Tasks in blocked status or overdue by 3 or more business days.",
                filter_key="STALLED_PROGRESS"
            ),
            BottleneckCategorySummary(
                id="LIFECYCLE_MILESTONE",
                name="Imminent Lifecycle Milestones",
                count=counts["LIFECYCLE_MILESTONE"],
                description="Core onboarding, probation, or offboarding tasks due within 3 days.",
                filter_key="LIFECYCLE_MILESTONE"
            ),
        ]

        return MLIntelligenceBottlenecksResponse(
            categories=categories,
            total_bottlenecked_tasks=len(bottlenecked_task_ids)
        )
