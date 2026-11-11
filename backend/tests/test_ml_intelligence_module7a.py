import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
VALID_PASSWORD = "Password@123"


def get_token(email: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return resp.json()["access_token"]


def test_ml_intelligence_overview_admin():
    """Verify overview returns valid KPI counts for ADMIN user."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/ml-intelligence/overview", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    assert "high_risk_tasks" in data
    assert "needs_attention" in data
    assert "overdue_tasks" in data
    assert "upcoming_at_risk_deadlines" in data
    assert "total_active_tasks" in data
    assert data["total_active_tasks"] > 0
    assert data["high_risk_tasks"] >= 0
    assert data["needs_attention"] >= 0


def test_ml_intelligence_bottlenecks_summary():
    """Verify bottlenecks summary groups tasks into verified operational categories."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/ml-intelligence/bottlenecks", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    assert "categories" in data
    assert "total_bottlenecked_tasks" in data
    categories = {c["id"]: c["count"] for c in data["categories"]}
    assert "WAITING_RESPONSE" in categories
    assert "PENDING_DEPENDENCY" in categories
    assert "WORKLOAD_PRESSURE" in categories
    assert "REPEATED_REMINDERS" in categories
    assert "STALLED_PROGRESS" in categories
    assert "LIFECYCLE_MILESTONE" in categories


def test_ml_intelligence_tasks_list_and_filters():
    """Verify tasks list returns real-time risk predictions, attention priority, and supports filters."""
    token = get_token("neha.saxena@auratech.in")
    resp = client.get("/api/v1/ml-intelligence/tasks?page=1&size=10", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    assert "items" in data
    assert "total" in data
    assert len(data["items"]) > 0

    first_item = data["items"][0]
    assert "task_id" in first_item
    assert "task_code" in first_item
    assert "title" in first_item
    assert "delay_probability" in first_item
    assert "risk_level" in first_item
    assert first_item["risk_level"] in ["HIGH", "MEDIUM", "LOW"]
    assert "hr_attention_priority" in first_item
    assert first_item["hr_attention_priority"] in ["CRITICAL", "NEEDS_ATTENTION", "MONITOR"]
    assert "main_concern" in first_item
    assert "bottlenecks" in first_item
    assert isinstance(first_item["bottlenecks"], list)

    # Test filtering by risk level
    resp_high = client.get("/api/v1/ml-intelligence/tasks?risk_level=HIGH", headers={"Authorization": f"Bearer {token}"})
    assert resp_high.status_code == 200
    high_items = resp_high.json()["items"]
    for item in high_items:
        assert item["risk_level"] == "HIGH"


def test_ml_intelligence_task_assessment_detail():
    """Verify task detailed assessment returns verified operational evidence and suggestions."""
    token = get_token("neha.saxena@auratech.in")
    # Fetch first task to test
    list_resp = client.get("/api/v1/ml-intelligence/tasks?size=1", headers={"Authorization": f"Bearer {token}"})
    first_task_id = list_resp.json()["items"][0]["task_id"]

    resp = client.get(f"/api/v1/ml-intelligence/tasks/{first_task_id}/assessment", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()

    assert data["task_id"] == first_task_id
    assert "model_prediction" in data
    assert "delay_probability" in data["model_prediction"]
    assert "risk_level" in data["model_prediction"]
    assert "advisory_note" in data["model_prediction"]
    assert "operational_facts" in data
    assert "dependencies" in data["operational_facts"]
    assert "follow_ups" in data["operational_facts"]
    assert "escalations" in data["operational_facts"]
    assert "owner_workload" in data["operational_facts"]
    assert "observations" in data
    assert "suggested_next_steps" in data
    assert "available_actions" in data
    assert len(data["suggested_next_steps"]) > 0


def test_ml_intelligence_zero_database_mutation():
    """Verify calling ML intelligence endpoints does NOT alter task or employee state in the database."""
    token = get_token("neha.saxena@auratech.in")
    list_resp = client.get("/api/v1/ml-intelligence/tasks?size=5", headers={"Authorization": f"Bearer {token}"})
    initial_tasks = list_resp.json()["items"]
    first_task = initial_tasks[0]

    # Run assessment
    assess_resp = client.get(f"/api/v1/ml-intelligence/tasks/{first_task['task_id']}/assessment", headers={"Authorization": f"Bearer {token}"})
    assert assess_resp.status_code == 200

    # Fetch task detail through standard tasks API to confirm zero status/due_date mutation
    task_resp = client.get(f"/api/v1/tasks/{first_task['task_id']}", headers={"Authorization": f"Bearer {token}"})
    assert task_resp.status_code == 200
    task_data = task_resp.json()
    assert task_data["status"] == first_task["status"]
    assert task_data["due_date"] == first_task["due_date"]

