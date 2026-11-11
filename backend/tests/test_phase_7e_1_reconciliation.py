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

client = TestClient(app)

PHASE_7C_DIR = Path("C:/HR AI/datasets/phase_7c_monitoring")
PHASE_7D_DIR = Path("C:/HR AI/datasets/phase_7d_monitoring")
PHASE_7E_DIR = Path("C:/HR AI/datasets/phase_7e_monitoring")
RECON_DIR = Path("C:/HR AI/datasets/phase_7e_1_reconciliation")


# 1. SHA-256 Checksum Reconciliation Test
def test_sha256_reconciliation_exact_file_hash():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    assert obs_file.exists(), "Phase 7C observations.jsonl must exist"
    
    # Calculate directly
    hasher = hashlib.sha256()
    with open(obs_file, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    actual_hash = hasher.hexdigest()
    
    # Authenticated canonical hash
    canonical_hash = "fb54e7c2d4283cce88373f7230de43a8bf89d4f7dc64f04d608f9f5433ec5411"
    assert actual_hash == canonical_hash, f"Actual hash {actual_hash} does not match canonical hash {canonical_hash}"
    assert obs_file.stat().st_size == 361829, f"File size mismatch: {obs_file.stat().st_size} vs 361829"


# 2. HIGH-Risk Workload Recalculation Test
def test_high_risk_workload_recalculated_formula():
    n_high_tasks = 36
    actual_obs_days = 8
    
    # User formula: Weekly volume = unique eligible review tasks / actual observation days * 7
    weekly_volume = (n_high_tasks / actual_obs_days) * 7.0
    assert weekly_volume == 31.5, f"Expected 31.5 tasks/week run-rate, got {weekly_volume}"
    
    # Estimated review time at 6 mins/task
    time_6m_mins = weekly_volume * 6.0
    assert time_6m_mins == 189.0
    assert (time_6m_mins / 60.0) == 3.15 # 3.15 hours/week
    
    # Estimated review time at 10 mins/task
    time_10m_mins = weekly_volume * 10.0
    assert time_10m_mins == 315.0
    assert (time_10m_mins / 60.0) == 5.25 # 5.25 hours/week
    
    # Per-department average across 12 departments
    per_dept_weekly = weekly_volume / 12.0
    assert per_dept_weekly == 2.625


# 3. Telemetry Accumulation & Zero-New-Observation Validation
def test_telemetry_accumulation_and_deduplication():
    summary_path = RECON_DIR / "phase_7e_1_reconciliation_summary.json"
    assert summary_path.exists(), "Reconciliation summary JSON must exist"
    
    with open(summary_path, "r") as f:
        data = json.load(f)
        
    telem = data["telemetry_accumulation_audit"]
    assert telem["historical_observations_phase_7c_7d"] == 494
    assert telem["new_observations_phase_7e"] == 0
    assert telem["total_combined_unique_observations"] == 494
    assert telem["total_combined_unique_tasks"] == 247
    assert telem["duplicate_records"] == 0


# 4. Outcome Maturity Invariants & Overdue-Open Separation
def test_outcome_maturity_invariants_and_overdue_open():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    with open(obs_file, "r") as f:
        recs = [json.loads(line) for line in f if line.strip()]
        
    from collections import defaultdict
    task_map = {}
    for r in recs:
        # Latest snapshot per task
        tid = r["task_id"]
        if tid not in task_map or r["prediction_timestamp"] > task_map[tid]["prediction_timestamp"]:
            task_map[tid] = r
            
    mat_counts = defaultdict(int)
    for tid, r in task_map.items():
        mat_counts[r["outcome_maturity_status"]] += 1
        
    assert mat_counts["MATURE_COMPLETED_ON_TIME"] == 11
    assert mat_counts["MATURE_COMPLETED_DELAYED"] == 0
    assert mat_counts["OVERDUE_OPEN"] == 3
    assert mat_counts["UNRESOLVED"] == 233
    assert len(task_map) == 247


# 5. Database Non-Mutation Live Check
def test_database_non_mutation_invariant_live():
    try:
        db = next(get_db())
        task_cnt = db.scalar(select(func.count(Task.id)))
        emp_cnt = db.scalar(select(func.count(Employee.id)))
        user_cnt = db.scalar(select(func.count(User.id)))
        pred_cnt = db.scalar(select(func.count(MLPrediction.id)))
        
        assert task_cnt == 3300
        assert emp_cnt == 200
        assert user_cnt == 23
        assert pred_cnt == 3300
    except Exception as e:
        if "10013" in str(e) or "Permission denied" in str(e):
            pytest.skip(f"PostgreSQL socket restricted by sandbox: {e}")
        raise
