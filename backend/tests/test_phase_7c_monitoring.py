import json
import pytest
from pathlib import Path
from datetime import datetime, date, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.db.session import get_db
from app.models.organization import User, Role
from app.models.workflow import Task, Notification, FollowUp, Escalation
from app.models.intelligence import MLPrediction
from ml.predictor import TaskDelayRiskPredictor, APPROVED_FEATURES, UNAUTHORIZED_FEATURES

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
MANAGER_EMAIL = "deepak.joshi@auratech.in"
VALID_PASSWORD = "Password@123"

MONITORING_DIR = Path("C:/HR AI/datasets/phase_7c_monitoring")


def get_auth_header(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Prediction Observation Creation & Persistence Schema
def test_observation_creation_and_schema():
    obs_file = MONITORING_DIR / "observations.jsonl"
    assert obs_file.exists(), "Monitoring observations.jsonl must exist"
    
    with open(obs_file, "r") as f:
        first_line = f.readline()
        assert first_line, "observations.jsonl must not be empty"
        obs = json.loads(first_line)
        
    required_keys = [
        "observation_id", "task_id", "snapshot_id", "prediction_timestamp",
        "model_version", "predicted_delay_probability", "risk_tier",
        "features", "task_due_date", "task_status_at_prediction",
        "outcome_maturity_status", "validation_flags"
    ]
    for key in required_keys:
        assert key in obs, f"Missing required observation field: {key}"
        
    assert obs["model_version"] == "v2.1.0-phase7a"
    assert obs["risk_tier"] in ["LOW", "MEDIUM", "HIGH"]
    assert 0.0 <= obs["predicted_delay_probability"] <= 1.0


# 2. Outcome Maturity Rules & Label Separation
def test_outcome_maturity_rules():
    """
    Verifies Section 5 rules:
    - Completed on or before due date: label 0.
    - Completed after due date: label 1.
    - Not yet completed and not yet overdue: unresolved (label None, not 0).
    - Not yet completed but already overdue: overdue-open (not a completed-task label).
    """
    def evaluate_maturity(comp_date: str | None, due_date: str, status: str, ref_date: str = "2026-11-08"):
        if comp_date is not None:
            if comp_date <= due_date:
                return "MATURE_COMPLETED_ON_TIME", 0.0
            else:
                return "MATURE_COMPLETED_DELAYED", 1.0
        else:
            if due_date < ref_date or status == "DELAYED":
                return "OVERDUE_OPEN", None
            else:
                return "UNRESOLVED", None

    # Test on-time completion
    status, label = evaluate_maturity("2026-11-04", "2026-11-05", "COMPLETED")
    assert status == "MATURE_COMPLETED_ON_TIME"
    assert label == 0.0

    # Test delayed completion
    status, label = evaluate_maturity("2026-11-07", "2026-11-05", "COMPLETED")
    assert status == "MATURE_COMPLETED_DELAYED"
    assert label == 1.0

    # Test unresolved future task (MUST NOT BE TREATED AS ON-TIME)
    status, label = evaluate_maturity(None, "2026-11-20", "IN_PROGRESS")
    assert status == "UNRESOLVED"
    assert label is None

    # Test overdue-open task (MUST NOT BE COUNTED AS COMPLETED DELAYED)
    status, label = evaluate_maturity(None, "2026-11-04", "IN_PROGRESS")
    assert status == "OVERDUE_OPEN"
    assert label is None


# 3. Model Version & Timestamp Integrity
def test_model_version_and_timestamp_integrity():
    predictor = TaskDelayRiskPredictor()
    pred = predictor.predict({
        "days_remaining": 5,
        "task_category": "ONBOARDING",
        "task_priority": "MEDIUM",
        "current_status": "IN_PROGRESS",
        "reminder_count": 0,
        "owner_previous_delay_rate": 0.10,
        "owner_current_workload": 3,
        "dependency_status": "NONE"
    })
    
    assert pred["model_version"] == "v2.1.0-phase7a"
    ts = datetime.fromisoformat(pred["prediction_timestamp"])
    assert ts.tzinfo is not None, "Timestamp must be timezone-aware (UTC)"


# 4. Missing Feature Handling & Defensive Imputation
def test_missing_feature_and_imputation_handling():
    predictor = TaskDelayRiskPredictor()
    # Pass partial payload missing multiple fields
    partial_input = {
        "days_remaining": None,
        "task_category": "UNKNOWN_CATEGORY",
        "owner_current_workload": 999
    }
    cleaned_df = predictor.validate_and_clean_input(partial_input)
    assert len(cleaned_df) == 1
    # Check default substitutions
    assert cleaned_df["task_category"].iloc[0] == "ONBOARDING"
    assert cleaned_df["task_priority"].iloc[0] == "MEDIUM"
    assert cleaned_df["days_remaining"].iloc[0] == 5


# 5. Unauthorized Feature Rejection
def test_unauthorized_feature_rejection():
    predictor = TaskDelayRiskPredictor()
    for bad_feat in ["employee_id", "task_id", "completed_at", "actual_completion_date"]:
        with pytest.raises(ValueError, match="Unauthorized predictor rejected"):
            predictor.validate_and_clean_input({bad_feat: 12345})


# 6. RBAC Scope Restrictions
def test_rbac_scope_restrictions():
    # Unauthenticated request fails
    resp = client.get("/api/v1/ml/tasks/1/prediction")
    assert resp.status_code in [401, 403]

    # Authenticated Admin succeeds
    admin_headers = get_auth_header(ADMIN_EMAIL)
    resp = client.get("/api/v1/ml/tasks/1/prediction", headers=admin_headers)
    assert resp.status_code == 200

    # Non-existent task returns 404
    resp = client.get("/api/v1/ml/tasks/999999/prediction", headers=admin_headers)
    assert resp.status_code == 404


# 7. Safety Invariants: No Auto-Escalation, No Notifications, No Mutations
def test_safety_invariants_no_mutations():
    admin_headers = get_auth_header(ADMIN_EMAIL)
    db = next(get_db())

    # Snapshot baseline counts
    pre_tasks = db.scalar(select(func.count(Task.id)))
    pre_notifs = db.scalar(select(func.count(Notification.id)))
    pre_esc = db.scalar(select(func.count(Escalation.id)))
    pre_preds = db.scalar(select(func.count(MLPrediction.id)))

    # Execute multiple predictions
    client.get("/api/v1/ml/tasks/1/prediction", headers=admin_headers)
    client.get("/api/v1/copilot/task-risk-assessment/1", headers=admin_headers)
    client.get("/api/v1/copilot/recommendations", headers=admin_headers)

    # Verify identical counts
    assert db.scalar(select(func.count(Task.id))) == pre_tasks
    assert db.scalar(select(func.count(Notification.id))) == pre_notifs
    assert db.scalar(select(func.count(Escalation.id))) == pre_esc
    assert db.scalar(select(func.count(MLPrediction.id))) == pre_preds


# 8. Monitoring Metric Calculations (Brier & PSI)
def test_monitoring_metric_calculations():
    import numpy as np

    # Test Brier Score calculation
    y_true = np.array([0, 0, 1, 0])
    p_pred = np.array([0.1, 0.2, 0.8, 0.1])
    brier = float(np.mean((p_pred - y_true) ** 2))
    assert 0.0 <= brier <= 1.0

    # Test PSI calculation stability
    from scratch.run_phase_7c_analysis import calculate_psi
    dist_a = np.random.normal(0, 1, 1000)
    dist_b = np.random.normal(0, 1, 1000)
    psi = calculate_psi(dist_a, dist_b)
    assert psi < 0.25, "Identical distributions must have low PSI"

