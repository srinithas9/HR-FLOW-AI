import pytest
from datetime import date, timedelta, datetime
from fastapi.testclient import TestClient
from sqlalchemy import select, delete, text
from app.main import app
from app.db.session import SessionLocal
from app.models.workflow import (
    Task,
    TaskTemplate,
    TaskDependency,
    TaskStatusHistory,
    FollowUp,
    Notification,
    Escalation,
)
from app.models.intelligence import ActivityLog

client = TestClient(app)


def get_token(email: str = "neha.saxena@auratech.in") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password@123"})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(autouse=True)
def preserve_database_state():
    """Ensure that every test cleans up any ephemeral records created by tests."""
    def _cleanup():
        db = SessionLocal()
        try:
            # Clean up test-specific dependencies, tasks, and notifications
            db.execute(text("DELETE FROM task_dependencies WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE 'Test %' OR title LIKE 'Task Alpha%' OR title LIKE 'Task Beta%' OR title LIKE 'Task Gamma%' OR title LIKE 'Invalid employee test%');"))
            db.execute(text("DELETE FROM task_status_history WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE 'Test %' OR title LIKE 'Task Alpha%' OR title LIKE 'Task Beta%' OR title LIKE 'Task Gamma%' OR title LIKE 'Invalid employee test%');"))
            db.execute(text("DELETE FROM tasks WHERE title LIKE 'Test %' OR title LIKE 'Task Alpha%' OR title LIKE 'Task Beta%' OR title LIKE 'Task Gamma%' OR title LIKE 'Invalid employee test%';"))
            db.execute(text("DELETE FROM escalations WHERE reason LIKE 'Repeatedly unacknowledged%' OR reason LIKE 'Unauthorized escalation%';"))
            db.execute(text("DELETE FROM follow_ups WHERE notes LIKE 'Please verify pre-boarding%' OR notes LIKE 'Unauthorized follow-up%';"))
            db.execute(text("DELETE FROM notifications WHERE id > 3450 AND title LIKE '%Reminder%';"))
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    _cleanup()
    yield
    _cleanup()


def test_task_overview_and_list():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Overview
    overview_res = client.get("/api/v1/tasks/overview", headers=headers)
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert "total_tasks" in overview
    assert "pending_tasks" in overview
    assert "in_progress_tasks" in overview
    assert "blocked_tasks" in overview
    assert "completed_tasks" in overview
    assert "overdue_tasks" in overview
    assert "high_risk_tasks" in overview
    assert overview["total_tasks"] >= 3300

    # 2. List with pagination, search, filters
    list_res = client.get("/api/v1/tasks?page=1&size=10&status=IN_PROGRESS", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert len(data["items"]) == 10
    assert data["pagination"]["total"] > 0
    assert data["pagination"]["page"] == 1

    # Verify joined fields and ML predictions
    first_task = data["items"][0]
    assert "task_code" in first_task
    assert "employee_name" in first_task
    assert "department_name" in first_task
    assert "owner_name" in first_task
    assert "is_overdue" in first_task


def test_task_search_and_filters():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Search by code
    res = client.get("/api/v1/tasks?search=TSK-00001", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) >= 1
    assert items[0]["task_code"] == "TSK-00001"

    # Filter by category and priority
    cat_res = client.get("/api/v1/tasks?category=ONBOARDING&priority=HIGH", headers=headers)
    assert cat_res.status_code == 200
    for item in cat_res.json()["items"]:
        assert item["category"] == "ONBOARDING"
        assert item["priority"] == "HIGH"


def test_task_creation_validation_and_lifecycle():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    created_id = None
    try:
        # 1. Invalid employee rejection
        inv_res = client.post(
            "/api/v1/tasks",
            json={
                "employee_id": 99999,
                "category": "ONBOARDING",
                "title": "Invalid employee test",
                "due_date": str(date.today() + timedelta(days=5)),
            },
            headers=headers
        )
        assert inv_res.status_code in [400, 422]

        # 2. Valid creation
        create_payload = {
            "employee_id": 1,
            "category": "ONBOARDING",
            "title": "Test Operational Task 100",
            "description": "Integration test task creation and workflow verification.",
            "priority": "HIGH",
            "due_date": str(date.today() + timedelta(days=7)),
        }
        create_res = client.post("/api/v1/tasks", json=create_payload, headers=headers)
        assert create_res.status_code == 201, create_res.text
        created = create_res.json()
        created_id = created["id"]
        assert created["title"] == "Test Operational Task 100"
        assert created["status"] == "PENDING"
        assert created["priority"] == "HIGH"
        assert created["task_code"].startswith("TSK-")

        # 3. Retrieve task detail
        detail_res = client.get(f"/api/v1/tasks/{created_id}", headers=headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["id"] == created_id
        assert len(detail["status_history"]) >= 1

        # 4. Update task details
        update_res = client.put(
            f"/api/v1/tasks/{created_id}",
            json={"title": "Updated Task 100 Title", "priority": "CRITICAL"},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["title"] == "Updated Task 100 Title"
        assert update_res.json()["priority"] == "CRITICAL"

        # 5. Reassign task owner
        reassign_res = client.post(
            f"/api/v1/tasks/{created_id}/reassign",
            json={"new_owner_id": 2, "reason": "Workload rebalancing"},
            headers=headers
        )
        assert reassign_res.status_code == 200
        assert reassign_res.json()["owner_id"] == 2

        # 6. Extend deadline (requires reason >= 5 chars)
        fail_ext = client.post(
            f"/api/v1/tasks/{created_id}/extend-deadline",
            json={"new_due_date": str(date.today() + timedelta(days=14)), "reason": "abc"},
            headers=headers
        )
        assert fail_ext.status_code in [400, 422]

        ext_res = client.post(
            f"/api/v1/tasks/{created_id}/extend-deadline",
            json={
                "new_due_date": str(date.today() + timedelta(days=14)),
                "reason": "Customer onboarding requirements postponed by stakeholder."
            },
            headers=headers
        )
        assert ext_res.status_code == 200
        assert ext_res.json()["deadline_extension_count"] == 1

        # 7. Status transition to IN_PROGRESS
        st_res = client.patch(
            f"/api/v1/tasks/{created_id}/status",
            json={"status": "IN_PROGRESS", "reason": "Commencing task execution"},
            headers=headers
        )
        assert st_res.status_code == 200
        assert st_res.json()["status"] == "IN_PROGRESS"

        # 8. Complete task and verify completed_at timestamp
        comp_res = client.patch(
            f"/api/v1/tasks/{created_id}/status",
            json={"status": "COMPLETED", "reason": "All deliverables validated"},
            headers=headers
        )
        assert comp_res.status_code == 200
        assert comp_res.json()["status"] == "COMPLETED"
        assert comp_res.json()["completed_at"] is not None

    finally:
        if created_id:
            db = SessionLocal()
            try:
                db.execute(delete(TaskStatusHistory).where(TaskStatusHistory.task_id == created_id))
                db.execute(delete(Notification).where(Notification.task_id == created_id))
                db.execute(delete(ActivityLog).where(ActivityLog.entity_id == created_id, ActivityLog.entity_type == "TASK"))
                db.execute(delete(Task).where(Task.id == created_id))
                db.commit()
            finally:
                db.close()


def test_task_dependencies_and_cycle_prevention():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    task_a_id = None
    task_b_id = None
    task_c_id = None
    try:
        # Create 3 tasks
        res_a = client.post(
            "/api/v1/tasks",
            json={"employee_id": 1, "category": "COMPLIANCE", "title": "Task Alpha", "due_date": str(date.today() + timedelta(days=5))},
            headers=headers
        )
        task_a_id = res_a.json()["id"]

        res_b = client.post(
            "/api/v1/tasks",
            json={"employee_id": 1, "category": "COMPLIANCE", "title": "Task Beta", "due_date": str(date.today() + timedelta(days=6))},
            headers=headers
        )
        task_b_id = res_b.json()["id"]

        res_c = client.post(
            "/api/v1/tasks",
            json={"employee_id": 1, "category": "COMPLIANCE", "title": "Task Gamma", "due_date": str(date.today() + timedelta(days=7))},
            headers=headers
        )
        task_c_id = res_c.json()["id"]

        # 1. Self-dependency rejection (Task A cannot depend on Task A)
        self_dep = client.post(
            f"/api/v1/tasks/{task_a_id}/dependencies",
            json={"prerequisite_task_id": task_a_id},
            headers=headers
        )
        assert self_dep.status_code in [400, 422]
        assert "cannot depend on itself" in self_dep.text

        # 2. Add dependency: Task B depends on Task A (A -> B)
        dep1 = client.post(
            f"/api/v1/tasks/{task_b_id}/dependencies",
            json={"prerequisite_task_id": task_a_id},
            headers=headers
        )
        assert dep1.status_code == 201
        dep1_id = dep1.json()["id"]

        # 3. Add dependency: Task C depends on Task B (B -> C, so A -> B -> C)
        dep2 = client.post(
            f"/api/v1/tasks/{task_c_id}/dependencies",
            json={"prerequisite_task_id": task_b_id},
            headers=headers
        )
        assert dep2.status_code == 201

        # 4. Circular Dependency Detection:
        # Making Task A depend on Task C would close the loop (A -> B -> C -> A)!
        circ_res = client.post(
            f"/api/v1/tasks/{task_a_id}/dependencies",
            json={"prerequisite_task_id": task_c_id},
            headers=headers
        )
        assert circ_res.status_code in [400, 422]
        assert "Circular dependency detected" in circ_res.text

        # 5. Blocked Task Completion Prevention:
        # Task B depends on Task A. Task A is PENDING. Task B cannot be COMPLETED!
        comp_fail = client.patch(
            f"/api/v1/tasks/{task_b_id}/status",
            json={"status": "COMPLETED"},
            headers=headers
        )
        assert comp_fail.status_code in [400, 422]
        assert "prerequisite tasks are incomplete" in comp_fail.text

        # 6. Authorized Administrative Override on completion
        comp_override = client.patch(
            f"/api/v1/tasks/{task_b_id}/status",
            json={
                "status": "COMPLETED",
                "override_dependencies": True,
                "override_reason": "Emergency sign-off granted by Head of HR."
            },
            headers=headers
        )
        assert comp_override.status_code == 200
        assert comp_override.json()["status"] == "COMPLETED"

        # 7. Remove dependency
        del_dep = client.delete(f"/api/v1/tasks/{task_b_id}/dependencies/{dep1_id}", headers=headers)
        assert del_dep.status_code == 200

    finally:
        db = SessionLocal()
        try:
            ids = [i for i in [task_a_id, task_b_id, task_c_id] if i is not None]
            if ids:
                db.execute(delete(TaskDependency).where((TaskDependency.task_id.in_(ids)) | (TaskDependency.prerequisite_task_id.in_(ids))))
                db.execute(delete(TaskStatusHistory).where(TaskStatusHistory.task_id.in_(ids)))
                db.execute(delete(Notification).where(Notification.task_id.in_(ids)))
                db.execute(delete(ActivityLog).where(ActivityLog.entity_id.in_(ids), ActivityLog.entity_type.in_(["TASK", "TASK_DEPENDENCY"])))
                db.execute(delete(Task).where(Task.id.in_(ids)))
                db.commit()
        finally:
            db.close()


def test_follow_up_workflow_and_acknowledgement():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Schedule follow-up on existing task 1
    sched_payload = {
        "task_id": 1,
        "target_user_id": 2,
        "follow_up_date": str(date.today() + timedelta(days=2)),
        "notes": "Please verify pre-boarding document submission with candidate.",
    }
    create_res = client.post("/api/v1/follow-ups", json=sched_payload, headers=headers)
    assert create_res.status_code == 201
    fu = create_res.json()
    fu_id = fu["id"]
    assert fu["task_id"] == 1
    assert fu["status"] == "PENDING_ACKNOWLEDGEMENT"

    try:
        # 2. List follow-ups
        list_res = client.get(f"/api/v1/follow-ups?task_id=1", headers=headers)
        assert list_res.status_code == 200
        assert len(list_res.json()["items"]) >= 1

        # 3. Acknowledge follow-up
        ack_res = client.patch(
            f"/api/v1/follow-ups/{fu_id}/acknowledge",
            json={"action": "ACKNOWLEDGE", "response_notes": "Candidate contacted, documents expected tomorrow."},
            headers=headers
        )
        assert ack_res.status_code == 200
        assert ack_res.json()["response_received"] is True
        assert ack_res.json()["status"] == "ACKNOWLEDGED"

        # 4. Reschedule follow-up
        resched_res = client.patch(
            f"/api/v1/follow-ups/{fu_id}/acknowledge",
            json={
                "action": "RESCHEDULE",
                "rescheduled_date": str(date.today() + timedelta(days=4)),
                "response_notes": "Postponed awaiting medical clearance."
            },
            headers=headers
        )
        assert resched_res.status_code == 200

    finally:
        db = SessionLocal()
        try:
            db.execute(delete(ActivityLog).where(ActivityLog.entity_id == fu_id, ActivityLog.entity_type == "FOLLOW_UP"))
            db.execute(delete(Notification).where(Notification.task_id == 1, Notification.id > 3450))
            db.execute(delete(FollowUp).where(FollowUp.id == fu_id))
            db.commit()
        finally:
            db.close()


def test_escalation_lifecycle_and_duplicate_prevention():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Use task 1
    esc_payload = {
        "task_id": 1,
        "escalated_to_user_id": 3,
        "escalation_level": 2,
        "reason": "Repeatedly unacknowledged compliance deadline past SLA window.",
    }
    create_res = client.post("/api/v1/escalations", json=esc_payload, headers=headers)
    assert create_res.status_code == 201
    esc = create_res.json()
    esc_id = esc["id"]
    assert esc["status"] == "OPEN"
    assert esc["escalation_level"] == 2

    try:
        # 1. Duplicate Escalation Prevention at same level
        dup_res = client.post("/api/v1/escalations", json=esc_payload, headers=headers)
        assert dup_res.status_code in [400, 422]
        assert "active OPEN escalation already exists" in dup_res.text

        # 2. Resolve Escalation
        resolve_res = client.patch(
            f"/api/v1/escalations/{esc_id}/resolve",
            json={"status": "RESOLVED", "resolution_notes": "Contacted employee and verified all clearances."},
            headers=headers
        )
        assert resolve_res.status_code == 200
        assert resolve_res.json()["status"] == "RESOLVED"
        assert resolve_res.json()["resolved_at"] is not None

    finally:
        db = SessionLocal()
        try:
            db.execute(delete(ActivityLog).where(ActivityLog.entity_id == esc_id, ActivityLog.entity_type == "ESCALATION"))
            db.execute(delete(Notification).where(Notification.task_id == 1, Notification.id > 3450))
            db.execute(delete(Escalation).where(Escalation.id == esc_id))
            db.commit()
        finally:
            db.close()


def test_notifications_and_sla_reminders():
    admin_token = get_token("neha.saxena@auratech.in")
    hr_token = get_token("kavita.iyer@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}
    hr_headers = {"Authorization": f"Bearer {hr_token}"}

    # 1. Trigger SLA reminders
    trigger_res = client.post("/api/v1/reminders/trigger", headers=headers)
    assert trigger_res.status_code == 200
    res_data = trigger_res.json()
    assert res_data["tasks_scanned"] > 0
    assert "Dispatched" in res_data["summary"]

    # 2. List notifications for operational user (HR Executive has assigned notifications)
    notif_res = client.get("/api/v1/notifications?page=1&size=5", headers=hr_headers)
    assert notif_res.status_code == 200
    items = notif_res.json()["items"]
    assert len(items) > 0


def test_reporting_manager_scoping_and_forbidden_access():
    """
    Verify that REPORTING_MANAGER can ONLY view and update tasks belonging to their direct reports.
    Any attempt to view or mutate non-direct report tasks must return HTTP 403 Forbidden.
    """
    mgr_token = get_token("ananya.sharma@auratech.in")  # VP SWE (emp 2, manages 16, 17, 18, 19)
    headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Scoped list tasks
    tasks_res = client.get("/api/v1/tasks?page=1&size=20", headers=headers)
    assert tasks_res.status_code == 200
    mgr_tasks = tasks_res.json()["items"]
    assert len(mgr_tasks) > 0

    # Verify every returned task belongs to manager or direct reports ({2, 16, 17, 18, 19})
    allowed_ids = {2, 16, 17, 18, 19}
    for t in mgr_tasks:
        assert t["employee_id"] in allowed_ids

    # 2. Accessing a task belonging to an employee outside hierarchy (e.g. employee 54 managed by 20)
    db = SessionLocal()
    non_report_task = None
    try:
        non_report_task = db.scalar(select(Task).where(Task.employee_id == 54))
    finally:
        db.close()

    assert non_report_task is not None
    unauth_detail = client.get(f"/api/v1/tasks/{non_report_task.id}", headers=headers)
    assert unauth_detail.status_code == 403
    assert "direct reporting hierarchy" in unauth_detail.text

    # 3. Attempting to update status of non-report task
    unauth_status = client.patch(
        f"/api/v1/tasks/{non_report_task.id}/status",
        json={"status": "IN_PROGRESS"},
        headers=headers
    )
    assert unauth_status.status_code == 403

    # 4. Attempting to schedule follow-up for non-report task
    unauth_fu = client.post(
        "/api/v1/follow-ups",
        json={"task_id": non_report_task.id, "follow_up_date": str(date.today()), "notes": "Unauthorized follow-up"},
        headers=headers
    )
    assert unauth_fu.status_code == 403

    # 5. Attempting to escalate non-report task
    unauth_esc = client.post(
        "/api/v1/escalations",
        json={"task_id": non_report_task.id, "escalated_to_user_id": 3, "escalation_level": 1, "reason": "Unauthorized escalation"},
        headers=headers
    )
    assert unauth_esc.status_code == 403


def test_notification_isolation_and_sla_scan_idempotency():
    """
    Verify:
    1. A user cannot access or mark another user's notifications.
    2. Repeated SLA scans on the same day are idempotent (0 duplicate notifications created).
    """
    admin_token = get_token("neha.saxena@auratech.in")  # User ID 1
    mgr_token = get_token("ananya.sharma@auratech.in")   # User ID 5

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Trigger SLA scan from admin
    first_scan = client.post("/api/v1/reminders/trigger", headers=admin_headers)
    assert first_scan.status_code == 200

    # 2. Second scan on same day must create 0 new notifications (idempotent)
    second_scan = client.post("/api/v1/reminders/trigger", headers=admin_headers)
    assert second_scan.status_code == 200
    assert second_scan.json()["notifications_created"] == 0

    # 3. Notification isolation: Manager listing notifications receives only their own
    mgr_notifs = client.get("/api/v1/notifications?page=1&size=50", headers=mgr_headers)
    assert mgr_notifs.status_code == 200
    for notif in mgr_notifs.json()["items"]:
        assert notif["user_id"] == 5

    # 4. Attempting to mark another user's notification as read returns 404
    # Find a notification belonging to another user (e.g. user 2)
    db = SessionLocal()
    other_notif_id = None
    try:
        other_notif = db.scalar(select(Notification).where(Notification.user_id != 5))
        if other_notif:
            other_notif_id = other_notif.id
    finally:
        db.close()

    if other_notif_id:
        tamper_res = client.patch(f"/api/v1/notifications/{other_notif_id}/read", headers=mgr_headers)
        assert tamper_res.status_code == 404


def test_dependency_and_escalation_role_restrictions():
    """
    Verify:
    1. Reporting Manager cannot add/remove task dependencies (HTTP 403 Forbidden).
    2. Reporting Manager cannot resolve an escalation unless they are the assigned recipient (HTTP 403).
    """
    mgr_token = get_token("ananya.sharma@auratech.in")
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Manager attempts to add a dependency
    dep_res = client.post(
        "/api/v1/tasks/1/dependencies",
        json={"prerequisite_task_id": 2, "dependency_type": "FINISH_TO_START"},
        headers=mgr_headers
    )
    assert dep_res.status_code == 403

    # 2. Manager attempts to delete a dependency
    del_res = client.delete("/api/v1/tasks/1/dependencies/1", headers=mgr_headers)
    assert del_res.status_code == 403

    # 3. Manager attempts to resolve an escalation not assigned to them
    db = SessionLocal()
    esc = None
    try:
        esc = db.scalar(select(Escalation).where(Escalation.status == "OPEN", Escalation.escalated_to_user_id != 5))
    finally:
        db.close()

    if esc:
        unauth_resolve = client.patch(
            f"/api/v1/escalations/{esc.id}/resolve",
            json={"status": "RESOLVED", "resolution_notes": "Attempt by unassigned manager."},
            headers=mgr_headers
        )
        assert unauth_resolve.status_code == 403
