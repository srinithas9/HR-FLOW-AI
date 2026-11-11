import json
import pytest
import numpy as np
import hashlib
from pathlib import Path
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.organization import User, Employee
from app.models.workflow import Task, Notification, Escalation
from app.models.intelligence import MLPrediction

PHASE_7C_DIR = Path("C:/HR AI/datasets/phase_7c_monitoring")
PHASE_7G_DIR = Path("C:/HR AI/datasets/phase_7g_reconciliation")


# 1. Discrepancy 1: Overdue-Open Task ID Canonical Reconciliation
def test_phase_7g_overdue_open_task_ids_reconciliation():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]
    
    overdue_task_ids = {r["task_id"] for r in recs if r["outcome_maturity_status"] == "OVERDUE_OPEN"}
    unresolved_task_ids = {r["task_id"] for r in recs if r["outcome_maturity_status"] == "UNRESOLVED"}
    
    assert overdue_task_ids == {3018, 3072, 3077}, "Canonical OVERDUE_OPEN tasks must be 3018, 3072, 3077"
    assert 3067 in unresolved_task_ids, "Task 3067 must be in UNRESOLVED"
    assert 3067 not in overdue_task_ids, "Task 3067 is NOT overdue open"


# 2. Discrepancy 2: Owner Workload Feature Distribution Verification
def test_phase_7g_owner_workload_distribution_verification():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]
    workloads = [r["features"]["owner_current_workload"] for r in recs]
    
    mean_workload = float(np.mean(workloads))
    median_workload = float(np.median(workloads))
    
    assert 16.0 <= mean_workload <= 17.0, f"Mean workload on disk ({mean_workload}) must match true ~16.57"
    assert median_workload == 13.0, f"Median workload on disk ({median_workload}) must be 13.0"
    assert max(workloads) == 52, f"Max workload on disk ({max(workloads)}) must be 52"


# 3. Discrepancy 3: Task Category Composition Verification
def test_phase_7g_category_distribution_verification():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]
    
    # Task-level deduplication
    task_map = {}
    for r in recs:
        tid = r["task_id"]
        if tid not in task_map or r["prediction_timestamp"] > task_map[tid]["prediction_timestamp"]:
            task_map[tid] = r
            
    cats = [r["features"]["task_category"] for r in task_map.values()]
    from collections import Counter
    counts = Counter(cats)
    
    assert len(task_map) == 247
    assert counts["PERFORMANCE"] == 208, "Exactly 208 PERFORMANCE tasks"
    assert counts["OFFBOARDING"] == 15
    assert counts["PROBATION"] == 13
    assert counts["ONBOARDING"] == 7
    assert counts["COMPLIANCE"] == 4
    
    perf_share = counts["PERFORMANCE"] / len(task_map)
    assert abs(perf_share - 0.8421) < 0.001, "Performance share must be 84.21%"


# 4. Discrepancy 4: Brier Score & Single-Class Audit
def test_phase_7g_brier_score_and_baseline_calculation():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]
    
    task_map = {}
    for r in recs:
        tid = r["task_id"]
        if tid not in task_map or r["prediction_timestamp"] > task_map[tid]["prediction_timestamp"]:
            task_map[tid] = r
            
    mature = [r for r in task_map.values() if r["outcome_maturity_status"] in ["MATURE_COMPLETED_ON_TIME", "MATURE_COMPLETED_DELAYED"]]
    assert len(mature) == 11, "Exactly 11 mature completed tasks"
    
    y = np.array([r["outcome_label"] for r in mature], dtype=float)
    p = np.array([r["predicted_delay_probability"] for r in mature], dtype=float)
    
    assert np.all(y == 0.0), "All mature tasks are on-time (y = 0.0)"
    
    brier_task = float(np.mean((p - y) ** 2))
    prev_baseline = float(np.mean((np.mean(y) - y) ** 2))
    zero_baseline = float(np.mean((0.0 - y) ** 2))
    
    assert abs(brier_task - 0.025929) < 0.0001
    assert prev_baseline == 0.000000
    assert zero_baseline == 0.000000


# 5. Summary JSON & Deliverables Integrity Check
def test_phase_7g_deliverables_and_summary_integrity():
    summary_path = PHASE_7G_DIR / "phase_7g_reconciliation_summary.json"
    assert summary_path.exists(), "Phase 7G summary JSON missing"
    
    with open(summary_path, "r") as f:
        data = json.load(f)
        
    assert data["phase"] == "7G"
    assert data["acceptance_gate"] == "GATE A — ALL DISCREPANCIES RECONCILED"
    assert data["production_promotion_authorized"] is False
    assert data["database_non_mutation"]["total_records"] == 37150
    assert data["database_non_mutation"]["mutations_during_phase_7g"] == 0


# 6. Database Non-Mutation Live Check
def test_phase_7g_database_non_mutation_live():
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

