from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.ml import MLFeatureInput, MLShadowPrediction
from app.services.ml_inference_service import MLInferenceService

router = APIRouter(prefix="/ml", tags=["Machine Learning Inference (Shadow Mode)"])


@router.get("/tasks/{task_id}/prediction", response_model=MLShadowPrediction, status_code=status.HTTP_200_OK)
def get_task_shadow_prediction(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve real-time calibrated task delay risk prediction in shadow mode.
    
    Operates strictly read-only: does NOT mutate task state, due date, follow-ups,
    notifications, or database records. Respects role-based access scoping.
    """
    return MLInferenceService.predict_for_task(db=db, current_user=current_user, task_id=task_id)


@router.post("/predict", response_model=MLShadowPrediction, status_code=status.HTTP_200_OK)
def predict_task_risk_standalone(
    features: MLFeatureInput,
    current_user: User = Depends(require_active_user)
):
    """
    Calculate delay risk for an arbitrary set of the 8 approved operational features.
    
    Rejects any unauthorized keys or identifiers (e.g. employee_id, task_id).
    """
    return MLInferenceService.predict_from_features(current_user=current_user, input_data=features)

