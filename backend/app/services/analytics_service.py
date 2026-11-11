from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any, Tuple
import zoneinfo
import numpy as np
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func, desc, asc, text

from app.models.organization import User, Employee, Department
from app.models.workflow import Task, TaskStatusHistory, Escalation
from app.models.lifecycle import (
    EmployeeLifecycle,
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)
from app.core.permissions import get_reporting_employee_ids
from app.schemas.analytics import (
    KPIPerformance,
    ProcessOnTimeMetric,
    MonthlyCompletionTrendItem,
    ProcessTurnaroundMetric,
    RecordedDelayReasonItem,
    HROperationalObservation,
    AnalyticsPerformanceResponse,
    ActivityRecordItem,
    ActivityRecordsResponse,
)

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

# Standard 6 employee lifecycle processes mapped to database task categories
LIFECYCLE_PROCESS_CONFIG: List[Dict[str, Any]] = [
    {"key": "ONBOARDING", "name": "Onboarding", "db_categories": ["ONBOARDING"]},
    {"key": "PROBATION", "name": "Probation", "db_categories": ["PROBATION"]},
    {"key": "CONFIRMATION", "name": "Confirmation", "db_categories": ["CONFIRMATION"]},
    {"key": "DOCUMENTATION", "name": "Documentation", "db_categories": ["COMPLIANCE", "DOCUMENTATION"]},
    {"key": "PERFORMANCE", "name": "Performance Reviews", "db_categories": ["PERFORMANCE"]},
    {"key": "OFFBOARDING", "name": "Offboarding", "db_categories": ["OFFBOARDING"]},
]

PROCESS_KEY_TO_NAME = {item["key"]: item["name"] for item in LIFECYCLE_PROCESS_CONFIG}
CATEGORY_TO_PROCESS_KEY = {}
for item in LIFECYCLE_PROCESS_CONFIG:
    for cat in item["db_categories"]:
        CATEGORY_TO_PROCESS_KEY[cat] = item["key"]


class AnalyticsService:
    """
    Certified HR Operational Performance Analytics Service.
    Computes evidence-grounded performance metrics, process turnaround times,
    monthly completion trends, recorded delay reasons, and operational observations.
    """

    @classmethod
    def _get_current_date(cls) -> date:
        return datetime.now(KOLKATA_TZ).date()

    @classmethod
    def _resolve_period_bounds(cls, period: str, today: date) -> Tuple[Optional[date], date]:
        """
        Translates reporting period key into start and end dates.
        """
        clean = (period or "12m").lower()
        if clean == "30d":
            return today - timedelta(days=30), today
        elif clean == "90d":
            return today - timedelta(days=90), today
        elif clean == "6m":
            return today - timedelta(days=180), today
        elif clean == "12m":
            return today - timedelta(days=365), today
        elif clean == "all":
            return None, today
        else:
            return today - timedelta(days=365), today

    @classmethod
    def _build_task_query(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None,
        process_filter: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        completed_only: bool = True,
    ):
        """
        Builds the base query for tasks with strict RBAC scoping.
        """
        role_code = current_user.role.role_code if current_user.role else ""
        query = (
            db.query(Task, Employee, Department, User)
            .join(Employee, Employee.id == Task.employee_id)
            .outerjoin(Department, Department.id == Employee.department_id)
            .join(User, User.id == Task.owner_id)
        )

        if completed_only:
            query = query.filter(Task.completed_at.isnot(None))

        # Role-based scoping
        if role_code in ["ADMIN", "HR_MANAGER"]:
            if department_id:
                query = query.filter(Employee.department_id == department_id)
        elif role_code == "HR_EXECUTIVE":
            # Executive sees their assigned tasks or tasks in their department
            if department_id:
                query = query.filter(Employee.department_id == department_id)
            query = query.filter(
                or_(
                    Task.owner_id == current_user.id,
                    Employee.department_id == current_user.employee.department_id if current_user.employee else True,
                )
            )
        elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
            subordinate_ids = get_reporting_employee_ids(db, current_user.employee_id)
            query = query.filter(
                or_(
                    Task.owner_id == current_user.id,
                    Task.employee_id.in_(subordinate_ids) if subordinate_ids else False,
                )
            )
            if department_id:
                query = query.filter(Employee.department_id == department_id)
        else:
            query = query.filter(
                or_(
                    Task.owner_id == current_user.id,
                    Task.employee_id == current_user.employee_id,
                )
            )

        # Process filter
        if process_filter and process_filter.upper() != "ALL":
            p_upper = process_filter.upper()
            target_cfg = next((item for item in LIFECYCLE_PROCESS_CONFIG if item["key"] == p_upper), None)
            if target_cfg:
                query = query.filter(Task.category.in_(target_cfg["db_categories"]))
            else:
                query = query.filter(Task.category == p_upper)

        # Date boundaries
        if start_date:
            query = query.filter(func.date(Task.completed_at) >= start_date)
        if end_date:
            query = query.filter(func.date(Task.completed_at) <= end_date)

        return query

    @classmethod
    def get_performance_analytics(
        cls,
        db: Session,
        current_user: User,
        period: str = "12m",
        department_id: Optional[int] = None,
        process: Optional[str] = None,
    ) -> AnalyticsPerformanceResponse:
        """
        Computes all 4 KPIs, 4 Visualizations, and evidence-based HR Observations.
        """
        today = cls._get_current_date()
        start_date, end_date = cls._resolve_period_bounds(period, today)

        # 1. Fetch completed tasks in reporting period
        q = cls._build_task_query(
            db=db,
            current_user=current_user,
            department_id=department_id,
            process_filter=process,
            start_date=start_date,
            end_date=end_date,
            completed_only=True,
        )
        task_rows = q.all()

        total_completed = len(task_rows)
        on_time_count = 0
        late_count = 0
        durations: List[float] = []

        # Containers for charts
        process_stats: Dict[str, Dict[str, Any]] = {
            item["key"]: {
                "name": item["name"],
                "completed": 0,
                "on_time": 0,
                "late": 0,
                "durations": [],
            }
            for item in LIFECYCLE_PROCESS_CONFIG
        }

        monthly_buckets: Dict[str, Dict[str, int]] = defaultdict(lambda: {"completed": 0, "late": 0, "on_time": 0})
        delay_reason_counts: Dict[str, int] = defaultdict(int)

        for task, emp, dept, owner in task_rows:
            comp_date = task.completed_at.date() if task.completed_at else None
            due_d = task.due_date

            if not comp_date or not due_d:
                continue

            is_late = comp_date > due_d
            if is_late:
                late_count += 1
            else:
                on_time_count += 1

            # Duration
            start_d = task.start_date or task.created_at.date()
            if comp_date >= start_d:
                duration_days = (comp_date - start_d).days
                durations.append(float(duration_days))
            else:
                duration_days = 0.0

            # Process stats
            cat_key = CATEGORY_TO_PROCESS_KEY.get(task.category, "ONBOARDING")
            if cat_key in process_stats:
                process_stats[cat_key]["completed"] += 1
                if is_late:
                    process_stats[cat_key]["late"] += 1
                else:
                    process_stats[cat_key]["on_time"] += 1
                if comp_date >= start_d:
                    process_stats[cat_key]["durations"].append(float(duration_days))

            # Monthly bucket
            m_key = comp_date.strftime("%Y-%m")
            monthly_buckets[m_key]["completed"] += 1
            if is_late:
                monthly_buckets[m_key]["late"] += 1
            else:
                monthly_buckets[m_key]["on_time"] += 1

            # Recorded delay reason (only actual recorded reasons)
            if (is_late or (task.deadline_extension_count and task.deadline_extension_count > 0)) and task.last_deadline_change_reason:
                clean_reason = task.last_deadline_change_reason.strip()
                if clean_reason:
                    delay_reason_counts[clean_reason] += 1

        # Also inspect TaskStatusHistory for late tasks in period where deadline changed with Reason
        if late_count > 0:
            late_task_ids = [t[0].id for t in task_rows if t[0].completed_at and t[0].completed_at.date() > t[0].due_date]
            if late_task_ids:
                hist_reasons = (
                    db.query(TaskStatusHistory.change_reason)
                    .filter(
                        TaskStatusHistory.task_id.in_(late_task_ids),
                        TaskStatusHistory.change_reason.isnot(None),
                    )
                    .all()
                )
                for (h_reason,) in hist_reasons:
                    if h_reason and "Reason:" in h_reason:
                        parsed = h_reason.split("Reason:")[-1].strip()
                        if parsed:
                            delay_reason_counts[parsed] += 1

        # KPI 2: On-time completion rate
        on_time_rate = round((on_time_count / total_completed) * 100, 1) if total_completed > 0 else 0.0

        # KPI 3: Median completion time
        median_completion_time = round(float(np.median(durations)), 1) if durations else 0.0

        kpi_obj = KPIPerformance(
            activities_completed=total_completed,
            on_time_completion_rate=on_time_rate,
            median_completion_time_days=median_completion_time,
            late_completions=late_count,
            total_eligible=total_completed,
        )

        # CHART 1: On-Time Completion by Lifecycle Process
        on_time_by_process: List[ProcessOnTimeMetric] = []
        for item in LIFECYCLE_PROCESS_CONFIG:
            st = process_stats[item["key"]]
            tot = st["completed"]
            ot = st["on_time"]
            lt = st["late"]
            pct = round((ot / tot) * 100, 1) if tot > 0 else 0.0
            on_time_by_process.append(
                ProcessOnTimeMetric(
                    process_key=item["key"],
                    process_name=item["name"],
                    completed_count=tot,
                    on_time_count=ot,
                    late_count=lt,
                    on_time_percentage=pct,
                )
            )

        # CHART 2: Monthly Operational Completion Trend
        monthly_trend: List[MonthlyCompletionTrendItem] = []
        for m_key in sorted(monthly_buckets.keys()):
            b = monthly_buckets[m_key]
            m_tot = b["completed"]
            m_ot = b["on_time"]
            m_lt = b["late"]
            m_pct = round((m_ot / m_tot) * 100, 1) if m_tot > 0 else 0.0
            try:
                dt = datetime.strptime(m_key, "%Y-%m")
                label = dt.strftime("%b %Y")
            except Exception:
                label = m_key

            monthly_trend.append(
                MonthlyCompletionTrendItem(
                    month=m_key,
                    month_label=label,
                    completed=m_tot,
                    late=m_lt,
                    on_time=m_ot,
                    on_time_percentage=m_pct,
                )
            )

        # CHART 3: Process Turnaround Time
        turnaround_by_process: List[ProcessTurnaroundMetric] = []
        for item in LIFECYCLE_PROCESS_CONFIG:
            st = process_stats[item["key"]]
            p_durations = st["durations"]
            med = round(float(np.median(p_durations)), 1) if p_durations else 0.0
            turnaround_by_process.append(
                ProcessTurnaroundMetric(
                    process_key=item["key"],
                    process_name=item["name"],
                    median_days=med,
                    unit="days",
                    sample_size=len(p_durations),
                )
            )

        # CHART 4: Recorded Reasons for Delays
        delay_reasons: List[RecordedDelayReasonItem] = []
        total_recorded_delays = sum(delay_reason_counts.values())
        for r_text, r_count in sorted(delay_reason_counts.items(), key=lambda x: x[1], reverse=True):
            r_pct = round((r_count / total_recorded_delays) * 100, 1) if total_recorded_delays > 0 else 0.0
            delay_reasons.append(
                RecordedDelayReasonItem(
                    reason=r_text,
                    affected_activities=r_count,
                    percentage=r_pct,
                )
            )

        # SECTION 7: Evidence-grounded HR Observations ("What Should HR Look At?")
        observations: List[HROperationalObservation] = []

        if total_completed > 0:
            # Observation 1: Weakest on-time process
            active_processes = [p for p in on_time_by_process if p.completed_count >= 5]
            if active_processes:
                weakest = min(active_processes, key=lambda x: x.on_time_percentage)
                if weakest.on_time_percentage < 85.0:
                    observations.append(
                        HROperationalObservation(
                            id="obs-weakest-process",
                            category="Process Adherence",
                            title=f"{weakest.process_name} has lowest on-time completion ({weakest.on_time_percentage}%)",
                            observation=f"{weakest.process_name} recorded {weakest.late_count} late completions out of {weakest.completed_count} total completed activities ({weakest.on_time_percentage}% on-time).",
                            metric_or_process=weakest.process_name,
                            why_it_matters=f"Delayed {weakest.process_name.lower()} activities create operational friction for downstream stakeholders and prolong lifecycle transitions.",
                            recommended_action=f"Inspect prerequisites and review checklist stages for {weakest.process_name.lower()} tasks to unblock recurring bottlenecks.",
                            severity="warning" if weakest.on_time_percentage >= 70.0 else "critical",
                            action_filter={"process": weakest.process_key, "status": "LATE"},
                        )
                    )

            # Observation 2: Longest turnaround time
            turnaround_active = [t for t in turnaround_by_process if t.sample_size >= 5]
            if turnaround_active:
                longest = max(turnaround_active, key=lambda x: x.median_days)
                if longest.median_days >= 7.0:
                    observations.append(
                        HROperationalObservation(
                            id="obs-turnaround-time",
                            category="Velocity & Duration",
                            title=f"{longest.process_name} has highest turnaround duration (median {longest.median_days} days)",
                            observation=f"Median turnaround time for {longest.process_name} is {longest.median_days} days across {longest.sample_size} completed activities.",
                            metric_or_process=longest.process_name,
                            why_it_matters="Long turnaround times delay employee status updates and increase administrative queue depth across HR coordinators.",
                            recommended_action=f"Verify whether multi-tier approvals or pending manager evaluations can be streamlined with automated reminders.",
                            severity="info" if longest.median_days < 14.0 else "warning",
                            action_filter={"process": longest.process_key},
                        )
                    )

            # Observation 3: Recorded delay reason analysis
            if delay_reasons:
                top_reason = delay_reasons[0]
                observations.append(
                    HROperationalObservation(
                        id="obs-delay-reason",
                        category="Delay Factor",
                        title=f"Leading recorded delay blocker: \"{top_reason.reason}\"",
                        observation=f"Accounting for {top_reason.affected_activities} delayed activities ({top_reason.percentage}% of all activities with recorded delay reasons).",
                        metric_or_process="Operational Blockers",
                        why_it_matters="Root cause documentation demonstrates that prerequisite dependencies are the primary systemic source of scheduled operational delays.",
                        recommended_action="Prioritize cross-functional follow-ups on prerequisite tasks before milestone dates are reached.",
                        severity="warning",
                        action_filter={"delay_reason": top_reason.reason},
                    )
                )

            # Observation 4: Trend trajectory (last 3 months)
            if len(monthly_trend) >= 3:
                last_3 = monthly_trend[-3:]
                lates = [m.late for m in last_3]
                if lates[2] > lates[1] > lates[0]:
                    observations.append(
                        HROperationalObservation(
                            id="obs-trend-deterioration",
                            category="Operational Trend",
                            title=f"Late completions increased over the last 3 months ({lates[0]} → {lates[1]} → {lates[2]})",
                            observation=f"Consecutive monthly rises in late completions observed between {last_3[0].month_label} and {last_3[2].month_label}.",
                            metric_or_process="Monthly SLA Adherence",
                            why_it_matters="An upward trajectory in late completions suggests growing operational backlog or coordinator capacity constraints.",
                            recommended_action="Review high-risk active tasks in Section 2 below to intervene before additional deadlines elapse.",
                            severity="critical",
                            action_filter={"month": last_3[2].month},
                        )
                    )
                elif lates[2] < lates[1] < lates[0]:
                    observations.append(
                        HROperationalObservation(
                            id="obs-trend-improvement",
                            category="Operational Trend",
                            title=f"Late completions decreased over the last 3 months ({lates[0]} → {lates[1]} → {lates[2]})",
                            observation=f"Progressive reduction in monthly late completions from {last_3[0].month_label} to {last_3[2].month_label}.",
                            metric_or_process="Monthly SLA Adherence",
                            why_it_matters="Indicates that recent triage actions and coordinator follow-ups are successfully keeping activities on schedule.",
                            recommended_action="Maintain routine monitoring across active operations to sustain performance.",
                            severity="info",
                            action_filter=None,
                        )
                    )

        return AnalyticsPerformanceResponse(
            reporting_period=period or "12m",
            period_start=(start_date or date(2024, 1, 1)).isoformat(),
            period_end=end_date.isoformat(),
            last_refreshed_at=datetime.now(timezone.utc).isoformat(),
            kpis=kpi_obj,
            on_time_by_process=on_time_by_process,
            monthly_trend=monthly_trend,
            turnaround_by_process=turnaround_by_process,
            delay_reasons=delay_reasons,
            observations=observations,
        )

    @classmethod
    def list_activity_records(
        cls,
        db: Session,
        current_user: User,
        process: Optional[str] = None,
        status_filter: Optional[str] = None,
        month: Optional[str] = None,
        delay_reason: Optional[str] = None,
        department_id: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> ActivityRecordsResponse:
        """
        Retrieves paginated underlying activity records for drill-down exploration.
        """
        q = cls._build_task_query(
            db=db,
            current_user=current_user,
            department_id=department_id,
            process_filter=process,
            completed_only=True,
        )

        if month:
            # month is 'YYYY-MM'
            try:
                y, m = map(int, month.split("-"))
                start_m = date(y, m, 1)
                # Next month
                if m == 12:
                    end_m = date(y + 1, 1, 1)
                else:
                    end_m = date(y, m + 1, 1)
                q = q.filter(func.date(Task.completed_at) >= start_m, func.date(Task.completed_at) < end_m)
            except Exception:
                pass

        if status_filter:
            s_up = status_filter.upper()
            if s_up == "LATE":
                q = q.filter(func.date(Task.completed_at) > Task.due_date)
            elif s_up == "ON_TIME":
                q = q.filter(func.date(Task.completed_at) <= Task.due_date)

        if delay_reason:
            hist_task_ids = (
                db.query(TaskStatusHistory.task_id)
                .filter(TaskStatusHistory.change_reason.ilike(f"%{delay_reason}%"))
                .subquery()
            )
            q = q.filter(
                or_(
                    Task.last_deadline_change_reason.ilike(f"%{delay_reason}%"),
                    Task.id.in_(hist_task_ids),
                )
            )

        if search:
            s_term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    Task.title.ilike(s_term),
                    Task.task_code.ilike(s_term),
                    Employee.first_name.ilike(s_term),
                    Employee.last_name.ilike(s_term),
                    Employee.employee_code.ilike(s_term),
                )
            )

        total = q.count()
        total_pages = max(1, (total + size - 1) // size)
        page = min(max(1, page), total_pages)
        offset = (page - 1) * size

        q = q.order_by(desc(Task.completed_at)).offset(offset).limit(size)
        rows = q.all()

        items: List[ActivityRecordItem] = []
        for task, emp, dept, owner in rows:
            comp_d = task.completed_at.date() if task.completed_at else None
            is_late = comp_d > task.due_date if comp_d else False
            start_d = task.start_date or task.created_at.date()
            dur = float((comp_d - start_d).days) if comp_d and comp_d >= start_d else None
            p_name = PROCESS_KEY_TO_NAME.get(CATEGORY_TO_PROCESS_KEY.get(task.category, ""), task.category)

            items.append(
                ActivityRecordItem(
                    task_id=task.id,
                    task_code=task.task_code,
                    title=task.title,
                    category=task.category,
                    process_name=p_name,
                    status=task.status,
                    due_date=task.due_date.isoformat(),
                    completed_at=task.completed_at.isoformat() if task.completed_at else None,
                    start_date=start_d.isoformat() if start_d else None,
                    duration_days=dur,
                    is_late=is_late,
                    assignee_name=owner.full_name if owner else "Unassigned",
                    employee_name=f"{emp.first_name} {emp.last_name}" if emp else None,
                    employee_code=emp.employee_code if emp else None,
                    department_name=dept.name if dept else None,
                    delay_reason=task.last_deadline_change_reason,
                )
            )

        return ActivityRecordsResponse(
            items=items,
            total=total,
            page=page,
            size=size,
            total_pages=total_pages,
        )

