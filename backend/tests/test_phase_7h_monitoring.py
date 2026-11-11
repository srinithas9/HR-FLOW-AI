import json
import pytest
import numpy as np
import hashlib
from pathlib import Path
from collections import Counter
from sqlalchemy import select, func, text

from app.db.session import get_db
from app.models.organization import User, Employee
from app.models.workflow import Task, Notification, Escalation
from app.models.intelligence import MLPrediction

PHASE_7C_DIR = Path("C:/HR AI/datasets/phase_7c_monitoring")
PHASE_7H_DIR = Path("C:/HR AI/datasets/phase_7h_monitoring")
ARTIFACTS_DIR = Path("C:/HR AI/ml/artifacts/phase_7a")


# 1. Feature owner_current_workload Distribution & Percentiles Test
def test_phase_7h_owner_workload_statistics_and_percentiles():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]
    assert len(recs) == 494

    snap_workloads = [r["features"]["owner_current_workload"] for r in recs]
    assert len(snap_workloads) == 494

    # Snapshot distribution
    assert abs(float(np.mean(snap_workloads)) - 16.5749) < 0.01
    assert float(np.median(snap_workloads)) == 13.0
    assert abs(float(np.std(snap_workloads)) - 12.4529) < 0.05
    assert max(snap_workloads) == 52
    assert min(snap_workloads) == 1

    # Task-level deduplication (last observation per task)
    task_map = {}
    for r in recs:
        tid = r["task_id"]
        if tid not in task_map or r["prediction_timestamp"] > task_map[tid]["prediction_timestamp"]:
            task_map[tid] = r

    assert len(task_map) == 247
    task_workloads = [r["features"]["owner_current_workload"] for r in task_map.values()]
    assert abs(float(np.mean(task_workloads)) - 16.8178) < 0.01
    assert float(np.median(task_workloads)) == 13.0
    assert abs(float(np.std(task_workloads)) - 12.5273) < 0.05

    # Check key percentiles
    p25 = np.percentile(task_workloads, 25)
    p50 = np.percentile(task_workloads, 50)
    p75 = np.percentile(task_workloads, 75)
    p90 = np.percentile(task_workloads, 90)
    assert p25 == 7.0
    assert p50 == 13.0
    assert p75 == 22.5
    assert abs(p90 - 38.2) < 0.1


# 2. Population Stability Index (PSI) Recalculation Reproducibility Test
def test_phase_7h_psi_recalculation_reproducibility():
    summary_path = PHASE_7H_DIR / "phase_7h_monitoring_summary.json"
    assert summary_path.exists()
    with open(summary_path, "r") as f:
        data = json.load(f)

    psi_info = data["owner_workload_drift_investigation"]["recalculated_psi"]
    snap_psi = psi_info["snapshot_level_psi"]
    task_psi = psi_info["task_level_psi"]

    assert abs(snap_psi - 0.996354) < 0.001
    assert abs(task_psi - 1.039024) < 0.001
    assert snap_psi > 0.25, "Snapshot PSI must indicate significant covariate shift"
    assert task_psi > 0.25, "Task PSI must indicate significant covariate shift"

    # Confirm classification
    finding = data["owner_workload_drift_investigation"]["finding_classification"]
    assert finding["A_genuine_covariate_shift"] is True
    assert finding["B_feature_calculation_inconsistency"] is False
    assert finding["C_population_composition_shift"] is True
    assert finding["D_sampling_or_aggregation_artifact"] is True


# 3. Category Distribution Across Six Operational Slices Test
def test_phase_7h_category_distribution_across_six_slices():
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    recs = [json.loads(l) for l in obs_file.read_text().splitlines() if l.strip()]

    # Slice 1: Unique tasks (247)
    task_map = {}
    for r in recs:
        tid = r["task_id"]
        if tid not in task_map or r["prediction_timestamp"] > task_map[tid]["prediction_timestamp"]:
            task_map[tid] = r
    assert len(task_map) == 247
    task_cats = Counter([r["features"]["task_category"] for r in task_map.values()])
    assert task_cats["PERFORMANCE"] == 208
    assert task_cats["OFFBOARDING"] == 15
    assert task_cats["PROBATION"] == 13
    assert task_cats["ONBOARDING"] == 7
    assert task_cats["COMPLIANCE"] == 4
    assert abs(task_cats["PERFORMANCE"] / 247 - 0.842105) < 0.0001

    # Slice 2: All snapshots (494)
    snap_cats = Counter([r["features"]["task_category"] for r in recs])
    assert len(recs) == 494
    assert snap_cats["PERFORMANCE"] == 416
    assert abs(snap_cats["PERFORMANCE"] / 494 - 0.842105) < 0.0001

    # Slice 3: Newly observed tasks (0)
    summary_path = PHASE_7H_DIR / "phase_7h_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)
    assert data["category_distribution_audit"]["slice_3_newly_observed_tasks"]["total"] == 0

    # Slice 4: Overdue-open tasks (3)
    overdue_tasks = [r for r in task_map.values() if r.get("outcome_maturity_status") == "OVERDUE_OPEN"]
    assert len(overdue_tasks) == 3
    assert {r["task_id"] for r in overdue_tasks} == {3018, 3072, 3077}
    overdue_cats = Counter([r["features"]["task_category"] for r in overdue_tasks])
    assert overdue_cats["PERFORMANCE"] == 1  # 3018
    assert overdue_cats["OFFBOARDING"] == 2   # 3072, 3077

    # Slice 5: Mature completed tasks (11)
    mature_tasks = [r for r in task_map.values() if r.get("outcome_maturity_status") in ["MATURE_COMPLETED_ON_TIME", "MATURE_COMPLETED_DELAYED"]]
    assert len(mature_tasks) == 11
    mature_cats = Counter([r["features"]["task_category"] for r in mature_tasks])
    assert mature_cats["OFFBOARDING"] == 6
    assert mature_cats["ONBOARDING"] == 4
    assert mature_cats["PERFORMANCE"] == 1

    # Slice 6: Unresolved tasks (233)
    unresolved_tasks = [r for r in task_map.values() if r.get("outcome_maturity_status") == "UNRESOLVED"]
    assert len(unresolved_tasks) == 233
    unres_cats = Counter([r["features"]["task_category"] for r in unresolved_tasks])
    assert unres_cats["PERFORMANCE"] == 206


# 4. Statistical Maturity Progression Test
def test_phase_7h_statistical_maturity_and_preliminary_target():
    summary_path = PHASE_7H_DIR / "phase_7h_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    mat = data["statistical_maturity_tracking"]
    assert mat["total_monitored_tasks"] == 247
    assert mat["mature_completed_on_time"] == 11
    assert mat["mature_completed_delayed"] == 0
    assert mat["overdue_open_tasks"] == 3
    assert mat["unresolved_tasks"] == 233
    assert mat["minimum_preliminary_target"] == 100
    assert mat["current_target_progress_percent"] == 11.0
    assert mat["evidence_sufficiency_verdict"] == "INSUFFICIENT"


# 5. Model Brier Scores and Degenerate Baselines Test
def test_phase_7h_model_brier_scores_and_degenerate_baselines():
    summary_path = PHASE_7H_DIR / "phase_7h_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    perf = data["model_performance_and_calibration"]
    assert perf["mature_sample_size"] == 11
    assert abs(perf["task_level_brier_score"] - 0.025929) < 0.0001
    assert abs(perf["snapshot_level_brier_score"] - 0.022180) < 0.0001
    assert perf["constant_prevalence_baseline_brier"] == 0.0
    assert perf["constant_zero_probability_baseline_brier"] == 0.0

    ci = perf["clustered_bootstrap_95_ci"]
    assert abs(ci[0] - 0.018696) < 0.001
    assert abs(ci[1] - 0.033555) < 0.001

    disc = perf["discrimination_metrics"]
    assert "UNDEFINED" in disc["roc_auc"]
    assert "UNDEFINED" in disc["pr_auc"]
    assert "UNDEFINED" in disc["pr_auc_lift"]


# 6. Operational Workload Run-Rate & Concentration Test
def test_phase_7h_operational_workload_runrate_and_concentration():
    summary_path = PHASE_7H_DIR / "phase_7h_monitoring_summary.json"
    with open(summary_path, "r") as f:
        data = json.load(f)

    ops = data["operational_utility"]
    assert ops["unique_high_risk_tasks"] == 36
    assert ops["uniform_accrual_run_rate_tasks_per_week"] == 31.5
    assert "uniform accrual" in ops["qualified_weekly_volume_label"].lower()

    dept = ops["department_concentration"]
    assert dept["DEPT_QA"]["count"] == 20
    assert dept["DEPT_SWE"]["count"] == 9
    assert abs(dept["combined_qa_swe_share"] - 0.8056) < 0.001
    assert ops["unresolved_high_risk_tasks"] == 36
    assert ops["false_positives_count"] == 0
    assert ops["autonomous_actions_executed"] == 0


# 7. Telemetry & Artifacts Hashes Test
def test_phase_7h_telemetry_and_artifacts_hashes():
    # Verify observations.jsonl hash
    obs_file = PHASE_7C_DIR / "observations.jsonl"
    hasher = hashlib.sha256()
    with open(obs_file, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    assert hasher.hexdigest() == "fb54e7c2d4283cce88373f7230de43a8bf89d4f7dc64f04d608f9f5433ec5411"

    # Verify new_observations.jsonl exists
    new_obs = PHASE_7H_DIR / "new_observations.jsonl"
    assert new_obs.exists()

    # Verify model artifact hash
    model_file = ARTIFACTS_DIR / "calibrated_model.joblib"
    assert model_file.exists()
    hasher_model = hashlib.sha256()
    with open(model_file, "rb") as f:
        while chunk := f.read(65536):
            hasher_model.update(chunk)
    assert hasher_model.hexdigest() == "7ed9349075de3e1acf54326a39f06a916ff3296b6874b7174bb4d1d6ceb25efe"


# 8. Database Non-Mutation & Row Count Invariance Test
def test_phase_7h_database_invariance_and_counts():
    try:
        from app.db.session import SessionLocal
        import app.models as models

        db = SessionLocal()
        table_checks = [
            (models.Department, 12),
            (models.Role, 4),
            (models.Employee, 200),
            (models.User, 23),
            (models.EmployeeLifecycle, 800),
            (models.OnboardingRecord, 200),
            (models.ProbationRecord, 200),
            (models.ConfirmationRecord, 200),
            (models.PerformanceReview, 600),
            (models.OffboardingRecord, 14),
            (models.TaskTemplate, 25),
            (models.Task, 3300),
            (models.TaskDependency, 2500),
            (models.TaskStatusHistory, 9800),
            (models.DocumentRequirement, 12),
            (models.EmployeeDocument, 1200),
            (models.FollowUp, 480),
            (models.Notification, 3450),
            (models.Escalation, 360),
            (models.TaskSnapshot, 8350),
            (models.MLPrediction, 3300),
            (models.AIInsight, 200),
            (models.ActivityLog, 1000),
            (models.AIRecommendation, 300),
            (models.AIRecommendationHistory, 500),
            (models.AIOperationalSummary, 120),
        ]
        assert len(table_checks) == 26
        total_rows = 0
        for model_cls, expected_cnt in table_checks:
            cnt = db.query(model_cls).count()
            assert cnt == expected_cnt, f"Table {model_cls.__tablename__} mismatch: {cnt} != {expected_cnt}"
            total_rows += cnt
            
        assert total_rows == 37150, f"Expected 37,150 total invariant records, got {total_rows}"
        db.close()
    except Exception as e:
        if "10013" in str(e) or "connection refused" in str(e).lower():
            pytest.skip("PostgreSQL socket restricted in sandbox without bypass.")
        else:
            raise


# 9. Deliverables Manifest Existence Test
def test_phase_7h_deliverables_manifest():
    expected_files = [
        "new_observations.jsonl",
        "phase_7h_monitoring_summary.json",
        "HR_FLOW_AI_PHASE_7H_MONITORING_CONTINUITY_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_OWNER_WORKLOAD_DRIFT_INVESTIGATION.md",
        "HR_FLOW_AI_PHASE_7H_CATEGORY_DISTRIBUTION_AUDIT.md",
        "HR_FLOW_AI_PHASE_7H_STATISTICAL_MATURITY_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_MODEL_PERFORMANCE_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_OPERATIONAL_UTILITY_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_TELEMETRY_INTEGRITY_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_GOVERNANCE_SAFETY_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_DATABASE_NON_MUTATION_REPORT.md",
        "HR_FLOW_AI_PHASE_7H_FINAL_ACCEPTANCE_REPORT.md",
    ]
    for fname in expected_files:
        fpath = PHASE_7H_DIR / fname
        assert fpath.exists(), f"Deliverable {fname} is missing"
        if fname != "new_observations.jsonl":
            assert fpath.stat().st_size > 0, f"Deliverable {fname} must not be empty"
