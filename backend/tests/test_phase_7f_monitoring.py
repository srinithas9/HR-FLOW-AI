import json
import pytest
import numpy as np
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, func

from app.main import app
from app.db.session import get_db
from app.models.organization import User, Role, Employee
from app.models.workflow import Task, Notification, FollowUp, Escalation
from app.models.intelligence import MLPrediction
from ml.predictor import TaskDelayRiskPredictor

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
MANAGER_EMAIL = "deepak.joshi@auratech.in"
VALID_PASSWORD = "Password@123"

PHASE_7C_DIR = Path("C:/HR AI/datasets/phase_7c_monitoring")
PHASE_7E_DIR = Path("C:/HR AI/datasets/phase_7e_monitoring")
PHASE_7F_DIR = Path("C:/HR AI/datasets/phase_7f_monitoring")
ARTIFACTS_DIR = Path("C:/HR AI/ml/artifacts/phase_7a")


def get_auth_header(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Model Artifact Immutability Audit
def test_phase_7f_artifact_immutability():
    expected_artifacts = {
        "calibrated_model.joblib": "7ed9349075de3e1acf54326a39f06a916ff3296b6874b7174bb4d1d6ceb25efe",
        "base_model.joblib": "e6594dd15e713ddfbe4ece45914ca53753c00d894be5e3e3a514478882c648ee",
        "preprocessor.joblib": "45372d4e54e218797d8272a45e40adaa4f86c01f40d0f2b7db186dec18f3e402",
        "feature_schema.json": "9bae0c9e5ddf22d43540cc9d979ebd59b996980fda0926833b70a74289a24818",
        "model_metadata.json": "b20f370c0e5f75f3f2751f0a488fc6ee53d22b5bd31a609c9c46b477cf3416e6",
    }
    for fname, exp_hash in expected_artifacts.items():
        fpath = ARTIFACTS_DIR / fname
        assert fpath.exists(), f"Artifact {fname} missing"
        hasher = hashlib.sha256()
        with open(fpath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        assert hasher.hexdigest() == exp_hash, f"SHA-256 mismatch for {fname}"


# 2. Canonical Telemetry Preservation & Append-Only Health
def test_phase_7f_canonical_telemetry_preservation_and_health():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    hasher = hashlib.sha256()
    with open(obs_file, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    assert hasher.hexdigest() == "fb54e7c2d4283cce88373f7230de43a8bf89d4f7dc64f04d608f9f5433ec5411"

    # Verify summary JSON
    summary_path = PHASE_7F_DIR / "phase_7f_monitoring_summary.json"
    assert summary_path.exists(), "Phase 7F summary JSON missing"
    with open(summary_path, "r") as f:
        data = json.load(f)

    health = data["telemetry_health_audit"]
    assert health["pipeline_state"] == "HEALTHY_QUIESCENT"
    assert health["pipeline_state_classification"] == "ZERO_NEW_OPERATIONAL_EVENTS"
    assert health["collection_errors_count"] == 0
    assert health["duplicate_ingestions_detected"] == 0


# 3. HIGH-Risk Workload Calculation & Department Distribution Skew
def test_phase_7f_high_risk_workload_qualification():
    summary_path = PHASE_7F_DIR / "phase_7f_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    workload = data["high_risk_workload_qualification"]
    assert workload["total_unique_high_risk_tasks"] == 36
    assert workload["weekly_equivalent_run_rate"] == 31.5
    assert "uniform accrual" in workload["qualified_label"].lower()
    
    # Department skew: QA + SWE account for >= 80%
    skew = workload["department_distribution_skew"]
    qa_share = skew["DEPT_QA"]["share"]
    swe_share = skew["DEPT_SWE"]["share"]
    assert qa_share + swe_share > 0.80, "QA and SWE must account for > 80% of HIGH-risk burden"
    assert skew["DEPT_QA"]["count"] == 20
    assert skew["DEPT_SWE"]["count"] == 9


# 4. Outcome Maturity Accounting & Overdue-Open Separation
def test_phase_7f_outcome_maturity_accounting():
    summary_path = PHASE_7F_DIR / "phase_7f_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    maturity = data["outcome_maturity_accounting"]
    assert maturity["unique_tasks_evaluated"] == 247
    assert maturity["snapshots_evaluated"] == 494
    assert maturity["mature_completed_on_time"] == 11
    assert maturity["mature_completed_delayed"] == 0
    assert maturity["overdue_open_tasks"] == 3
    assert maturity["unresolved_ongoing_tasks"] == 233
    assert set(maturity["overdue_open_task_ids"]) == {3018, 3072, 3077}


# 5. Discrimination Metric Undefinability & Brier Baseline
def test_phase_7f_discrimination_undefinability_and_brier():
    summary_path = PHASE_7F_DIR / "phase_7f_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    perf = data["model_performance_evaluation"]
    assert "UNDEFINED" in perf["discrimination_metrics"]["roc_auc"]
    assert "UNDEFINED" in perf["discrimination_metrics"]["pr_auc"]
    assert perf["calibration_and_loss"]["prevalence_baseline_brier"] == 0.0000
    assert perf["calibration_and_loss"]["task_level_brier_score"] == 0.0259


# 6. Database Non-Mutation Live Audit
def test_phase_7f_database_non_mutation_live():
    try:
        db = next(get_db())
        task_cnt = db.scalar(select(func.count(Task.id)))
        emp_cnt = db.scalar(select(func.count(Employee.id)))
        user_cnt = db.scalar(select(func.count(User.id)))
        pred_cnt = db.scalar(select(func.count(MLPrediction.id)))
        notif_cnt = db.scalar(select(func.count(Notification.id)))
        esc_cnt = db.scalar(select(func.count(Escalation.id)))

        assert task_cnt == 3300
        assert emp_cnt == 200
        assert user_cnt == 23
        assert pred_cnt == 3300
        assert notif_cnt == 3450
        assert esc_cnt == 360
    except Exception as e:
        if "10013" in str(e) or "Permission denied" in str(e):
            pytest.skip(f"PostgreSQL socket restricted by sandbox: {e}")
        raise


# 7. Copilot & ML Endpoint Non-Autonomy Scoping
def test_phase_7f_copilot_and_ml_endpoints_scoping():
    admin_headers = get_auth_header(ADMIN_EMAIL)
    
    # Task risk prediction endpoint
    pred_res = client.get("/api/v1/ml/tasks/3018/prediction", headers=admin_headers)
    assert pred_res.status_code == 200
    pdata = pred_res.json()
    assert pdata["model_version"] == "v2.1.0-phase7a"
    assert "risk_level" in pdata
    assert pdata["risk_level"] in ["LOW", "MEDIUM", "HIGH"]
    assert 0.0 <= pdata["delay_probability"] <= 1.0

    # Copilot assessment endpoint
    copilot_res = client.get("/api/v1/copilot/task-risk-assessment/3018", headers=admin_headers)
    assert copilot_res.status_code == 200
    cdata = copilot_res.json()
    assert "shadow_prediction" in cdata
    assert "copilot_interpretation" in cdata
    assert "human_in_the_loop_notice" in cdata
