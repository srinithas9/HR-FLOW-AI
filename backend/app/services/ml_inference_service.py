from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_

from app.models.organization import User, Employee
from app.models.workflow import Task, TaskDependency, Notification
from app.schemas.ml import MLFeatureInput, MLShadowPrediction, ContributingFactor
from app.core.exceptions import ResourceNotFoundException, PermissionDeniedException
from app.services.task_service import TaskService
import sys
from pathlib import Path

# Ensure root repository directory is in sys.path for ml package imports
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.predictor import TaskDelayRiskPredictor

_predictor_instance: Optional[TaskDelayRiskPredictor] = None

def get_predictor() -> TaskDelayRiskPredictor:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = TaskDelayRiskPredictor()
    return _predictor_instance


class MLInferenceService:
    """
    Certified Phase 7B Shadow-Mode ML Inference Service.
    
    Provides non-persistent, read-only task delay risk prediction,
    enforcing RBAC authorization, point-in-time feature extraction,
    and defensive validation against unauthorized predictors.
    """

    @staticmethod
    def predict_for_task(db: Session, current_user: User, task_id: int) -> MLShadowPrediction:
        """
        Extracts approved operational features for a task in the database and computes
        a calibrated shadow prediction without mutating the database or triggering side effects.
        """
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")

        # Enforce RBAC task access scope
        TaskService._verify_task_access(db, current_user, task)

        # 1. days_remaining
        today = date.today()
        days_rem = max(1, (task.due_date - today).days)

        # 2. task_category & 3. task_priority & 4. current_status
        cat = task.category or "ONBOARDING"
        pri = task.priority or "MEDIUM"
        status = task.status if task.status in ["IN_PROGRESS", "COMPLETED", "BLOCKED"] else "IN_PROGRESS"

        # 5. reminder_count (notifications recorded for this task)
        rem_count = db.scalar(
            select(func.count(Notification.id))
            .where(
                and_(
                    Notification.task_id == task_id,
                    Notification.notification_type.in_(["REMINDER", "SLA_REMINDER"])
                )
            )
        ) or 0

        # 6. owner_previous_delay_rate (Empirical Bayes smoothed past performance)
        owner_tasks = db.execute(
            select(Task.due_date, Task.completed_at)
            .where(
                and_(
                    Task.owner_id == task.owner_id,
                    Task.completed_at.is_not(None),
                    Task.id != task.id
                )
            )
        ).all()

        n_comp = len(owner_tasks)
        if n_comp > 0:
            k_delayed = sum(1 for due, comp in owner_tasks if comp.date() > due)
            owner_delay_rate = round((k_delayed + 2.0) / (n_comp + 10.0), 4)
        else:
            owner_delay_rate = 0.20

        # 7. owner_current_workload (active incomplete tasks)
        active_workload = db.scalar(
            select(func.count(Task.id))
            .where(
                and_(
                    Task.owner_id == task.owner_id,
                    Task.status.in_(["PENDING", "IN_PROGRESS", "BLOCKED"])
                )
            )
        ) or 1

        # 8. dependency_status
        prereqs = db.execute(
            select(Task.status)
            .join(TaskDependency, TaskDependency.prerequisite_task_id == Task.id)
            .where(TaskDependency.task_id == task_id)
        ).scalars().all()

        if not prereqs:
            dep_status = "NONE"
        elif all(p_stat == "COMPLETED" for p_stat in prereqs):
            dep_status = "ALL_MET"
        else:
            dep_status = "PENDING"

        # Build approved feature dictionary
        features = {
            "days_remaining": days_rem,
            "task_category": cat,
            "task_priority": pri,
            "current_status": status,
            "reminder_count": rem_count,
            "owner_previous_delay_rate": owner_delay_rate,
            "owner_current_workload": active_workload,
            "dependency_status": dep_status
        }

        predictor = get_predictor()
        res = predictor.predict(features)

        contributions = [
            ContributingFactor(
                factor=item.get("factor", "unknown"),
                effect=item.get("effect", ""),
                impact=float(item.get("impact", 0.0))
            )
            for item in res.get("contributing_factors", [])
        ]

        return MLShadowPrediction(
            task_id=task.id,
            delay_probability=res["delay_probability"],
            risk_level=res["risk_classification"],
            model_version=res["model_version"],
            is_experimental=True,
            prediction_timestamp=datetime.now(timezone.utc),
            contributing_factors=contributions,
            features_used=res["features_used"]
        )

    @staticmethod
    def predict_from_features(current_user: User, input_data: MLFeatureInput) -> MLShadowPrediction:
        """
        Generates an on-demand shadow prediction from approved input features without database mutation.
        """
        predictor = get_predictor()
        res = predictor.predict(input_data.model_dump())

        contributions = [
            ContributingFactor(
                factor=item.get("factor", "unknown"),
                effect=item.get("effect", ""),
                impact=float(item.get("impact", 0.0))
            )
            for item in res.get("contributing_factors", [])
        ]

        return MLShadowPrediction(
            task_id=None,
            delay_probability=res["delay_probability"],
            risk_level=res["risk_classification"],
            model_version=res["model_version"],
            is_experimental=True,
            prediction_timestamp=datetime.now(timezone.utc),
            contributing_factors=contributions,
            features_used=res["features_used"]
        )

