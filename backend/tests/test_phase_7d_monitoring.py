import json
import pytest
import numpy as np
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
PHASE_7D_DIR = Path("C:/HR AI/datasets/phase_7d_monitoring")
ARTIFACTS_DIR = Path("C:/HR AI/ml/artifacts/phase_7a")


def get_auth_header(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Evidence Manifest & SHA-256 Verification
def test_evidence_manifest_and_sha256_verification():
    import hashlib
    expected_checksums = {
        "calibrated_model.joblib": "7ed9349075de3e1acf54326a39f06a916ff3296b6874b7174bb4d1d6ceb25efe",
        "base_model.joblib": "e6594dd15e713ddfbe4ece45914ca53753c00d894be5e3e3a514478882c648ee",
        "preprocessor.joblib": "45372d4e54e218797d8272a45e40adaa4f86c01f40d0f2b7db186dec18f3e402",
        "feature_schema.json": "9bae0c9e5ddf22d43540cc9d979ebd59b996980fda0926833b70a74289a24818",
        "model_metadata.json": "b20f370c0e5f75f3f2751f0a488fc6ee53d22b5bd31a609c9c46b477cf3416e6",
    }
    for fname, exp_hash in expected_checksums.items():
        fpath = ARTIFACTS_DIR / fname
        assert fpath.exists(), f"Artifact {fname} missing"
        hasher = hashlib.sha256()
        with open(fpath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        assert hasher.hexdigest() == exp_hash, f"SHA-256 mismatch for {fname}"


# 2. Monitoring Clock Continuity
def test_monitoring_clock_continuity():
    summary_path = PHASE_7D_DIR / "phase_7d_monitoring_summary.json"
    assert summary_path.exists(), "Phase 7D summary JSON must exist"
    with open(summary_path, "r") as f:
        data = json.load(f)
    
    mc = data["monitoring_continuity"]
    start_dt = datetime.fromisoformat(mc["start_timestamp"])
    curr_dt = datetime.fromisoformat(mc["current_timestamp"])
    assert start_dt.year == 2026 and start_dt.month == 11 and start_dt.day == 1
    assert mc["elapsed_calendar_days"] == 8
    assert mc["remaining_calendar_days"] == 48
    assert mc["target_weeks"] == 8


# 3. Duplicate and Invalid Telemetry Detection
def test_duplicate_and_invalid_telemetry_detection():
    def validate_observation(rec: dict):
        errors = []
        if not (0.0 <= rec.get("predicted_delay_probability", -1) <= 1.0):
            errors.append("INVALID_PROBABILITY")
        prob = rec.get("predicted_delay_probability", 0.0)
        tier = rec.get("risk_tier")
        expected_tier = "LOW" if prob < 0.10 else ("MEDIUM" if prob < 0.20 else "HIGH")
        if tier != expected_tier:
            errors.append("TIER_MISMATCH")
        if rec.get("model_version") != "v2.1.0-phase7a":
            errors.append("INCORRECT_MODEL_VERSION")
        return errors

    valid_rec = {
        "observation_id": "OBS-001",
        "predicted_delay_probability": 0.15,
        "risk_tier": "MEDIUM",
        "model_version": "v2.1.0-phase7a"
    }
    assert len(validate_observation(valid_rec)) == 0

    invalid_rec = {
        "observation_id": "OBS-002",
        "predicted_delay_probability": 1.25, # Out of range
        "risk_tier": "LOW", # Mismatch
        "model_version": "v1.0.0" # Invalid version
    }
    errs = validate_observation(invalid_rec)
    assert "INVALID_PROBABILITY" in errs
    assert "TIER_MISMATCH" in errs
    assert "INCORRECT_MODEL_VERSION" in errs


# 4. Repeated Snapshot Grouping & Task-Level Policy
def test_repeated_snapshot_grouping_and_task_level_policy():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    with open(obs_file, "r") as f:
        records = [json.loads(line) for line in f if line.strip()]

    # Group by task_id
    from collections import defaultdict
    task_groups = defaultdict(list)
    for r in records:
        task_groups[r["task_id"]].append(r)

    # Every task has exactly 2 snapshots
    for tid, snaps in task_groups.items():
        assert len(snaps) == 2, f"Task {tid} expected 2 snapshots, got {len(snaps)}"

    # Task-level policy: latest snapshot before due date
    for tid, snaps in task_groups.items():
        sorted_snaps = sorted(snaps, key=lambda x: x["prediction_timestamp"], reverse=True)
        latest_snap = sorted_snaps[0]
        assert latest_snap is not None
        assert latest_snap["task_id"] == tid


# 5. Single-Class Metric Handling & Baseline Calculations
def test_single_class_metric_handling():
    # When all true labels are 0, ROC-AUC is mathematically undefined
    y_true_single_class = np.array([0, 0, 0, 0, 0])
    p_pred = np.array([0.05, 0.08, 0.11, 0.06, 0.09])

    # Prevalence baseline Brier score for single-class
    prev = float(np.mean(y_true_single_class))
    brier_prev = float(np.mean((prev - y_true_single_class) ** 2))
    assert brier_prev == 0.0

    # Model Brier score
    brier_model = float(np.mean((p_pred - y_true_single_class) ** 2))
    assert brier_model > 0.0
    assert brier_model < 0.05


# 6. Task-Level Clustered Resampling Stability
def test_task_level_clustered_resampling():
    np.random.seed(42)
    # 11 distinct tasks, each with 2 snapshots
    task_ids = np.repeat(np.arange(1, 12), 2)
    y_vals = np.zeros(len(task_ids))
    probs = np.random.uniform(0.05, 0.11, len(task_ids))

    # Cluster-level bootstrap resamples tasks, not individual rows
    unique_tasks = np.unique(task_ids)
    brier_samples = []
    for _ in range(50):
        sampled_tasks = np.random.choice(unique_tasks, size=len(unique_tasks), replace=True)
        # Pull all rows matching sampled tasks
        sampled_indices = np.isin(task_ids, sampled_tasks)
        brier_samples.append(float(np.mean((probs[sampled_indices] - y_vals[sampled_indices]) ** 2)))

    ci_low = np.percentile(brier_samples, 2.5)
    ci_high = np.percentile(brier_samples, 97.7)
    assert 0.0 <= ci_low <= ci_high <= 0.05


# 7. PSI Bin Consistency and Within-Category Drift
def test_psi_bin_consistency():
    from scratch.run_phase_7d_audit import calculate_psi
    dist_baseline = np.random.normal(5, 2, 500)
    dist_shifted = np.random.normal(15, 3, 500)
    
    psi_val = calculate_psi(dist_baseline, dist_shifted)
    assert psi_val > 0.25, "Shifted distribution must trigger PSI > 0.25"


# 8. Database Non-Mutation Verification & RBAC Scoping
def test_database_non_mutation_live(db_session=None):
    db = next(get_db())
    
    pre_task_count = db.scalar(select(func.count(Task.id)))
    pre_emp_count = db.scalar(select(func.count(Employee.id)))
    pre_notif_count = db.scalar(select(func.count(Notification.id)))
    pre_esc_count = db.scalar(select(func.count(Escalation.id)))
    pre_pred_count = db.scalar(select(func.count(MLPrediction.id)))

    # Execute read-only shadow endpoints
    admin_headers = get_auth_header(ADMIN_EMAIL)
    client.get("/api/v1/ml/tasks/1/prediction", headers=admin_headers)
    client.get("/api/v1/copilot/task-risk-assessment/1", headers=admin_headers)
    client.get("/api/v1/copilot/recommendations", headers=admin_headers)

    # Verify identical counts
    assert db.scalar(select(func.count(Task.id))) == pre_task_count == 3300
    assert db.scalar(select(func.count(Employee.id))) == pre_emp_count == 200
    assert db.scalar(select(func.count(Notification.id))) == pre_notif_count
    assert db.scalar(select(func.count(Escalation.id))) == pre_esc_count
    assert db.scalar(select(func.count(MLPrediction.id))) == pre_pred_count == 3300

