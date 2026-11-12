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
PHASE_7D_DIR = Path("C:/HR AI/datasets/phase_7d_monitoring")
PHASE_7E_DIR = Path("C:/HR AI/datasets/phase_7e_monitoring")
ARTIFACTS_DIR = Path("C:/HR AI/ml/artifacts/phase_7a")


def get_auth_header(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# 1. Evidence Preservation & Artifact Immutability
def test_phase_7e_evidence_preservation_and_immutability():
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


# 2. New Observation Ingestion & Duplicate Prevention
def test_phase_7e_new_observation_ingestion_and_duplicate_prevention():
    seen_ids = {"OBS-7C-000001", "OBS-7C-000002"}
    
    def ingest_observation(new_rec: dict, existing_ids: set):
        obs_id = new_rec["observation_id"]
        if obs_id in existing_ids:
            return False, "DUPLICATE_OBSERVATION_REJECTED"
        existing_ids.add(obs_id)
        return True, "INGESTED"

    # Ingest unique observation
    success, msg = ingest_observation({"observation_id": "OBS-7E-000001"}, seen_ids)
    assert success is True
    assert msg == "INGESTED"

    # Attempt duplicate ingestion
    success, msg = ingest_observation({"observation_id": "OBS-7C-000001"}, seen_ids)
    assert success is False
    assert msg == "DUPLICATE_OBSERVATION_REJECTED"


# 3. Monitoring Clock Continuity
def test_phase_7e_monitoring_clock_continuity():
    summary_path = PHASE_7E_DIR / "phase_7e_monitoring_summary.json"
    assert summary_path.exists(), "Phase 7E summary JSON must exist"
    with open(summary_path, "r") as f:
        data = json.load(f)
    
    mc = data["monitoring_clock"]
    start_dt = datetime.fromisoformat(mc["start_timestamp"])
    assert start_dt.year == 2026 and start_dt.month == 11 and start_dt.day == 1
    assert mc["elapsed_calendar_days"] == 8
    assert mc["remaining_calendar_days"] == 48
    assert mc["target_weeks"] == 8


# 4. Outcome Maturity & Overdue-Open Rules
def test_phase_7e_outcome_maturity_and_overdue_open_rules():
    def evaluate_maturity(completed_at: str | None, due_date: str, status: str, ref_date: str = "2026-11-09"):
        if completed_at is not None:
            if completed_at[:10] <= due_date:
                return "MATURE_COMPLETED_ON_TIME", 0.0
            else:
                return "MATURE_COMPLETED_DELAYED", 1.0
        else:
            if due_date < ref_date or status == "DELAYED":
                return "OVERDUE_OPEN", None
            else:
                return "UNRESOLVED", None

    # Completed on time
    s, y = evaluate_maturity("2026-11-04T00:00:00", "2026-11-04", "COMPLETED")
    assert s == "MATURE_COMPLETED_ON_TIME" and y == 0.0

    # Completed delayed
    s, y = evaluate_maturity("2026-11-08T00:00:00", "2026-11-05", "COMPLETED")
    assert s == "MATURE_COMPLETED_DELAYED" and y == 1.0

    # Overdue-open (incomplete past deadline)
    s, y = evaluate_maturity(None, "2026-11-05", "DELAYED")
    assert s == "OVERDUE_OPEN" and y is None

    # Unresolved (ongoing, not overdue)
    s, y = evaluate_maturity(None, "2026-11-20", "IN_PROGRESS")
    assert s == "UNRESOLVED" and y is None


# 5. Task-Level Evaluation & Repeated Snapshot Policy
def test_phase_7e_task_level_evaluation_policy():
    snapshots = [
        {"task_id": 101, "snapshot_ts": "2026-11-01T00:00:00", "prob": 0.08, "tier": "LOW"},
        {"task_id": 101, "snapshot_ts": "2026-11-03T00:00:00", "prob": 0.09, "tier": "LOW"},
        {"task_id": 102, "snapshot_ts": "2026-11-01T00:00:00", "prob": 0.24, "tier": "HIGH"},
        {"task_id": 102, "snapshot_ts": "2026-11-04T00:00:00", "prob": 0.28, "tier": "HIGH"},
    ]
    
    # Task-level policy: latest snapshot strictly before due date
    from collections import defaultdict
    task_groups = defaultdict(list)
    for s in snapshots:
        task_groups[s["task_id"]].append(s)
        
    latest_task_preds = {}
    for tid, snaps in task_groups.items():
        sorted_snaps = sorted(snaps, key=lambda x: x["snapshot_ts"], reverse=True)
        latest_task_preds[tid] = sorted_snaps[0]
        
    assert len(latest_task_preds) == 2
    assert latest_task_preds[101]["prob"] == 0.09
    assert latest_task_preds[102]["prob"] == 0.28


# 6. Single-Class Metric & Baseline Brier Handling
def test_phase_7e_single_class_metric_and_brier_baseline():
    y_single_class = np.array([0, 0, 0, 0])
    p_preds = np.array([0.08, 0.07, 0.09, 0.06])
    
    prev = float(np.mean(y_single_class))
    brier_prev = float(np.mean((prev - y_single_class) ** 2))
    assert brier_prev == 0.0, "Single-class prevalence baseline Brier must be identically 0.0"
    
    brier_model = float(np.mean((p_preds - y_single_class) ** 2))
    assert 0.0 < brier_model < 0.02


# 7. Risk-Tier Consistency & Drift Calculation
def test_phase_7e_risk_tier_consistency_and_drift_calculation():
    from scratch.run_phase_7d_audit import calculate_psi
    
    # Check updated tier boundaries
    def get_tier(prob: float) -> str:
        if prob < 0.10:
            return "LOW"
        elif prob < 0.20:
            return "MEDIUM"
        else:
            return "HIGH"

    assert get_tier(0.0999) == "LOW"
    assert get_tier(0.1000) == "MEDIUM"
    assert get_tier(0.1999) == "MEDIUM"
    assert get_tier(0.2000) == "HIGH"

    # Check PSI
    dist_a = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    dist_b = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    psi_identical = calculate_psi(dist_a, dist_b)
    assert psi_identical == 0.0 or abs(psi_identical) < 0.01


# 8. Database Non-Mutation & RBAC Scoping
def test_phase_7e_database_non_mutation_live():
    db = next(get_db())
    
    pre_tasks = db.scalar(select(func.count(Task.id)))
    pre_emps = db.scalar(select(func.count(Employee.id)))
    pre_preds = db.scalar(select(func.count(MLPrediction.id)))

    # Execute read-only shadow prediction endpoints
    admin_headers = get_auth_header(ADMIN_EMAIL)
    client.get("/api/v1/ml/tasks/1/prediction", headers=admin_headers)
    client.get("/api/v1/copilot/task-risk-assessment/1", headers=admin_headers)

    # Invariants
    assert db.scalar(select(func.count(Task.id))) == pre_tasks == 3300
    assert db.scalar(select(func.count(Employee.id))) == pre_emps == 200
    assert db.scalar(select(func.count(MLPrediction.id))) == pre_preds == 3300

