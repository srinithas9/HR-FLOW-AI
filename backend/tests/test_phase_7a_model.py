import pytest
import numpy as np
import pandas as pd
from pathlib import Path
import sys

# Add root directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.predictor import TaskDelayRiskPredictor, APPROVED_FEATURES


@pytest.fixture(scope="module")
def predictor():
    return TaskDelayRiskPredictor()


def test_predictor_initialization(predictor):
    assert predictor is not None
    assert predictor.model_version == "v2.1.0-phase7a"
    assert predictor.t_low == 0.10
    assert predictor.t_high == 0.20


def test_valid_prediction(predictor):
    sample_input = {
        "days_remaining": 5,
        "task_category": "ONBOARDING",
        "task_priority": "HIGH",
        "current_status": "IN_PROGRESS",
        "reminder_count": 1,
        "owner_previous_delay_rate": 0.15,
        "owner_current_workload": 6,
        "dependency_status": "ALL_MET"
    }
    result = predictor.predict(sample_input)
    assert "delay_probability" in result
    assert "risk_classification" in result
    assert "model_version" in result
    assert "prediction_timestamp" in result
    assert "contributing_factors" in result
    
    assert 0.0 <= result["delay_probability"] <= 1.0
    assert result["risk_classification"] in ["LOW", "MEDIUM", "HIGH"]
    assert len(result["contributing_factors"]) > 0


def test_missing_values_handled_gracefully(predictor):
    # Only supply a partial dictionary
    partial_input = {
        "days_remaining": 3,
        "task_priority": "LOW"
    }
    result = predictor.predict(partial_input)
    assert 0.0 <= result["delay_probability"] <= 1.0
    assert result["risk_classification"] in ["LOW", "MEDIUM", "HIGH"]
    # Check default filled for missing features
    assert result["features_used"]["task_category"] == "ONBOARDING"
    assert result["features_used"]["owner_previous_delay_rate"] == 0.20


def test_unknown_categorical_fallback(predictor):
    strange_input = {
        "days_remaining": 4,
        "task_category": "NON_EXISTENT_CATEGORY",
        "task_priority": "SUPER_URGENT",
        "current_status": "UNKNOWN_STATE",
        "reminder_count": 0,
        "owner_previous_delay_rate": 0.18,
        "owner_current_workload": 5,
        "dependency_status": "UNKNOWN"
    }
    result = predictor.predict(strange_input)
    assert 0.0 <= result["delay_probability"] <= 1.0
    assert result["features_used"]["task_category"] == "ONBOARDING"
    assert result["features_used"]["task_priority"] == "MEDIUM"


def test_unauthorized_feature_rejection(predictor):
    # Pass employee_id or actual_completion_date
    with pytest.raises(ValueError, match="Unauthorized predictor rejected"):
        predictor.predict({
            "days_remaining": 5,
            "task_category": "ONBOARDING",
            "task_priority": "MEDIUM",
            "current_status": "IN_PROGRESS",
            "reminder_count": 0,
            "owner_previous_delay_rate": 0.20,
            "owner_current_workload": 5,
            "dependency_status": "NONE",
            "employee_id": 42
        })

    with pytest.raises(ValueError, match="Unauthorized predictor rejected"):
        predictor.predict({
            "days_remaining": 5,
            "task_category": "ONBOARDING",
            "task_priority": "MEDIUM",
            "current_status": "IN_PROGRESS",
            "reminder_count": 0,
            "owner_previous_delay_rate": 0.20,
            "owner_current_workload": 5,
            "dependency_status": "NONE",
            "actual_completion_date": "2026-11-10"
        })


def test_risk_threshold_classification(predictor):
    # Verify mapping logic
    assert predictor.t_low < predictor.t_high
    
    # Test low risk profile: HIGH priority, generous days, clean history
    low_risk_input = {
        "days_remaining": 15,
        "task_category": "ONBOARDING",
        "task_priority": "HIGH",
        "current_status": "IN_PROGRESS",
        "reminder_count": 0,
        "owner_previous_delay_rate": 0.08,
        "owner_current_workload": 2,
        "dependency_status": "ALL_MET"
    }
    low_res = predictor.predict(low_risk_input)
    assert low_res["risk_classification"] in ["LOW", "MEDIUM"]
    
    # Test high risk profile: LOW priority, 1 day remaining, heavy workload, high delay history, pending dependency
    high_risk_input = {
        "days_remaining": 1,
        "task_category": "COMPLIANCE",
        "task_priority": "LOW",
        "current_status": "IN_PROGRESS",
        "reminder_count": 2,
        "owner_previous_delay_rate": 0.35,
        "owner_current_workload": 25,
        "dependency_status": "PENDING"
    }
    high_res = predictor.predict(high_risk_input)
    assert high_res["delay_probability"] > low_res["delay_probability"]


def test_reproducibility(predictor):
    sample = {
        "days_remaining": 4,
        "task_category": "PROBATION",
        "task_priority": "MEDIUM",
        "current_status": "IN_PROGRESS",
        "reminder_count": 1,
        "owner_previous_delay_rate": 0.22,
        "owner_current_workload": 10,
        "dependency_status": "ALL_MET"
    }
    res1 = predictor.predict(sample)
    res2 = predictor.predict(sample)
    assert res1["delay_probability"] == res2["delay_probability"]
    assert res1["risk_classification"] == res2["risk_classification"]


def test_forward_cohort_inference(predictor):
    # Test inference against forward/open tasks
    snaps_file = ROOT_DIR / "datasets" / "remediated_csv" / "task_snapshots.csv"
    tasks_file = ROOT_DIR / "datasets" / "remediated_csv" / "tasks.csv"
    
    snaps_df = pd.read_csv(snaps_file)
    tasks_df = pd.read_csv(tasks_file)
    
    # Forward tasks start 2026-11-01 onwards
    task_start_map = tasks_df.set_index("id")["start_date"].to_dict()
    snaps_df["start_date"] = snaps_df["task_id"].map(task_start_map)
    fwd_snaps = snaps_df[snaps_df["start_date"] >= "2026-11-01"].head(20)
    
    assert len(fwd_snaps) == 20
    for _, row in fwd_snaps.iterrows():
        raw_feat = {k: row[k] for k in APPROVED_FEATURES}
        pred = predictor.predict(raw_feat)
        assert 0.0 <= pred["delay_probability"] <= 1.0
        assert pred["risk_classification"] in ["LOW", "MEDIUM", "HIGH"]


def test_risk_band_exact_boundaries(predictor):
    # Verify exact operational risk bands: LOW (<10%), MEDIUM (10%-19.99%), HIGH (>=20%)
    assert predictor.classify_probability(0.0999) == "LOW"
    assert predictor.classify_probability(0.1000) == "MEDIUM"
    assert predictor.classify_probability(0.1999) == "MEDIUM"
    assert predictor.classify_probability(0.2000) == "HIGH"

    assert TaskDelayRiskPredictor.classify_risk(0.0999) == "LOW"
    assert TaskDelayRiskPredictor.classify_risk(0.1000) == "MEDIUM"
    assert TaskDelayRiskPredictor.classify_risk(0.1999) == "MEDIUM"
    assert TaskDelayRiskPredictor.classify_risk(0.2000) == "HIGH"

