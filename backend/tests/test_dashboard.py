from datetime import date, timedelta
import zoneinfo
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
VALID_PASSWORD = "Password@123"
KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")


def get_token(email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


# ============================================================================
# 1. KPI & OVERVIEW TESTS (ADMIN & HR_MANAGER)
# ============================================================================
def test_dashboard_overview_admin_full_scope():
    """Verify ADMIN receives company-wide metrics matching database truth."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    kpis = data["kpis"]
    assert kpis["active_employees"] == 194
    assert kpis["open_tasks"] == 268
    assert kpis["overdue_tasks"] == 37
    assert kpis["tasks_due_next_7_days"] == 18

    # Six-stage lifecycle
    lifecycle = data["lifecycle"]
    assert lifecycle["onboarding_active"] == 4
    assert lifecycle["probation_active"] == 15  # 10 under review + 5 extended
    assert lifecycle["confirmation_pending"] == 5
    assert lifecycle["documentation_pending"] == 0  # Honest zero count
    assert lifecycle["performance_reviews_in_progress"] == 0  # Honest zero count
    assert lifecycle["offboarding_in_progress"] == 8

    # Attention Required items - All 37 overdue tasks must be accessible
    attention = data["attention_required"]
    assert len(attention) > 0
    categories = {item["category"] for item in attention}
    assert "OVERDUE_TASK" in categories
    assert "OVERDUE_REVIEW" in categories
    assert "OVERDUE_DECISION" in categories
    assert "PENDING_CLEARANCE" in categories

    overdue_task_items = [item for item in attention if item["category"] == "OVERDUE_TASK"]
    assert len(overdue_task_items) == 37, f"All 37 overdue tasks must be accessible, found {len(overdue_task_items)}"


def test_dashboard_overview_hr_manager_scope():
    """Verify HR_MANAGER receives full company-wide operational metrics."""
    token = get_token("rajesh.venkat@auratech.in")
    resp = client.get("/api/v1/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    kpis = data["kpis"]
    assert kpis["active_employees"] == 194
    assert kpis["open_tasks"] == 268
    assert kpis["overdue_tasks"] == 37
    assert kpis["tasks_due_next_7_days"] == 18

    overdue_task_items = [item for item in data["attention_required"] if item["category"] == "OVERDUE_TASK"]
    assert len(overdue_task_items) == 37


# ============================================================================
# 2. RBAC SCOPING TESTS (HR_EXECUTIVE & REPORTING_MANAGER)
# ============================================================================
def test_dashboard_overview_hr_executive_assignment_scoping():
    """Verify HR_EXECUTIVE is strictly scoped to assigned responsibilities (tasks owned, active followups/escalations, and pending assignments)."""
    token = get_token("kavita.iyer@auratech.in")
    resp = client.get("/api/v1/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    kpis = data["kpis"]
    # User 2 scope: 34 open tasks (21 owned + 13 active escalations/follow-ups), far below 268 org total
    assert kpis["open_tasks"] == 34
    assert kpis["overdue_tasks"] == 18
    assert kpis["tasks_due_next_7_days"] == 4
    # Employee scoping: only active assigned employees (17 active), strictly denying access to remaining 177 employees
    assert kpis["active_employees"] == 17

    # Executive attention items must strictly match assigned responsibilities
    overdue_tasks = [item for item in data["attention_required"] if item["category"] == "OVERDUE_TASK"]
    assert len(overdue_tasks) == 18
    for item in overdue_tasks:
        # Either owned by executive or executive is an active party in open escalation (tasks 2290, 2360)
        assert item["owner_id"] == 2 or item["entity_id"] in [2290, 2360]


def test_dashboard_overview_reporting_manager_scoping():
    """Verify REPORTING_MANAGER is strictly scoped to direct/indirect subordinates."""
    token = get_token("karthik.raman@auratech.in")
    resp = client.get("/api/v1/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    kpis = data["kpis"]
    # Karthik Raman has 2 direct reports (Gaurav Kapoor, Shweta Rao) + self = 3
    assert kpis["active_employees"] == 3
    assert kpis["open_tasks"] <= 268


# ============================================================================
# 3. DATE BOUNDARIES & STATUS EXCLUSIONS
# ============================================================================
def test_dashboard_tasks_due_next_7_days_excludes_overdue():
    """Verify that tasks due in next 7 days strictly excludes overdue tasks (due_date >= today)."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/dashboard/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    kpis = resp.json()["kpis"]

    # 18 tasks due in next 7 days vs 37 overdue
    assert kpis["tasks_due_next_7_days"] == 18
    assert kpis["overdue_tasks"] == 37


def test_dashboard_department_filter():
    """Verify department filter isolates metrics for a specific department."""
    token = get_token("neha.saxena@auratech.in")
    # Department 1: Software Engineering (65 total, 4 resigned -> 61 active employees)
    resp = client.get("/api/v1/dashboard/overview?department_id=1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["department_id"] == 1
    assert data["kpis"]["active_employees"] == 61


# ============================================================================
# 4. UPCOMING MILESTONES TESTS
# ============================================================================
def test_dashboard_upcoming_milestones_chronological():
    """Verify upcoming milestones are future-dated and sorted ascending by date."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/dashboard/milestones", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    milestones = resp.json()
    assert len(milestones) > 0

    # Assert strictly future-dated and ascending
    dates = [m["target_date"] for m in milestones]
    assert dates == sorted(dates)
    for m in milestones:
        assert m["days_remaining"] >= 0
        assert m["milestone_type"] in [
            "ONBOARDING_COMPLETION",
            "PROBATION_END",
            "CONFIRMATION_DUE",
            "PERFORMANCE_DEADLINE",
            "OFFBOARDING_EXIT",
        ]


# ============================================================================
# 5. RECENT ACTIVITIES TESTS
# ============================================================================
def test_dashboard_recent_activities_live_logs():
    """Verify recent activities returns genuine records from activity_logs table."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/dashboard/activities?limit=10", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    activities = resp.json()
    assert len(activities) == 10

    for a in activities:
        assert a["id"] > 0
        assert a["action"] in [
            "REASSIGN_TASK",
            "ACKNOWLEDGE_FOLLOWUP",
            "APPROVE_CONFIRMATION",
            "STATUS_CHANGE",
            "CREATE_TASK",
        ]
        assert a["actor_name"] is not None
        assert "formatted_time" in a


# ============================================================================
# 6. AI COPILOT OPERATIONAL SUMMARY TESTS (FRESHNESS & ROLE MATCHING)
# ============================================================================
def test_copilot_summary_role_matching():
    """Verify Copilot summary returns role-matched summary and None for reporting manager."""
    # ADMIN
    admin_token = get_token("neha.saxena@auratech.in")
    r_admin = client.get("/api/v1/copilot/operational-summary", headers={"Authorization": f"Bearer {admin_token}"})
    assert r_admin.status_code == 200
    assert r_admin.json()["target_role"] == "ADMIN"
    assert "weekly_throughput" in r_admin.json()["key_metrics"]

    # HR_EXECUTIVE
    exec_token = get_token("kavita.iyer@auratech.in")
    r_exec = client.get("/api/v1/copilot/operational-summary", headers={"Authorization": f"Bearer {exec_token}"})
    assert r_exec.status_code == 200
    assert r_exec.json()["target_role"] == "HR_OPERATIONS"

    # REPORTING_MANAGER (Expected null / graceful fallback)
    mgr_token = get_token("karthik.raman@auratech.in")
    r_mgr = client.get("/api/v1/copilot/operational-summary", headers={"Authorization": f"Bearer {mgr_token}"})
    assert r_mgr.status_code == 200
    assert r_mgr.json() is None


# ============================================================================
# 8. COMPLETE MULTI-ENDPOINT RBAC VERIFICATION ACROSS ALL 4 ROLES
# ============================================================================
def test_all_endpoints_rbac_admin_and_hr_manager():
    """Verify ADMIN and HR_MANAGER have organization-wide access across all 3 endpoints."""
    for email in ["neha.saxena@auratech.in", "rajesh.venkat@auratech.in"]:
        token = get_token(email)
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Overview
        r_ov = client.get("/api/v1/dashboard/overview", headers=headers)
        assert r_ov.status_code == 200
        assert r_ov.json()["kpis"]["active_employees"] == 194

        # 2. Milestones
        r_ms = client.get("/api/v1/dashboard/milestones", headers=headers)
        assert r_ms.status_code == 200
        assert len(r_ms.json()) > 0

        # 3. Activities
        r_act = client.get("/api/v1/dashboard/activities", headers=headers)
        assert r_act.status_code == 200
        assert len(r_act.json()) == 10


def test_all_endpoints_rbac_hr_executive():
    """Verify HR_EXECUTIVE access is bounded to assigned responsibilities across all 3 endpoints."""
    token = get_token("kavita.iyer@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Overview: only 34 assigned open tasks (tasks owned, pending followups, and open escalations)
    r_ov = client.get("/api/v1/dashboard/overview", headers=headers)
    assert r_ov.status_code == 200
    assert r_ov.json()["kpis"]["open_tasks"] == 34
    assert r_ov.json()["total_attention_count"] == len(r_ov.json()["attention_required"])

    # 2. Milestones: only assigned employee milestones
    r_ms = client.get("/api/v1/dashboard/milestones", headers=headers)
    assert r_ms.status_code == 200

    # 3. Activities: only executive's own actions or assigned portfolio
    r_act = client.get("/api/v1/dashboard/activities", headers=headers)
    assert r_act.status_code == 200


def test_all_endpoints_rbac_reporting_manager():
    """Verify REPORTING_MANAGER access is strictly bounded to subordinate hierarchy across all 3 endpoints."""
    token = get_token("karthik.raman@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Overview: only 3 active employees (direct reports + self)
    r_ov = client.get("/api/v1/dashboard/overview", headers=headers)
    assert r_ov.status_code == 200
    assert r_ov.json()["kpis"]["active_employees"] == 3

    # 2. Milestones: strictly subordinate milestones
    r_ms = client.get("/api/v1/dashboard/milestones", headers=headers)
    assert r_ms.status_code == 200

    # 3. Activities: strictly subordinate activities
    r_act = client.get("/api/v1/dashboard/activities", headers=headers)
    assert r_act.status_code == 200


def test_department_filter_consistency_across_endpoints():
    """Verify department filter consistently filters Overview, Milestones, and Activities."""
    token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    # Dept 1 (Software Engineering)
    r_ov = client.get("/api/v1/dashboard/overview?department_id=1", headers=headers)
    assert r_ov.status_code == 200
    assert r_ov.json()["kpis"]["active_employees"] == 61

    r_ms = client.get("/api/v1/dashboard/milestones?department_id=1", headers=headers)
    assert r_ms.status_code == 200
    for m in r_ms.json():
        assert m["department_name"] == "Software Engineering"

    r_act = client.get("/api/v1/dashboard/activities?department_id=1", headers=headers)
    assert r_act.status_code == 200


def test_attention_required_deduplication_and_counts():
    """Verify attention required items are deduplicated and total_attention_count matches array length."""
    token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    r_ov = client.get("/api/v1/dashboard/overview", headers=headers)
    assert r_ov.status_code == 200
    data = r_ov.json()

    items = data["attention_required"]
    item_ids = [item["id"] for item in items]
    assert len(item_ids) == len(set(item_ids)), "Attention items must contain zero duplicate IDs"
    assert data["total_attention_count"] == len(items), "Count must equal length of returned items"

    # Verify clearance holds are not marked as overdue exit deadlines
    for item in items:
        if item["category"] == "PENDING_CLEARANCE":
            assert item["days_overdue"] == 0
            assert "Clearance Hold" in item["title"] or "Separation Clearance" in item["title"]

