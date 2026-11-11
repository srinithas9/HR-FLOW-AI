import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Union, Optional
import numpy as np
import pandas as pd
import joblib

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts" / "phase_7a"
MODEL_PATH = ARTIFACTS_DIR / "calibrated_model.joblib"
PREPROCESSOR_PATH = ARTIFACTS_DIR / "preprocessor.joblib"
SCHEMA_PATH = ARTIFACTS_DIR / "feature_schema.json"
METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"

APPROVED_FEATURES = [
    "days_remaining",
    "task_category",
    "task_priority",
    "current_status",
    "reminder_count",
    "owner_previous_delay_rate",
    "owner_current_workload",
    "dependency_status"
]

UNAUTHORIZED_FEATURES = [
    "id", "task_id", "task_code", "employee_id", "owner_id", "department_id",
    "completed_at", "completed_date", "actual_completion_date",
    "last_deadline_change_reason", "deadline_extension_count"
]

FEATURE_DEFAULTS = {
    "days_remaining": 5,
    "task_category": "ONBOARDING",
    "task_priority": "MEDIUM",
    "current_status": "IN_PROGRESS",
    "reminder_count": 0,
    "owner_previous_delay_rate": 0.20,
    "owner_current_workload": 8,
    "dependency_status": "NONE"
}

ALLOWED_CATEGORIES = {"ONBOARDING", "PROBATION", "PERFORMANCE", "COMPLIANCE", "OFFBOARDING"}
ALLOWED_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}
ALLOWED_STATUSES = {"IN_PROGRESS", "COMPLETED", "BLOCKED"}
ALLOWED_DEPENDENCIES = {"NONE", "ALL_MET", "PENDING"}


class TaskDelayRiskPredictor:
    """
    Certified Phase 7A Inference Wrapper for HR Operational Task Delay Risk Prediction.
    
    Adheres strictly to the 8 approved features, rejects unauthorized predictors,
    handles missing or out-of-range values defensively, and classifies operational risk tiers.
    """

    def __init__(self, artifacts_dir: Optional[Path] = None):
        self.artifacts_dir = Path(artifacts_dir) if artifacts_dir else ARTIFACTS_DIR
        self.preprocessor = joblib.load(self.artifacts_dir / "preprocessor.joblib")
        self.model = joblib.load(self.artifacts_dir / "calibrated_model.joblib")
        
        with open(self.artifacts_dir / "model_metadata.json", "r") as f:
            self.metadata = json.load(f)
            
        self.model_version = self.metadata.get("model_version", "v2.1.0-phase7a")
        thresholds = self.metadata.get("risk_thresholds", {})
        self.t_low = thresholds.get("threshold_low", 0.12)
        self.t_high = thresholds.get("threshold_high", 0.22)

    def validate_and_clean_input(self, raw_input: Dict[str, Any]) -> pd.DataFrame:
        """
        Validates input against the 8 approved features, rejecting unauthorized identifiers
        and substituting robust defaults for missing fields.
        """
        # 1. Reject unauthorized predictors immediately
        for unauthorized_key in UNAUTHORIZED_FEATURES:
            if unauthorized_key in raw_input and raw_input[unauthorized_key] is not None:
                raise ValueError(
                    f"Unauthorized predictor rejected: '{unauthorized_key}'. "
                    "HR Flow AI strictly forbids training or predicting on employee, task, or owner identifiers."
                )

        cleaned = {}
        # 2. Extract and sanitize approved features
        for feat in APPROVED_FEATURES:
            val = raw_input.get(feat)
            default = FEATURE_DEFAULTS[feat]
            if val is None or pd.isna(val):
                cleaned[feat] = default
            else:
                cleaned[feat] = val

        # Validate categorical values defensively
        if cleaned["task_category"] not in ALLOWED_CATEGORIES:
            cleaned["task_category"] = FEATURE_DEFAULTS["task_category"]
        if cleaned["task_priority"] not in ALLOWED_PRIORITIES:
            cleaned["task_priority"] = FEATURE_DEFAULTS["task_priority"]
        if cleaned["current_status"] not in ALLOWED_STATUSES:
            cleaned["current_status"] = FEATURE_DEFAULTS["current_status"]
        if cleaned["dependency_status"] not in ALLOWED_DEPENDENCIES:
            cleaned["dependency_status"] = FEATURE_DEFAULTS["dependency_status"]

        # Validate numeric ranges defensively
        cleaned["days_remaining"] = max(1, int(cleaned["days_remaining"]))
        cleaned["reminder_count"] = max(0, int(cleaned["reminder_count"]))
        cleaned["owner_previous_delay_rate"] = float(np.clip(float(cleaned["owner_previous_delay_rate"]), 0.0, 1.0))
        cleaned["owner_current_workload"] = max(0, int(cleaned["owner_current_workload"]))

        return pd.DataFrame([cleaned])[APPROVED_FEATURES]

    def predict(self, raw_input: Union[Dict[str, Any], pd.DataFrame]) -> Dict[str, Any]:
        """
        Generates calibrated delay probability, risk classification, and contributing factors.
        """
        if isinstance(raw_input, dict):
            df_in = self.validate_and_clean_input(raw_input)
        elif isinstance(raw_input, pd.DataFrame):
            # Validate each row
            records = raw_input.to_dict(orient="records")
            cleaned_rows = [self.validate_and_clean_input(r).iloc[0].to_dict() for r in records]
            df_in = pd.DataFrame(cleaned_rows)[APPROVED_FEATURES]
        else:
            raise TypeError("Input must be a dictionary of features or a pandas DataFrame.")

        # Transform features
        X_trans = self.preprocessor.transform(df_in)
        
        # Predict calibrated probability
        probs = self.model.predict_proba(X_trans)[:, 1]
        prob = float(probs[0])
        prob = float(np.clip(prob, 0.01, 0.99))

        # Risk classification
        if prob < self.t_low:
            risk_class = "LOW"
        elif prob < self.t_high:
            risk_class = "MEDIUM"
        else:
            risk_class = "HIGH"

        # Determine contributing factors (linear feature attribution / rules)
        contributions = []
        row = df_in.iloc[0]
        if row["task_priority"] == "HIGH":
            contributions.append({"factor": "task_priority=HIGH", "effect": "Decreases delay risk (expedited priority)", "impact": -0.06})
        elif row["task_priority"] == "LOW":
            contributions.append({"factor": "task_priority=LOW", "effect": "Increases delay risk (deprioritized queue)", "impact": +0.05})

        if row["days_remaining"] <= 2:
            contributions.append({"factor": f"days_remaining={row['days_remaining']}", "effect": "Imminent deadline increases risk", "impact": +0.04})
        elif row["days_remaining"] >= 10:
            contributions.append({"factor": f"days_remaining={row['days_remaining']}", "effect": "Generous buffer decreases risk", "impact": -0.03})

        if row["owner_previous_delay_rate"] > 0.25:
            contributions.append({"factor": f"owner_previous_delay_rate={row['owner_previous_delay_rate']:.2f}", "effect": "Owner historical delay rate above baseline", "impact": +0.03})

        if row["owner_current_workload"] >= 15:
            contributions.append({"factor": f"owner_current_workload={row['owner_current_workload']}", "effect": "Heavy owner backlog capacity pressure", "impact": +0.02})

        if row["dependency_status"] == "PENDING":
            contributions.append({"factor": "dependency_status=PENDING", "effect": "Unmet prerequisite bottleneck", "impact": +0.02})

        if not contributions:
            contributions.append({"factor": "baseline_operational_factors", "effect": "Balanced operational characteristics", "impact": 0.0})

        return {
            "delay_probability": round(prob, 4),
            "risk_classification": risk_class,
            "model_version": self.model_version,
            "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
            "contributing_factors": contributions,
            "features_used": row.to_dict()
        }

    def predict_batch(self, raw_inputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        High-performance vectorized batch inference for multiple tasks.
        Executes feature transformation and calibrated inference in a single matrix pass.
        """
        if not raw_inputs:
            return []

        cleaned_rows = [self.validate_and_clean_input(r).iloc[0].to_dict() for r in raw_inputs]
        df_in = pd.DataFrame(cleaned_rows)[APPROVED_FEATURES]

        X_trans = self.preprocessor.transform(df_in)
        probs = self.model.predict_proba(X_trans)[:, 1]
        probs = np.clip(probs, 0.01, 0.99)

        results = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for idx, prob in enumerate(probs):
            prob = float(prob)
            if prob < self.t_low:
                risk_class = "LOW"
            elif prob < self.t_high:
                risk_class = "MEDIUM"
            else:
                risk_class = "HIGH"

            row = df_in.iloc[idx]
            contributions = []
            if row["task_priority"] == "HIGH":
                contributions.append({"factor": "task_priority=HIGH", "effect": "Decreases delay risk (expedited priority)", "impact": -0.06})
            elif row["task_priority"] == "LOW":
                contributions.append({"factor": "task_priority=LOW", "effect": "Increases delay risk (deprioritized queue)", "impact": +0.05})

            if row["days_remaining"] <= 2:
                contributions.append({"factor": f"days_remaining={row['days_remaining']}", "effect": "Imminent deadline increases risk", "impact": +0.04})
            elif row["days_remaining"] >= 10:
                contributions.append({"factor": f"days_remaining={row['days_remaining']}", "effect": "Generous buffer decreases risk", "impact": -0.03})

            if row["owner_previous_delay_rate"] > 0.25:
                contributions.append({"factor": f"owner_previous_delay_rate={row['owner_previous_delay_rate']:.2f}", "effect": "Owner historical delay rate above baseline", "impact": +0.03})

            if row["owner_current_workload"] >= 15:
                contributions.append({"factor": f"owner_current_workload={row['owner_current_workload']}", "effect": "Heavy owner backlog capacity pressure", "impact": +0.02})

            if row["dependency_status"] == "PENDING":
                contributions.append({"factor": "dependency_status=PENDING", "effect": "Unmet prerequisite bottleneck", "impact": +0.02})

            if not contributions:
                contributions.append({"factor": "baseline_operational_factors", "effect": "Balanced operational characteristics", "impact": 0.0})

            results.append({
                "delay_probability": round(prob, 4),
                "risk_classification": risk_class,
                "model_version": self.model_version,
                "prediction_timestamp": now_iso,
                "contributing_factors": contributions,
                "features_used": row.to_dict()
            })

        return results


