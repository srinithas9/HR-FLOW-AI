import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
VALID_PASSWORD = "Password@123"


def get_token(email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def test_operational_performance_admin():
    """Verify performance analytics returns valid 4 KPIs, 4 charts, and observations for ADMIN."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/analytics/performance?period=12m", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    # 1. Period metadata
    assert data["reporting_period"] == "12m"
    assert "period_start" in data
    assert "period_end" in data
    assert "last_refreshed_at" in data

    # 2. Section 5.1 KPI Summary (all 4 required KPIs)
    kpis = data["kpis"]
    assert "activities_completed" in kpis
    assert "on_time_completion_rate" in kpis
    assert "median_completion_time_days" in kpis
    assert "late_completions" in kpis
    assert kpis["activities_completed"] > 0
    assert 0.0 <= kpis["on_time_completion_rate"] <= 100.0
    assert kpis["median_completion_time_days"] >= 0.0
    assert kpis["late_completions"] >= 0

    # 3. Chart 1: On-Time Completion by Lifecycle Process (all 6 processes)
    by_process = data["on_time_by_process"]
    assert len(by_process) == 6
    process_keys = {p["process_key"] for p in by_process}
    expected_keys = {"ONBOARDING", "PROBATION", "CONFIRMATION", "DOCUMENTATION", "PERFORMANCE", "OFFBOARDING"}
    assert process_keys == expected_keys
    for p in by_process:
        assert p["completed_count"] >= 0
        assert 0.0 <= p["on_time_percentage"] <= 100.0
        assert p["on_time_count"] + p["late_count"] == p["completed_count"]

    # 4. Chart 2: Monthly Operational Completion Trend
    trend = data["monthly_trend"]
    assert len(trend) > 0
    for item in trend:
        assert "month" in item
        assert "month_label" in item
        assert item["completed"] >= 0
        assert item["late"] >= 0
        assert item["on_time"] >= 0

    # 5. Chart 3: Process Turnaround Time
    turnaround = data["turnaround_by_process"]
    assert len(turnaround) == 6
    for t in turnaround:
        assert "process_key" in t
        assert "median_days" in t
        assert t["unit"] == "days"

    # 6. Chart 4: Recorded Reasons for Delays
    delay_reasons = data["delay_reasons"]
    assert isinstance(delay_reasons, list)
    for r in delay_reasons:
        assert "reason" in r
        assert r["affected_activities"] > 0
        assert 0.0 <= r["percentage"] <= 100.0

    # 7. Section 7: Observations ("What Should HR Look At?")
    observations = data["observations"]
    assert isinstance(observations, list)
    for obs in observations:
        assert "title" in obs
        assert "observation" in obs
        assert "metric_or_process" in obs
        assert "why_it_matters" in obs
        assert "recommended_action" in obs
        assert obs["severity"] in ["critical", "warning", "info"]


def test_operational_performance_period_filtering():
    """Verify different reporting periods yield consistent bounded results."""
    token = get_token("neha.saxena@auratech.in")
    for period in ["30d", "90d", "6m", "12m", "all"]:
        resp = client.get(f"/api/v1/analytics/performance?period={period}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["reporting_period"] == period
        assert data["kpis"]["activities_completed"] >= 0


def test_operational_performance_process_filtering():
    """Verify lifecycle process filtering filters the activities appropriately."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/analytics/performance?period=12m&process=ONBOARDING", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["kpis"]["activities_completed"] > 0


def test_drill_down_activity_records():
    """Verify underlying activity records endpoint for chart drill-downs."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/analytics/activities?page=1&size=10", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0

    item = data["items"][0]
    assert "task_id" in item
    assert "task_code" in item
    assert "title" in item
    assert "category" in item
    assert "process_name" in item
    assert "due_date" in item
    assert "assignee_name" in item
    assert "is_late" in item


def test_drill_down_late_filter():
    """Verify drill-down with status=LATE returns only late completed records."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/analytics/activities?status=LATE&page=1&size=10", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["is_late"] is True


def test_unauthorized_analytics_access():
    """Verify analytics endpoints require valid authentication."""
    resp = client.get("/api/v1/analytics/performance")
    assert resp.status_code in [401, 403]

