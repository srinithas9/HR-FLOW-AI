import time
import uuid
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc

from app.models.organization import User, Employee
from app.models.workflow import Task
from app.models.intelligence import AIRecommendation, AIOperationalSummary
from app.schemas.ml import CopilotTaskAssessment, MLShadowPrediction
from app.schemas.copilot import (
    CopilotChatResponse,
    HRDailyBriefingResponse,
    SuggestedPromptItem,
)
from app.core.exceptions import ResourceNotFoundException, PermissionDeniedException
from app.services.task_service import TaskService
from app.services.ml_inference_service import MLInferenceService
from app.core.llm_provider import LLMProvider


# In-memory bounded session conversation cache (user isolated)
# { conversation_id: { "user_id": int, "history": [ {"role": "user"|"assistant", "content": str} ], "last_active": float } }
_CONVERSATION_CACHE: Dict[str, Dict[str, Any]] = {}
MAX_CONVERSATION_AGE_SECONDS = 86400  # 24 hours


class CopilotService:
    """
    HR Operations Copilot Integration Service (Module 7B).
    
    Provides grounded operational assessments using verified database state
    and supplementary shadow-mode ML risk predictions under strict human oversight.
    """

    @classmethod
    def _clean_stale_conversations(cls):
        now = time.time()
        to_del = [
            cid for cid, data in _CONVERSATION_CACHE.items()
            if now - data.get("last_active", 0) > MAX_CONVERSATION_AGE_SECONDS
        ]
        for cid in to_del:
            _CONVERSATION_CACHE.pop(cid, None)

    @classmethod
    def chat(
        cls,
        db: Session,
        current_user: User,
        message: str,
        conversation_id: Optional[str] = None,
    ) -> CopilotChatResponse:
        """
        Processes an authenticated HR chat message through the grounded LLM / tool-calling loop.
        Guarantees strict role scoping and user conversation isolation.
        """
        cls._clean_stale_conversations()

        if not conversation_id or conversation_id not in _CONVERSATION_CACHE:
            cid = conversation_id or str(uuid.uuid4())
            _CONVERSATION_CACHE[cid] = {
                "user_id": current_user.id,
                "history": [],
                "session_context": {},
                "last_active": time.time(),
            }
        else:
            cid = conversation_id
            session_data = _CONVERSATION_CACHE[cid]
            # Enforce user boundary
            if session_data["user_id"] != current_user.id:
                raise PermissionDeniedException("Access denied to conversation history belonging to another user.")
            session_data["last_active"] = time.time()

        history = _CONVERSATION_CACHE[cid]["history"]
        session_context = _CONVERSATION_CACHE[cid].setdefault("session_context", {})

        # Run grounded completion loop
        response = LLMProvider.chat_completion(
            message=message,
            conversation_id=cid,
            history=history,
            session_context=session_context,
            db=db,
            current_user=current_user,
        )

        # Update session history (bounded to last 10 messages)
        history.append({"role": "user", "content": message})
        history.append({"role": "assistant", "content": response.assistant_message})
        _CONVERSATION_CACHE[cid]["history"] = history[-10:]

        return response

    @classmethod
    def get_daily_briefing(
        cls,
        db: Session,
        current_user: User,
        department_id: Optional[int] = None,
    ) -> HRDailyBriefingResponse:
        """
        Generates or retrieves the daily operational briefing for the authenticated user.
        """
        return LLMProvider.generate_daily_briefing(
            db=db,
            current_user=current_user,
            department_id=department_id,
        )

    @classmethod
    def get_suggested_prompts(cls, current_user: User) -> List[SuggestedPromptItem]:
        """
        Provides operational suggested prompts tailored for HR users.
        """
        role_code = current_user.role.role_code if current_user.role else "USER"
        
        base_prompts = [
            SuggestedPromptItem(
                id="p1",
                title="Today's Priorities",
                prompt="What needs my attention today?",
                category="Daily Focus",
            ),
            SuggestedPromptItem(
                id="p2",
                title="Overdue Tasks",
                prompt="Show overdue HR tasks that require immediate action",
                category="Action Items",
            ),
            SuggestedPromptItem(
                id="p3",
                title="Probation Reviews",
                prompt="Which probation reviews are due this week?",
                category="Lifecycle",
            ),
            SuggestedPromptItem(
                id="p4",
                title="Pending Follow-ups",
                prompt="Are any follow-ups currently waiting for a response?",
                category="Touchpoints",
            ),
            SuggestedPromptItem(
                id="p5",
                title="Operational Bottlenecks",
                prompt="What operational bottlenecks are affecting our workflows right now?",
                category="Analytics",
            ),
            SuggestedPromptItem(
                id="p6",
                title="Draft Follow-up",
                prompt="Draft a polite follow-up message for task 3268",
                category="Assistance",
            ),
        ]

        if role_code == "REPORTING_MANAGER":
            return [
                SuggestedPromptItem(
                    id="pm1",
                    title="Team Attention Items",
                    prompt="What tasks need my attention for my direct reports today?",
                    category="Team Focus",
                ),
                SuggestedPromptItem(
                    id="pm2",
                    title="Team Probation Due",
                    prompt="Which of my team members have probation reviews approaching?",
                    category="Appraisals",
                ),
                SuggestedPromptItem(
                    id="pm3",
                    title="Pending Team Approvals",
                    prompt="Are there any pending confirmation approvals for my team?",
                    category="Approvals",
                ),
                SuggestedPromptItem(
                    id="pm4",
                    title="Overdue Team Tasks",
                    prompt="Show overdue tasks assigned to my direct reports",
                    category="Action Items",
                ),
            ]

        return base_prompts

    # -----------------------------------------------------------------------
    # Backward-compatible endpoints (Phase 7B audit continuity)
    # -----------------------------------------------------------------------
    @staticmethod
    def get_task_risk_assessment(db: Session, current_user: User, task_id: int) -> CopilotTaskAssessment:
        task = db.scalar(select(Task).where(Task.id == task_id))
        if not task:
            raise ResourceNotFoundException(f"Task with ID {task_id} does not exist.")

        TaskService._verify_reporting_manager_scope(db, current_user, task.employee_id)

        today = date.today()
        is_overdue = task.due_date < today and task.status not in ["COMPLETED", "CANCELLED"]

        shadow_pred = MLInferenceService.predict_for_task(db=db, current_user=current_user, task_id=task_id)

        prob_pct = round(shadow_pred.delay_probability * 100, 1)
        tier = shadow_pred.risk_level
        factors_summary = "; ".join([f"{f.factor} ({f.effect})" for f in shadow_pred.contributing_factors[:3]])

        interpretation = (
            f"Task {task.task_code} has verified status '{task.status}' and due date {task.due_date.isoformat()}. "
            f"Under ML model {shadow_pred.model_version}, the estimated probability of completion delay is {prob_pct}% ({tier} RISK tier). "
            f"This probabilistic estimate is non-causal and reflects operational patterns: {factors_summary}. "
            "It does NOT evaluate employee performance or individual capability."
        )

        actions = []
        if tier == "HIGH":
            actions.append("Manager check-in: Schedule a brief touchpoint with the task assignee to discuss workflow roadblocks.")
            actions.append("Dependency check: Review upstream prerequisites to ensure required documents or approvals are unlocked.")
        elif tier == "MEDIUM":
            actions.append("Monitor milestone progress: Keep task on operational watch list for mid-cycle check.")
        else:
            actions.append("Standard execution: Task is tracking within standard operational variance buffer.")

        return CopilotTaskAssessment(
            task_id=task.id,
            task_code=task.task_code,
            task_title=task.title,
            official_status=task.status,
            due_date=task.due_date.isoformat(),
            is_overdue=is_overdue,
            shadow_prediction=shadow_pred,
            copilot_interpretation=interpretation,
            recommended_supportive_actions=actions
        )

    @staticmethod
    def list_recommendations(db: Session, current_user: User) -> List[Dict[str, Any]]:
        stmt = (
            select(AIRecommendation)
            .where(
                and_(
                    AIRecommendation.status.in_(["PENDING", "SNOOZED"]),
                    (AIRecommendation.user_id == current_user.id) if current_user.role.role_code == "REPORTING_MANAGER" else True
                )
            )
            .order_by(desc(AIRecommendation.created_at))
            .limit(20)
        )
        recs = db.scalars(stmt).all()
        return [
            {
                "id": r.id,
                "title": r.title,
                "explanation": r.explanation,
                "recommended_action": r.recommended_action,
                "priority": r.priority,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "supporting_evidence": r.supporting_evidence
            }
            for r in recs
        ]

    @staticmethod
    def get_latest_operational_summary(
        db: Session,
        current_user: Optional[User] = None
    ) -> Optional[Dict[str, Any]]:
        stmt = select(AIOperationalSummary)
        if current_user and current_user.role:
            role_code = current_user.role.role_code
            if role_code == "ADMIN":
                stmt = stmt.where(AIOperationalSummary.target_role == "ADMIN")
            elif role_code == "HR_MANAGER":
                stmt = stmt.where(AIOperationalSummary.target_role == "HR_MANAGER")
            elif role_code in ["HR_EXECUTIVE", "HR_OPERATIONS"]:
                stmt = stmt.where(AIOperationalSummary.target_role == "HR_OPERATIONS")
            elif role_code in ["REPORTING_MANAGER", "PEOPLE_MANAGER"]:
                return None
            else:
                return None

        stmt = stmt.order_by(desc(AIOperationalSummary.generated_at)).limit(1)
        summary = db.scalar(stmt)
        if not summary:
            return None
        return {
            "id": summary.id,
            "title": summary.title,
            "summary_type": summary.summary_type,
            "target_role": summary.target_role,
            "period_start": summary.period_start.isoformat(),
            "period_end": summary.period_end.isoformat(),
            "executive_summary": summary.executive_summary,
            "key_metrics": summary.key_metrics,
            "critical_bottlenecks": summary.critical_bottlenecks,
            "action_items": summary.action_items,
            "generated_at": summary.generated_at.isoformat()
        }
