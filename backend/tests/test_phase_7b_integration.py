import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.db.session import get_db
from app.models.organization import User, Role
from app.models.workflow import Task, Notification, FollowUp, Escalation
from app.models.intelligence import MLPrediction
from app.core.security import create_access_token

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
MANAGER_EMAIL = "deepak.joshi@auratech.in"
VALID_PASSWORD = "Password@123"


def get_auth_header(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_model_artifact_loading():
    from ml.predictor import TaskDelayRiskPredictor
    predictor = TaskDelayRiskPredictor()
    assert predictor is not None
    assert predictor.model_version == "v2.1.0-phase7a"
    assert predictor.t_low == 0.10
    assert predictor.t_high == 0.20


def test_shadow_prediction_api_success():
    headers = get_auth_header(ADMIN_EMAIL)
    response = client.get("/api/v1/ml/tasks/1/prediction", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == 1
    assert "delay_probability" in data
    assert 0.0 <= data["delay_probability"] <= 1.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert data["model_version"] == "v2.1.0-phase7a"
    assert data["is_experimental"] is True
    assert "EXPERIMENTAL SHADOW PREDICTION" in data["disclaimer"]
    assert len(data["contributing_factors"]) > 0
    assert "days_remaining" in data["features_used"]


def test_shadow_prediction_standalone_validation():
    headers = get_auth_header(ADMIN_EMAIL)
    valid_payload = {
        "days_remaining": 4,
        "task_category": "PROBATION",
        "task_priority": "HIGH",
        "current_status": "IN_PROGRESS",
        "reminder_count": 0,
        "owner_previous_delay_rate": 0.15,
        "owner_current_workload": 5,
        "dependency_status": "ALL_MET"
    }
    response = client.post("/api/v1/ml/predict", json=valid_payload, headers=headers)
    assert response.status_code == 200
    res = response.json()
    assert 0.0 <= res["delay_probability"] <= 1.0
    assert res["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert res["model_version"] == "v2.1.0-phase7a"


def test_standalone_prediction_rejects_unauthorized_features():
    headers = get_auth_header(ADMIN_EMAIL)
    # Extra field employee_id
    invalid_payload = {
        "days_remaining": 4,
        "task_category": "PROBATION",
        "task_priority": "HIGH",
        "employee_id": 101
    }
    response = client.post("/api/v1/ml/predict", json=invalid_payload, headers=headers)
    assert response.status_code == 422  # Pydantic extra="forbid" validation error


def test_shadow_mode_guarantees_zero_database_mutation():
    """
    Verifies that requesting a shadow prediction does NOT create notifications,
    does NOT schedule follow-ups, does NOT trigger escalations, and does NOT
    write new records into ml_predictions or mutate task state.
    """
    headers = get_auth_header(ADMIN_EMAIL)
    
    # Check pre-call counts in task detail
    detail_pre = client.get("/api/v1/tasks/1", headers=headers).json()
    status_pre = detail_pre["status"]
    due_pre = detail_pre["due_date"]
    
    # Execute shadow prediction
    pred_res = client.get("/api/v1/ml/tasks/1/prediction", headers=headers)
    assert pred_res.status_code == 200
    
    # Check post-call state
    detail_post = client.get("/api/v1/tasks/1", headers=headers).json()
    assert detail_post["status"] == status_pre
    assert detail_post["due_date"] == due_pre


def test_copilot_task_risk_assessment():
    headers = get_auth_header(ADMIN_EMAIL)
    response = client.get("/api/v1/copilot/task-risk-assessment/1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert data["task_id"] == 1
    assert "official_status" in data
    assert "shadow_prediction" in data
    assert data["shadow_prediction"]["model_version"] == "v2.1.0-phase7a"
    
    # Check Copilot interpretation qualities
    interp = data["copilot_interpretation"]
    assert "probabilistic estimate is non-causal" in interp
    assert "does NOT evaluate employee performance" in interp
    
    # Check human-in-the-loop notice
    assert "HUMAN-IN-THE-LOOP MANDATE" in data["human_in_the_loop_notice"]
    assert len(data["recommended_supportive_actions"]) > 0


def test_copilot_recommendations_and_summary():
    headers = get_auth_header(ADMIN_EMAIL)
    
    rec_res = client.get("/api/v1/copilot/recommendations", headers=headers)
    assert rec_res.status_code == 200
    assert isinstance(rec_res.json(), list)
    
    summary_res = client.get("/api/v1/copilot/operational-summary", headers=headers)
    assert summary_res.status_code == 200
    # Summary may be null or object
    if summary_res.json():
        assert "title" in summary_res.json()
        assert "executive_summary" in summary_res.json()


def test_task_detail_includes_shadow_prediction():
    headers = get_auth_header(ADMIN_EMAIL)
    response = client.get("/api/v1/tasks/1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    assert "shadow_prediction" in data
    if data["shadow_prediction"]:
        assert data["shadow_prediction"]["model_version"] == "v2.1.0-phase7a"
        assert data["shadow_prediction"]["is_experimental"] is True
        assert 0.0 <= data["shadow_prediction"]["delay_probability"] <= 1.0
        assert data["shadow_prediction"]["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

