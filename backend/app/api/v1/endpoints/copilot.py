from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user
from app.models.organization import User
from app.schemas.ml import CopilotTaskAssessment
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    SuggestedPromptItem,
    HRDailyBriefingResponse,
)
from app.services.copilot_service import CopilotService

router = APIRouter(prefix="/copilot", tags=["HR Operations Copilot (Decision Support)"])


@router.post("/chat", response_model=CopilotChatResponse, status_code=status.HTTP_200_OK)
def copilot_chat(
    chat_request: CopilotChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Submits a user query to the grounded HR Operations Copilot.
    
    Uses multi-turn tool calling against real database records.
    Enforces strict role-based access control, source citations, and zero-hallucination grounding.
    Falls back gracefully to the deterministic grounded engine when offline.
    """
    return CopilotService.chat(
        db=db,
        current_user=current_user,
        message=chat_request.message,
        conversation_id=chat_request.conversation_id,
    )


@router.get("/suggested-prompts", response_model=List[SuggestedPromptItem], status_code=status.HTTP_200_OK)
def get_copilot_suggested_prompts(
    current_user: User = Depends(require_active_user)
):
    """
    Returns curated, role-tailored operational prompt suggestions for the chat interface.
    """
    return CopilotService.get_suggested_prompts(current_user=current_user)


@router.get("/daily-briefing", response_model=HRDailyBriefingResponse, status_code=status.HTTP_200_OK)
@router.get("/briefing", response_model=HRDailyBriefingResponse, status_code=status.HTTP_200_OK)
def get_hr_daily_briefing(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieves or generates the AI-powered daily operational briefing for the HR Dashboard.
    Grounded strictly in real-time operational database counts and milestones.
    """
    return CopilotService.get_daily_briefing(
        db=db,
        current_user=current_user,
        department_id=department_id,
    )


@router.get("/task-risk-assessment/{task_id}", response_model=CopilotTaskAssessment, status_code=status.HTTP_200_OK)
def get_copilot_task_risk_assessment(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve grounded Copilot operational assessment for a task.
    
    Synthesizes verified task status with probabilistic shadow ML predictions.
    Explains contributing factors non-causally and enforces human-in-the-loop oversight.
    """
    return CopilotService.get_task_risk_assessment(db=db, current_user=current_user, task_id=task_id)


@router.get("/recommendations", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
def list_copilot_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List active AI Operational Recommendations for human review and action.
    """
    return CopilotService.list_recommendations(db=db, current_user=current_user)


@router.get("/operational-summary", response_model=Optional[Dict[str, Any]], status_code=status.HTTP_200_OK)
def get_latest_operational_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve the latest periodic AI Operational Summary.
    """
    return CopilotService.get_latest_operational_summary(db=db, current_user=current_user)

