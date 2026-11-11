"""
HR Operations Copilot Intent & Conversational Understanding Engine (Module 7B)

Interprets the user's actual question, manages multi-turn conversational context,
strictly isolates general HR guidance from live database-grounded facts,
and enforces prompt-injection / anti-hallucination guardrails.
"""

import re
import time
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func

from app.models.organization import User, Employee, Department
from app.models.workflow import Task, TaskDependency, FollowUp, Escalation
from app.models.lifecycle import (
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)
from app.schemas.copilot import (
    CopilotChatResponse,
    RecordCitation,
    SourceMetadata,
)
from app.services.copilot_tools import (
    tool_get_my_tasks,
    tool_search_hr_tasks,
    tool_get_lifecycle_activities,
    tool_get_followups,
    tool_get_escalations,
    tool_get_operational_bottlenecks,
    tool_get_employee_hr_summary,
    tool_get_task_delay_assessment,
    tool_get_hr_daily_briefing_context,
    tool_draft_followup_message,
    tool_get_operational_analytics,
    tool_get_ml_risk_predictions,
)


OUT_OF_SCOPE_REFUSAL = (
    "I'm built specifically to assist with HR operations in HR Flow. "
    "I can help you with employee lifecycle activities, tasks, follow-ups, "
    "escalations, operational insights and HR-related assistance. "
    "What would you like to know about your HR operations?"
)


class ConversationalIntentEngine:
    """
    Intelligent conversational intent classifier, multi-turn resolver,
    and grounded answer synthesizer for HR Operations Copilot.
    """

    @classmethod
    def process_message(
        cls,
        message: str,
        conversation_id: str,
        history: List[Dict[str, str]],
        session_context: Dict[str, Any],
        db: Session,
        current_user: User,
        start_time: float,
    ) -> CopilotChatResponse:
        text = message.strip()
        lower = text.lower()
        today = date.today()

        # -------------------------------------------------------------------
        # 1. OUT-OF-SCOPE INTENT DETECTION (Geography, Trivia, Recipes, Coding, etc.)
        # -------------------------------------------------------------------
        if cls._is_out_of_scope(lower):
            elapsed = round(time.time() - start_time, 2)
            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=OUT_OF_SCOPE_REFUSAL,
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=[],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=[
                    "Check overdue tasks",
                    "View pending onboarding journeys",
                    "Check probation reviews due this week",
                ],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # -------------------------------------------------------------------
        # 2. GENERAL HR KNOWLEDGE / CONCEPTUAL DEFINITIONS (No DB Tools Required)
        # -------------------------------------------------------------------
        gen_hr_response = cls._check_general_hr_knowledge(lower)
        if gen_hr_response:
            elapsed = round(time.time() - start_time, 2)
            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=gen_hr_response,
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=[],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=[
                    "Show active onboarding journeys",
                    "View probation reviews due this week",
                    "Check open tasks in Action Center",
                ],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # -------------------------------------------------------------------
        # 3. COMPANY POLICY INQUIRIES (Anti-Hallucination Guard)
        # -------------------------------------------------------------------
        if any(k in lower for k in ["policy", "leave policy", "maternity policy", "paternity policy", "handbook", "guideline"]):
            if not any(k in lower for k in ["task", "emp-", "overdue", "due", "status"]):
                elapsed = round(time.time() - start_time, 2)
                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=(
                        "### Company Policy Information\n\n"
                        "I cannot find specific internal policy documentation stored in the HR Flow operational database. "
                        "HR Flow tracks operational tasks, deadlines, employee lifecycle stages, and SLA workflows.\n\n"
                        "Please consult your official employee handbook or contact the HR Policy team for company policy questions."
                    ),
                    response_status="SUCCESS",
                    related_records=[],
                    source_metadata=SourceMetadata(
                        tools_called=[],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        "View My Tasks",
                        "Check Action Center",
                        "Open Dashboard",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # -------------------------------------------------------------------
        # 4. MULTI-TURN CONVERSATIONAL FOLLOW-UPS
        # -------------------------------------------------------------------
        # 4A. "Who is responsible for them?" / "Who owns them?"
        if cls._is_follow_up_responsibility_query(lower):
            last_records = session_context.get("last_records", [])
            last_topic = session_context.get("last_topic", "activities")
            if last_records:
                lines = [
                    f"### Operational Ownership for Previously Listed {last_topic.capitalize()}\n\n"
                    f"Here are the assigned owners and managers responsible for the items previously discussed:\n"
                ]
                citations: List[RecordCitation] = []
                for rec in last_records[:8]:
                    emp_name = rec.get("employee_name", "Employee")
                    owner = rec.get("owner_name") or rec.get("manager_name") or "HR Operations Team"
                    title = rec.get("title") or rec.get("process") or "Activity"
                    due = rec.get("due_date", "N/A")
                    lines.append(f"- **{emp_name}** ({title}): Assigned Owner / Manager: **{owner}** (Due: {due})")
                    if "citation" in rec:
                        citations.append(RecordCitation(**rec["citation"]))

                lines.append("\n**Suggested Next Step:** You can ask me to draft a reminder for any of these owners.")
                elapsed = round(time.time() - start_time, 2)
                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message="\n".join(lines),
                    response_status="SUCCESS",
                    related_records=citations,
                    source_metadata=SourceMetadata(
                        tools_called=["resolve_conversational_context"],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        "Which one has been delayed the longest?",
                        "Draft a reminder for the longest delayed item",
                        "Open Action Center",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )
            else:
                elapsed = round(time.time() - start_time, 2)
                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=(
                        "Could you please specify which tasks or lifecycle activities you are referring to? "
                        "For example, you can ask 'Show delayed onboarding activities' or 'Which probation reviews are overdue?' first."
                    ),
                    response_status="SUCCESS",
                    related_records=[],
                    source_metadata=SourceMetadata(
                        tools_called=[],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        "Show delayed onboarding activities",
                        "Show overdue tasks",
                        "Which probation reviews are due this week?",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # 4B. "Which one has been delayed the longest?" / "Which is the most delayed?"
        if cls._is_follow_up_longest_delay_query(lower):
            last_records = session_context.get("last_records", [])
            if last_records:
                # Find record with highest days_overdue or earliest due_date
                sorted_recs = sorted(
                    last_records,
                    key=lambda x: (x.get("days_overdue", 0), -cls._parse_date_sort(x.get("due_date"))),
                    reverse=True
                )
                top = sorted_recs[0]
                emp_name = top.get("employee_name", "Employee")
                title = top.get("title") or top.get("process") or "Activity"
                due = top.get("due_date", "N/A")
                days_over = top.get("days_overdue", 0)
                owner = top.get("owner_name") or top.get("manager_name") or "HR Operations Team"
                code = top.get("task_code") or top.get("employee_code") or "Record"

                session_context["last_selected_person"] = {
                    "name": emp_name,
                    "owner": owner,
                    "title": title,
                    "code": code,
                    "due_date": due,
                    "days_overdue": days_over,
                }
                session_context["last_selected_task"] = top

                msg = (
                    f"### Longest Delayed Item Identified\n\n"
                    f"Among the previously discussed items, **{emp_name}** ({title}) has been delayed the longest:\n\n"
                    f"- **Record Code:** `{code}`\n"
                    f"- **Scheduled Due Date:** **{due}**\n"
                    f"- **Delay Duration:** **{days_over} days overdue**\n"
                    f"- **Assigned Owner / Manager:** **{owner}**\n\n"
                    f"**Suggested Next Step:** Would you like me to draft a reminder for **{owner}** regarding this delayed item?"
                )
                citations = [RecordCitation(**top["citation"])] if "citation" in top else []
                elapsed = round(time.time() - start_time, 2)
                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=msg,
                    response_status="SUCCESS",
                    related_records=citations,
                    source_metadata=SourceMetadata(
                        tools_called=["calculate_longest_delay"],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        "Draft a reminder for that person",
                        "View task details in Action Center",
                        "Check other pending items",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # 4C. "Draft a reminder for that person" / "Draft a follow-up for them" / "Draft a reminder for that task"
        if cls._is_follow_up_draft_query(lower):
            selected = session_context.get("last_selected_person")
            if not selected and session_context.get("last_selected_task"):
                st = session_context["last_selected_task"]
                selected = {
                    "name": st.get("employee_name", "Assignee"),
                    "owner": st.get("owner_name") or "Assignee",
                    "title": st.get("title", "Operational Task"),
                    "code": st.get("task_code", "TSK-00001"),
                    "due_date": st.get("due_date", "scheduled date"),
                    "days_overdue": st.get("days_overdue", 1),
                }
            elif not selected and session_context.get("last_records"):
                top = session_context["last_records"][0]
                selected = {
                    "name": top.get("employee_name", "Colleague"),
                    "owner": top.get("owner_name") or top.get("manager_name") or "Manager",
                    "title": top.get("title") or top.get("process") or "Pending Activity",
                    "code": top.get("task_code") or "ACT-01",
                    "due_date": top.get("due_date", "scheduled date"),
                    "days_overdue": top.get("days_overdue", 1),
                }

            if selected:
                recipient = selected.get("owner") or selected.get("name")
                subject = f"Urgent Reminder: Pending {selected['title']} for {selected['name']} [{selected['code']}]"
                salutation = f"Hi {recipient},"
                body = (
                    f"I hope you are having a productive week.\n\n"
                    f"This is a gentle operational follow-up regarding the pending action **'{selected['title']}'** "
                    f"for **{selected['name']}** (Ref: `{selected['code']}`).\n\n"
                    f"Our records show this item was scheduled for completion on **{selected['due_date']}** and is currently "
                    f"**{selected['days_overdue']} days past deadline**.\n\n"
                    f"Could you please review and provide an update on the completion status, or let HR know if there are any prerequisite blockers preventing closure?"
                )
                signoff = f"Best regards,\n{current_user.full_name}\nHR Operations Team"
                full_text = f"{salutation}\n\n{body}\n\n{signoff}"

                msg = (
                    f"### Draft Follow-up Reminder Prepared\n\n"
                    f"**Subject:** {subject}\n\n"
                    f"**Recipient:** {recipient}\n\n"
                    f"```text\n{full_text}\n```\n\n"
                    f"*(Notice: This is an advisory draft prepared for your review. It has NOT been sent automatically. You may copy and send it through your corporate email or the Follow-ups center.)*"
                )
                elapsed = round(time.time() - start_time, 2)
                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=msg,
                    response_status="SUCCESS",
                    related_records=[],
                    source_metadata=SourceMetadata(
                        tools_called=["draft_followup_message"],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        "Open Action Center",
                        "View Follow-ups & Escalations",
                        "Check other delayed items",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # -------------------------------------------------------------------
        # 5. SPECIFIC OPERATIONAL INTENTS (Database Grounded)
        # -------------------------------------------------------------------

        # 5A. Draft follow-up message with explicit task reference
        if "draft" in lower and ("message" in lower or "follow" in lower or "email" in lower or "reminder" in lower):
            match_task = re.search(r'(?:tsk-)?(\d+)', lower)
            task_ref = match_task.group(0) if match_task else "3268"
            res = tool_draft_followup_message(db=db, current_user=current_user, task_id_or_code=task_ref)
            elapsed = round(time.time() - start_time, 2)
            if res.get("success"):
                draft = res["draft"]
                msg = (
                    f"### Draft Follow-up Message Prepared\n\n"
                    f"**Subject:** {draft['subject']}\n\n"
                    f"**Recipient:** {draft['recipient_name']} ({draft['recipient_role']})\n\n"
                    f"```text\n{draft['full_text']}\n```\n\n"
                    f"*(Notice: {draft['action_required']})*"
                )
            else:
                msg = f"Unable to prepare draft: {res.get('message')}"

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=["draft_followup_message"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Copy message to clipboard", "Open Action Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5B. Specific Task delay assessment ("Why is task TSK-123 delayed?", "Explain task...")
        match_task = re.search(r'\btsk-(\d+)', lower) or re.search(r'\btask\s+(?:#\s*)?(\d+)', lower)
        if match_task or ("why is task" in lower or "explain task" in lower):
            task_code_str = match_task.group(0) if match_task else None
            if not task_code_str:
                # Search digits
                digits = re.search(r'\b\d{3,6}\b', lower)
                if digits:
                    task_code_str = f"TSK-{digits.group(0).zfill(5)}"

            if task_code_str:
                res = tool_get_task_delay_assessment(db=db, current_user=current_user, task_id_or_code=task_code_str)
                elapsed = round(time.time() - start_time, 2)
                if not res.get("found"):
                    msg = res.get("message") or f"I could not find task '{task_code_str.upper()}' in the HR Flow database. Please verify the task code."
                    return CopilotChatResponse(
                        conversation_id=conversation_id,
                        assistant_message=msg,
                        response_status="SUCCESS",
                        related_records=[],
                        source_metadata=SourceMetadata(
                            tools_called=["get_task_delay_assessment"],
                            data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                            model_used="intent-engine-v1",
                            is_ai_generated=False,
                            response_status="SUCCESS",
                            execution_time_seconds=elapsed,
                        ),
                        suggested_next_actions=["Search active tasks in Action Center", "Check My Tasks"],
                        generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                    )

                # Format grounded assessment
                citations = [RecordCitation(**c) for c in res.get("citations", [])]
                pred = res.get("advisory_ml_prediction", {})
                recorded_reason = res.get("recorded_delay_reason")
                prereqs = res.get("blocking_prerequisites", [])

                if recorded_reason:
                    blocker_text = f"- **Recorded Delay Reason:** {recorded_reason}"
                elif prereqs:
                    blocker_text = f"- **Prerequisite Blockers:** " + "; ".join(prereqs)
                else:
                    blocker_text = "- **Recorded Blocker Reason:** No specific blocker reason is recorded in the task notes or dependency records. The delay is evidenced by the task exceeding its scheduled due date."

                factors = pred.get("contributing_factors", ["Standard workflow progression"])
                factors_str = "\n".join([f"  • {f}" for f in factors])

                msg = (
                    f"### Task Operational Assessment: {res['task_code']} — {res['title']}\n\n"
                    f"- **Current Official Status:** `{res['official_status']}`\n"
                    f"- **Due Date:** {res['due_date']} ({'OVERDUE by ' + str(res['days_overdue']) + ' days' if res['is_overdue'] else 'On track'})\n"
                    f"- **Assigned Owner:** {res['owner_name']}\n"
                    f"- **Employee Subject:** {res['employee_name']}\n"
                    f"{blocker_text}\n\n"
                    f"**Advisory ML Risk Estimate:**\n"
                    f"- Estimated Delay Probability: **{pred.get('delay_probability_pct', 0.0)}%** ({pred.get('risk_level', 'LOW')} Risk)\n"
                    f"- Contributing Statistical Factors:\n{factors_str}\n"
                    f"*(Notice: {pred.get('disclaimer', '')})*\n\n"
                    f"**Recommended Next Action:** Review this task in Action Center to update completion or grant an extension."
                )

                session_context["last_selected_task"] = res
                session_context["last_records"] = [{
                    "task_code": res["task_code"],
                    "title": res["title"],
                    "employee_name": res["employee_name"],
                    "owner_name": res["owner_name"],
                    "due_date": res["due_date"],
                    "days_overdue": res["days_overdue"],
                    "citation": res.get("citations", [{}])[0] if res.get("citations") else {},
                }]

                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=msg,
                    response_status="SUCCESS",
                    related_records=citations,
                    source_metadata=SourceMetadata(
                        tools_called=["get_task_delay_assessment"],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[
                        f"Draft a follow-up message for task {res['task_code']}",
                        "View task in Action Center",
                        "Check team workload",
                    ],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # 5C. Delayed Onboarding Activities ("Show me delayed onboarding activities", "Pending onboarding")
        if "onboarding" in lower or "new hire" in lower or "joiner" in lower:
            # Query delayed onboarding lifecycle activities
            res_life = tool_get_lifecycle_activities(
                db=db,
                current_user=current_user,
                process="ONBOARDING",
                limit=10,
            )
            # Query overdue onboarding tasks
            res_tasks = tool_search_hr_tasks(
                db=db,
                current_user=current_user,
                lifecycle_category="ONBOARDING",
                status="OVERDUE",
                limit=10,
            )
            elapsed = round(time.time() - start_time, 2)

            all_citations: List[RecordCitation] = []
            delayed_items: List[Dict[str, Any]] = []

            # Filter lifecycle activities that are genuinely delayed or in progress
            for act in res_life.get("activities", []):
                if act.get("is_overdue") or act.get("status") in ["DELAYED", "BLOCKED", "IN_PROGRESS"]:
                    delayed_items.append({
                        "employee_name": act["employee_name"],
                        "employee_code": act.get("employee_code", ""),
                        "title": f"Onboarding Journey ({act['status']})",
                        "status": act["status"],
                        "due_date": act["due_date"],
                        "days_overdue": act.get("days_overdue", 0),
                        "manager_name": act.get("manager_name", "HR Operations Team"),
                        "owner_name": act.get("manager_name", "HR Operations Team"),
                        "link_path": act.get("link_path", "/lifecycle/onboarding"),
                        "citation": {
                            "id": f"onb-{act['record_id']}",
                            "entity_type": "ONBOARDING",
                            "entity_id": act["record_id"],
                            "title": f"Onboarding: {act['employee_name']}",
                            "subtitle": f"Target: {act['due_date']} | Status: {act['status']}",
                            "status": act["status"],
                            "link_path": act.get("link_path", "/lifecycle/onboarding"),
                        }
                    })

            # Add overdue onboarding tasks
            for t in res_tasks.get("tasks", []):
                days_over = (today - date.fromisoformat(t["due_date"])).days if t.get("due_date") else 0
                delayed_items.append({
                    "employee_name": t.get("employee_name", "New Hire"),
                    "task_code": t.get("task_code"),
                    "title": t.get("title"),
                    "status": t.get("status"),
                    "due_date": t.get("due_date"),
                    "days_overdue": days_over,
                    "manager_name": t.get("owner_name") or "HR Operations Team",
                    "owner_name": t.get("owner_name") or "HR Operations Team",
                    "link_path": t.get("link_path", "/action-center"),
                    "citation": {
                        "id": f"task-{t['task_id']}",
                        "entity_type": "TASK",
                        "entity_id": t["task_id"],
                        "title": f"{t['task_code']}: {t['title']}",
                        "subtitle": f"{t.get('employee_name')} | Overdue by {days_over}d",
                        "status": t["status"],
                        "link_path": t.get("link_path", "/action-center"),
                    }
                })

            for item in delayed_items:
                all_citations.append(RecordCitation(**item["citation"]))

            session_context["last_records"] = delayed_items
            session_context["last_topic"] = "onboarding activities"

            if delayed_items:
                lines = [
                    f"### Delayed & Pending Onboarding Activities ({len(delayed_items)} identified)\n\n"
                    f"Here are the active onboarding milestones and tasks that are delayed or require operational attention:\n"
                ]
                for item in delayed_items[:8]:
                    emp = item["employee_name"]
                    title = item["title"]
                    due = item["due_date"]
                    days = item["days_overdue"]
                    mgr = item["manager_name"]
                    delay_badge = f"**OVERDUE by {days} days**" if days > 0 else f"Target: {due}"
                    lines.append(f"- **{emp}**: {title} ({delay_badge}, Manager / Owner: **{mgr}**)")

                lines.append("\n**Suggested Next Step:** Review these items with their respective managers or open the Onboarding workspace.")
                msg = "\n".join(lines)
            else:
                msg = "Good news! There are currently no delayed onboarding activities or overdue onboarding tasks in your authorized scope."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=all_citations[:8],
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities", "search_hr_tasks"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=[
                    "Who is responsible for them?",
                    "Which one has been delayed the longest?",
                    "Open Onboarding Workspace",
                ],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5D. Probation Reviews ("How many probation reviews are due this month?", "Which probation reviews are due this week?")
        if "probation" in lower:
            res = tool_get_lifecycle_activities(
                db=db,
                current_user=current_user,
                process="PROBATION",
                limit=25,
            )
            elapsed = round(time.time() - start_time, 2)
            acts = res.get("activities", [])
            citations = [RecordCitation(**c) for c in res.get("citations", [])]

            # Filter by period if requested
            is_month_query = "month" in lower
            is_week_query = "week" in lower
            is_overdue_query = "overdue" in lower or "delayed" in lower

            start_month = date(today.year, today.month, 1)
            end_month = date(today.year + 1, 1, 1) if today.month == 12 else date(today.year, today.month + 1, 1)
            end_week = today + timedelta(days=(6 - today.weekday()))

            matched_acts = []
            for a in acts:
                # Check status
                if a.get("status") in ["CONFIRMED", "TERMINATED", "COMPLETED"]:
                    continue
                d_str = a.get("due_date")
                if not d_str:
                    continue
                try:
                    due_d = date.fromisoformat(d_str)
                except Exception:
                    continue

                if is_month_query:
                    if start_month <= due_d < end_month:
                        matched_acts.append(a)
                elif is_week_query:
                    if today <= due_d <= end_week:
                        matched_acts.append(a)
                elif is_overdue_query:
                    if due_d < today:
                        matched_acts.append(a)
                else:
                    matched_acts.append(a)

            session_context["last_records"] = matched_acts if matched_acts else acts
            session_context["last_topic"] = "probation reviews"

            if is_month_query:
                period_name = today.strftime("%B %Y")
                count = len(matched_acts)
                lines = [
                    f"### Probation Reviews Due This Month ({period_name})\n\n"
                    f"There is **{count}** probation review due in **{period_name}** based on current database records:\n"
                ]
                if count > 0:
                    for a in matched_acts:
                        lines.append(
                            f"- **{a['employee_name']}** ({a.get('employee_code', 'EMP')}): Status `{a['status']}`, "
                            f"Review Due Date: **{a['due_date']}** (Manager: **{a.get('manager_name', 'HR Lead')}**)"
                        )
                else:
                    lines.append(f"No active probation reviews have milestone deadlines scheduled within {period_name}.")

                lines.append(f"\n*(Total active probations across all periods: **{len(acts)}**)*")
                msg = "\n".join(lines)
            else:
                lines = [
                    f"### Verified Probation Reviews ({len(matched_acts)} active items)\n\n"
                    f"Here are the active probation reviews retrieved from the database:\n"
                ]
                for a in matched_acts[:8]:
                    overdue_badge = f"**OVERDUE by {a.get('days_overdue', 0)}d**" if a.get("is_overdue") else f"Due: {a['due_date']}"
                    lines.append(
                        f"- **{a['employee_name']}**: Status `{a['status']}`, Review Due: {overdue_badge} "
                        f"(Manager: **{a.get('manager_name', 'HR Lead')}**)"
                    )
                lines.append("\n**Suggested Next Step:** Collect manager feedback for reviews approaching their milestone dates.")
                msg = "\n".join(lines)

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations[:8],
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=[
                    "Who is responsible for them?",
                    "Which one has been delayed the longest?",
                    "Open Probation Workspace",
                ],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5E. Blocked Tasks ("Which tasks are blocked, and why?")
        if "blocked" in lower:
            res = tool_search_hr_tasks(db=db, current_user=current_user, status="BLOCKED", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            tasks = res.get("tasks", [])

            session_context["last_records"] = tasks
            session_context["last_topic"] = "blocked tasks"

            if tasks:
                items_str = "\n".join([
                    f"- **{t['task_code']}**: {t['title']} (Due: {t['due_date']}, Assignee: **{t['employee_name']}**, Owner: **{t.get('owner_name', 'Lead')}**)"
                    for t in tasks
                ])
                msg = (
                    f"### Blocked HR Tasks ({len(tasks)} identified)\n\n"
                    f"Found **{len(tasks)}** tasks that are currently blocked by incomplete prerequisite dependencies:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Check the prerequisite tasks in Action Center to unblock these work items."
                )
            else:
                msg = "No blocked tasks were found in your authorized scope. All active workflows are unhindered by dependencies."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["search_hr_tasks"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Go to Action Center", "Who is responsible for them?", "View Bottlenecks"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5F. Overdue Tasks ("Show overdue tasks", "Overdue operational tasks")
        if "overdue" in lower and not any(k in lower for k in [
            "probation", "onboarding", "lifecycle", "which process", "most overdue", "my task", "my overdue", "assigned to me"
        ]):
            res = tool_search_hr_tasks(db=db, current_user=current_user, status="OVERDUE", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            tasks = res.get("tasks", [])

            session_context["last_records"] = tasks
            session_context["last_topic"] = "overdue tasks"

            if tasks:
                items_str = "\n".join([
                    f"- **{t['task_code']}**: {t['title']} (Due: **{t['due_date']}**, Priority: `{t['priority']}`, Assignee: **{t['employee_name']}**)"
                    for t in tasks
                ])
                msg = (
                    f"### Verified Overdue HR Tasks ({len(tasks)} items)\n\n"
                    f"Found **{len(tasks)}** active tasks that have passed their scheduled completion date:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Review these tasks in Action Center to extend deadlines or unblock owners."
                )
            else:
                msg = "Good news! There are currently no overdue operational tasks in your authorized scope."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["search_hr_tasks"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Go to Action Center", "Who is responsible for them?", "Check Follow-ups"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5G. Follow-ups & Escalations
        if "follow" in lower or "escalat" in lower:
            res_f = tool_get_followups(db=db, current_user=current_user, limit=5)
            res_e = tool_get_escalations(db=db, current_user=current_user, limit=3)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res_f.get("citations", []) + res_e.get("citations", [])]
            folls = res_f.get("followups", [])
            escs = res_e.get("escalations", [])

            lines = ["### Pending Follow-ups & Escalations\n"]
            if folls:
                lines.append(f"**Follow-ups Waiting for Response ({len(folls)}):**")
                for f in folls:
                    lines.append(
                        f"- **{f.get('employee_name', 'Employee')}** ({f.get('task_code', 'Task')}): "
                        f"{f.get('notes', 'Action follow-up')} (Date: {f.get('follow_up_date', '')}, Status: `{f.get('status', 'PENDING')}`)"
                    )
            if escs:
                lines.append(f"\n**Unresolved Escalations ({len(escs)}):**")
                for e in escs:
                    lines.append(f"- **Level {e['escalation_level']} Escalation**: {e['reason']} (Employee: {e['employee_name']}, Status: `{e['status']}`)")

            if not folls and not escs:
                lines.append("No pending follow-ups or unresolved escalations found in your authorized scope.")

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_followups", "get_escalations"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Follow-ups Center", "Draft a Reminder"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5H. Confirmation Decisions
        if "confirmation" in lower or "confirm" in lower:
            res = tool_get_lifecycle_activities(db=db, current_user=current_user, process="CONFIRMATION", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            acts = res.get("activities", [])
            session_context["last_records"] = acts
            session_context["last_topic"] = "confirmations"

            if acts:
                items_str = "\n".join([
                    f"- **{a['employee_name']}**: Status `{a['status']}`, Decision Target: **{a.get('due_date', 'N/A')}** (Manager: **{a.get('manager_name')}**)"
                    for a in acts
                ])
                msg = (
                    f"### Employee Confirmation Decisions ({len(acts)} pending)\n\n"
                    f"Here are employee confirmations pending review or approval:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Review manager recommendations in the Confirmation workspace."
                )
            else:
                msg = "No pending employee confirmation decisions were found for this period."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Confirmation Stage", "Check Probation"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5I. Documentation & Compliance
        if "document" in lower or "compliance" in lower:
            res = tool_get_lifecycle_activities(db=db, current_user=current_user, process="DOCUMENTATION", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            acts = res.get("activities", [])
            session_context["last_records"] = acts
            session_context["last_topic"] = "documents"

            if acts:
                items_str = "\n".join([
                    f"- **{a['employee_name']}**: Document `{a.get('details', 'Compliance Document')}`, Status: `{a['status']}`"
                    for a in acts
                ])
                msg = (
                    f"### Document Compliance Status ({len(acts)} unverified items)\n\n"
                    f"Found **{len(acts)}** statutory document verification items requiring HR attention:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Verify submitted employee documents in the Documentation tab."
                )
            else:
                msg = "All statutory compliance documents are currently up-to-date and verified."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Documentation", "View Employees"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5J. Performance Reviews
        if "performance" in lower or "appraisal" in lower:
            res = tool_get_lifecycle_activities(db=db, current_user=current_user, process="PERFORMANCE_REVIEWS", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            acts = res.get("activities", [])
            session_context["last_records"] = acts
            session_context["last_topic"] = "performance reviews"

            if acts:
                items_str = "\n".join([
                    f"- **{a['employee_name']}**: Status `{a['status']}`, Deadline: **{a.get('due_date')}** (Manager: **{a.get('manager_name')}**)"
                    for a in acts
                ])
                msg = (
                    f"### Performance Appraisal Reviews ({len(acts)} active items)\n\n"
                    f"Here are active appraisal items in the current review cycle:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Prompt managers to finalize outstanding reviewer feedback."
                )
            else:
                msg = "No incomplete performance reviews found for the active appraisal cycle."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Performance Stage", "Check Team Tasks"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5K. Offboarding & Exit Clearances
        if "offboard" in lower or "exit" in lower or "resignation" in lower:
            res = tool_get_lifecycle_activities(db=db, current_user=current_user, process="OFFBOARDING", limit=8)
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res.get("citations", [])]
            acts = res.get("activities", [])
            session_context["last_records"] = acts
            session_context["last_topic"] = "offboarding"

            if acts:
                items_str = "\n".join([
                    f"- **{a['employee_name']}**: Status `{a['status']}`, Last Working Day: **{a.get('due_date', 'N/A')}** ({a.get('details')})"
                    for a in acts
                ])
                msg = (
                    f"### Active Offboarding Clearances ({len(acts)} ongoing)\n\n"
                    f"Found **{len(acts)}** ongoing exit clearance processes:\n\n"
                    f"{items_str}\n\n"
                    f"**Suggested Next Step:** Ensure IT hardware recovery and Finance no-dues clearances are completed before LWD."
                )
            else:
                msg = "There are currently no active employee exit clearances in progress."

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_lifecycle_activities"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Offboarding", "View Action Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5L. Operational Bottlenecks
        if "bottleneck" in lower or "delay rate" in lower or "workflow delay" in lower:
            res = tool_get_operational_bottlenecks(db=db, current_user=current_user)
            elapsed = round(time.time() - start_time, 2)
            b_list = res.get("bottlenecks", [])
            lines = [f"### Current Operational Bottlenecks ({len(b_list)} identified)\n"]
            for b in b_list:
                lines.append(f"- **{b['title']}** (`{b['category']}`): {b['affected_task_count']} tasks affected. Recommended: {b['recommended_resolution']}")
            lines.append("\n*Note: These are operational facts derived from verified system timestamps.*")

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=["get_operational_bottlenecks"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["View ML Intelligence", "Review Blocked Tasks"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5M. Explicit Daily Briefing Request
        if "daily briefing" in lower:
            ctx = tool_get_hr_daily_briefing_context(db=db, current_user=current_user)
            m = ctx["metrics"]
            elapsed = round(time.time() - start_time, 2)
            msg = (
                f"### HR Daily Briefing\n\n"
                f"- **Overdue Tasks:** **{m['overdue_tasks']}** tasks require immediate resolution or extension.\n"
                f"- **Probation Reviews:** **{m['probation_reviews_due']}** evaluations due this week.\n"
                f"- **Pending Confirmations:** **{m['confirmations_pending']}** sign-offs awaiting review.\n"
                f"- **Active Onboarding:** **{m['onboarding_active']}** new hires in active milestones.\n"
                f"- **Follow-ups & Escalations:** **{m['followups_awaiting_response']}** follow-ups waiting and **{m['unresolved_escalations']}** open escalations.\n\n"
                f"**Recommended Focus:** Resolve the **{m['overdue_tasks']} overdue tasks** in Action Center first."
            )
            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=["get_hr_daily_briefing_context"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Review Overdue Tasks", "Check Probation", "Open Action Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5N. Personal Tasks & What Needs My Attention
        is_my_task_query = any(k in lower for k in [
            "my task", "my tasks", "what are my tasks", "show my tasks", "show my pending tasks",
            "assigned to me", "assigned to myself", "my open tasks", "my overdue tasks",
            "which of my tasks", "my high-priority tasks", "my high priority tasks",
            "what do i need to complete", "what should i prioritize", "what should i prioritise",
            "what needs my attention", "my attention", "attention today", "tasks assigned to me",
            "what is assigned to me", "tasks waiting for someone else", "what should i prioritise first",
            "what should i prioritize first", "today's priorities", "my priorities"
        ])
        if is_my_task_query:
            # Determine appropriate filter
            t_status = None
            t_priority = None
            t_range = None
            if "overdue" in lower:
                t_status = "OVERDUE"
            elif "pending" in lower or "open" in lower:
                t_status = "PENDING"
            elif "waiting" in lower or "blocked" in lower:
                t_status = "BLOCKED"
            elif "complete" in lower and not any(w in lower for w in ["attention", "today", "need to complete"]):
                t_status = "COMPLETED"

            if "high" in lower or "critical" in lower:
                t_priority = "HIGH"

            if "this week" in lower:
                t_range = "THIS_WEEK"
            elif "today" in lower and "attention" not in lower:
                t_range = "TODAY"

            res_tasks = tool_get_my_tasks(
                db=db,
                current_user=current_user,
                status=t_status,
                priority=t_priority,
                due_date_range=t_range,
                limit=10,
            )
            tasks = res_tasks.get("tasks", [])
            citations = [RecordCitation(**c) for c in res_tasks.get("citations", [])]
            tools_used = ["get_my_tasks"]

            # If user asked for overall attention or daily priorities, include follow-ups as well
            include_followups = any(k in lower for k in ["attention", "priorit", "today", "need to complete"])
            folls = []
            if include_followups:
                res_foll = tool_get_followups(db=db, current_user=current_user, limit=3)
                folls = res_foll.get("followups", [])
                tools_used.append("get_followups")
                for c in res_foll.get("citations", []):
                    try:
                        citations.append(RecordCitation(**c))
                    except Exception:
                        pass

            elapsed = round(time.time() - start_time, 2)
            lines = [f"### Items Requiring Your Attention Today\n" if include_followups else f"### Your Assigned Operational Tasks ({len(tasks)} in queue)\n"]

            if tasks:
                category_label = "Overdue Work Items" if t_status == "OVERDUE" or include_followups else "Assigned Tasks"
                lines.append(f"**{category_label} ({len(tasks)} in your queue):**")
                for t in tasks:
                    status_badge = f", Status: `{t['status']}`" if t_status != "OVERDUE" else ""
                    lines.append(f"- **{t['task_code']}**: {t['title']} (Due: **{t['due_date']}**, Priority: `{t['priority']}`{status_badge})")
            else:
                lines.append("You have no tasks matching this criteria directly assigned to your queue.")

            if folls:
                lines.append(f"\n**Follow-ups Awaiting Response ({len(folls)}):**")
                for f in folls:
                    lines.append(f"- **{f.get('employee_name', 'Employee')}** ({f.get('task_code', '')}): {f.get('notes', 'Pending response')}")

            lines.append("\n**Recommended Priority:** Review high-priority work items first, then verify any pending prerequisite blockers in Action Center.")
            session_context["last_records"] = tasks
            session_context["last_topic"] = "your tasks"

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=citations[:10],
                source_metadata=SourceMetadata(
                    tools_called=tools_used,
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Action Center", "Who is responsible for them?", "Check Follow-ups Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5O. Cross-Lifecycle Overdue Activities & Process Duration
        if any(k in lower for k in [
            "most overdue activities", "most overdue", "most delayed activities",
            "which lifecycle process", "which process takes the longest", "longest lifecycle",
            "process takes the longest", "most delayed completions"
        ]):
            res_analytics = tool_get_operational_analytics(db=db, current_user=current_user)
            elapsed = round(time.time() - start_time, 2)
            stage_counts = res_analytics.get("overdue_by_lifecycle_stage", {})
            longest = res_analytics.get("lifecycle_with_most_overdue", "Performance Reviews")

            lines = [
                f"### Lifecycle Overdue Activities Analysis\n",
                f"Based on verified database records across all 6 core employee lifecycle processes, **{longest}** currently has the highest volume of delayed items:\n",
            ]
            for stg, cnt in stage_counts.items():
                marker = " ⚠️ *(Highest Overdue)*" if stg == longest else ""
                lines.append(f"- **{stg}**: **{cnt}** overdue activities / milestones{marker}")

            lines.append(f"\n**Overall Operational On-Time Completion Rate:** **{res_analytics.get('on_time_completion_percentage')}%** across {res_analytics.get('total_tasks_tracked')} total tracked tasks.")
            lines.append(f"\n**Suggested Next Step:** Review pending milestones in the {longest} workspace to address overdue items.")

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=["get_operational_analytics"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Lifecycle Workspace", "View Operational Bottlenecks", "Check Action Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5P. Operational Analytics & On-time Completion Rate
        if any(k in lower for k in [
            "percentage of activities are completed on time", "completed on time", "on time percentage",
            "operational analytics", "operational performance", "reasons for delays",
            "recorded reasons for delays", "main recorded reasons", "how has operational performance"
        ]):
            res_analytics = tool_get_operational_analytics(db=db, current_user=current_user)
            elapsed = round(time.time() - start_time, 2)
            reasons = res_analytics.get("main_delay_reasons", [])
            reasons_str = "\n".join([f"- {r}" for r in reasons])

            msg = (
                f"### Operational Analytics & Performance Summary\n\n"
                f"- **On-Time Completion Rate:** **{res_analytics.get('on_time_completion_percentage')}%**\n"
                f"- **Total Operational Tasks Tracked:** **{res_analytics.get('total_tasks_tracked')}**\n"
                f"- **Successfully Completed:** **{res_analytics.get('completed_tasks')}**\n"
                f"- **Active Overdue Tasks:** **{res_analytics.get('active_overdue_tasks')}**\n\n"
                f"**Top Recorded Operational Delay Factors:**\n{reasons_str}\n\n"
                f"**Suggested Next Step:** Prioritize prerequisite manager approvals to recover delayed milestone timelines."
            )
            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message=msg,
                response_status="SUCCESS",
                related_records=[],
                source_metadata=SourceMetadata(
                    tools_called=["get_operational_analytics"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["View Analytics Dashboard", "Review Blocked Tasks", "Open Action Center"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5Q. ML Intelligence & Delay Risk Predictions
        if any(k in lower for k in [
            "predicted delay risk", "high predicted delay risk", "high-risk tasks", "high risk tasks",
            "at risk tasks", "at-risk tasks", "delay risk", "ml intelligence", "ml predictions",
            "delay probability", "what should hr investigate first"
        ]):
            res_ml = tool_get_ml_risk_predictions(db=db, current_user=current_user, risk_level="HIGH", limit=5)
            elapsed = round(time.time() - start_time, 2)
            preds = res_ml.get("predictions", [])
            citations = [RecordCitation(**c) for c in res_ml.get("citations", [])]

            lines = [
                f"### ML Intelligence: High Delay-Risk Tasks ({len(preds)} identified)\n",
                f"Here are the operational tasks currently evaluated with elevated delay probabilities by the shadow ML model:\n",
            ]
            if preds:
                for p in preds:
                    factors_text = ", ".join(p.get("contributing_factors", ["Standard variance"]))
                    lines.append(
                        f"- **{p['task_code']}**: {p['title']} (Due: **{p['due_date']}**, Risk: `{p['risk_level']}` tier - **{p['delay_probability_pct']}%** probability)\n"
                        f"  *Contributing Factors:* {factors_text} | Assignee: **{p.get('owner_name', 'Unassigned')}**"
                    )
            else:
                lines.append("No tasks are currently flagged in the HIGH delay-risk tier. Operational workflows are tracking within standard variance buffers.")

            lines.append(f"\n*(Advisory Disclaimer: {res_ml.get('advisory_disclaimer')})*")
            lines.append("\n**Suggested Next Step:** Review high-risk task assignees to verify whether dependency blockers require assistance.")

            session_context["last_records"] = preds
            session_context["last_topic"] = "at-risk tasks"

            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["get_ml_risk_predictions"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open ML Intelligence Workspace", "Check Blocked Tasks", "View Bottlenecks"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5R. Task Deadlines & Upcoming Deadlines across company
        if any(k in lower for k in [
            "upcoming deadlines", "missed their deadlines", "tasks with upcoming deadlines",
            "tasks have missed their deadlines", "deadlines this week", "tasks due this week"
        ]):
            is_missed = "missed" in lower
            res_tasks = tool_search_hr_tasks(
                db=db,
                current_user=current_user,
                status="OVERDUE" if is_missed else "PENDING",
                due_date_range="OVERDUE" if is_missed else "THIS_WEEK",
                limit=8,
            )
            elapsed = round(time.time() - start_time, 2)
            citations = [RecordCitation(**c) for c in res_tasks.get("citations", [])]
            tasks = res_tasks.get("tasks", [])

            lines = [f"### {'Tasks That Have Missed Deadlines' if is_missed else 'Tasks With Upcoming Deadlines'} ({len(tasks)} items)\n"]
            if tasks:
                for t in tasks:
                    lines.append(f"- **{t['task_code']}**: {t['title']} (Due: **{t['due_date']}**, Status: `{t['status']}`, Owner: **{t.get('owner_name', 'HR Lead')}**)")
            else:
                lines.append(f"No tasks matching this timeline were found in your authorized scope.")

            lines.append("\n**Suggested Next Step:** Open the Action Center to manage extensions or assign re-allocations.")
            return CopilotChatResponse(
                conversation_id=conversation_id,
                assistant_message="\n".join(lines),
                response_status="SUCCESS",
                related_records=citations,
                source_metadata=SourceMetadata(
                    tools_called=["search_hr_tasks"],
                    data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                    model_used="intent-engine-v1",
                    is_ai_generated=False,
                    response_status="SUCCESS",
                    execution_time_seconds=elapsed,
                ),
                suggested_next_actions=["Open Action Center", "Who is responsible for them?", "Check My Tasks"],
                generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # 5S. Task Ownership Query ("Who owns task TSK-00001?", "Who is working on task...")
        if any(k in lower for k in ["who owns task", "who is assigned to task", "who owns this task", "who is working on task"]):
            match_task = re.search(r'\btsk-(\d+)', lower) or re.search(r'\btask\s+(?:#\s*)?(\d+)', lower) or re.search(r'\b\d{4,6}\b', lower)
            if match_task:
                task_code_str = match_task.group(0).upper()
                if not task_code_str.startswith("TSK-"):
                    task_code_str = f"TSK-{task_code_str.zfill(5)}"
                res = tool_get_task_delay_assessment(db=db, current_user=current_user, task_id_or_code=task_code_str)
                elapsed = round(time.time() - start_time, 2)
                if res.get("found"):
                    msg = (
                        f"### Task Ownership: {res['task_code']}\n\n"
                        f"- **Task Title:** {res['title']}\n"
                        f"- **Assigned Owner / Lead:** **{res['owner_name']}**\n"
                        f"- **Employee Subject:** **{res['employee_name']}**\n"
                        f"- **Current Status:** `{res['official_status']}`\n"
                        f"- **Due Date:** **{res['due_date']}**\n\n"
                        f"**Suggested Next Action:** You can ask me to draft a reminder message for **{res['owner_name']}**."
                    )
                    citations = [RecordCitation(**c) for c in res.get("citations", [])]
                else:
                    msg = f"Task '{task_code_str}' was not found in the database. Please verify the task code."
                    citations = []

                return CopilotChatResponse(
                    conversation_id=conversation_id,
                    assistant_message=msg,
                    response_status="SUCCESS",
                    related_records=citations,
                    source_metadata=SourceMetadata(
                        tools_called=["get_task_delay_assessment"],
                        data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                        model_used="intent-engine-v1",
                        is_ai_generated=False,
                        response_status="SUCCESS",
                        execution_time_seconds=elapsed,
                    ),
                    suggested_next_actions=[f"Draft a reminder for task {task_code_str}", "Open Action Center"],
                    generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                )

        # -------------------------------------------------------------------
        # 6. AMBIGUOUS QUERIES (Prompt for Clarification, NEVER default to Daily Briefing)
        # -------------------------------------------------------------------
        elapsed = round(time.time() - start_time, 2)
        clarification_msg = (
            "I'm here to help with your HR operations in HR Flow. Could you please clarify what specific information you need?\n\n"
            "You can ask me about:\n"
            "- **Tasks & Actions:** e.g., *'What needs my attention today?'* or *'Show overdue tasks'*\n"
            "- **Onboarding:** e.g., *'Show me delayed onboarding activities'*\n"
            "- **Probation Reviews:** e.g., *'How many probation reviews are due this month?'*\n"
            "- **Specific Records:** e.g., *'Why is task TSK-00197 delayed?'*\n"
            "- **Follow-ups:** e.g., *'Are any follow-ups waiting for a response?'* or *'Draft a reminder for...'* \n"
            "- **HR Guidance:** e.g., *'What does employee onboarding mean?'*"
        )
        return CopilotChatResponse(
            conversation_id=conversation_id,
            assistant_message=clarification_msg,
            response_status="SUCCESS",
            related_records=[],
            source_metadata=SourceMetadata(
                tools_called=[],
                data_as_of=time.strftime("%Y-%m-%d %H:%M:%S"),
                model_used="intent-engine-v1",
                is_ai_generated=False,
                response_status="SUCCESS",
                execution_time_seconds=elapsed,
            ),
            suggested_next_actions=[
                "What needs my attention today?",
                "Show me delayed onboarding activities",
                "How many probation reviews are due this month?",
            ],
            generated_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        )

    # -----------------------------------------------------------------------
    # Helper Class Methods
    # -----------------------------------------------------------------------
    @classmethod
    def _is_out_of_scope(cls, text: str) -> bool:
        # Trivia, general entities & geography
        if any(k in text for k in [
            "capital of", "where is", "who was napoleon", "distance to moon", "highest mountain",
            "speed of light", "photosynthesis", "square root of", "president of", "currency of",
            "what is apple", "tell me about apple", "who is elon", "what is tesla", "what is microsoft"
        ]):
            return True
        # Food & recipes
        if any(k in text for k in [
            "recipe", "how to make pasta", "bake a cake", "make pizza", "how to cook", "ingredients for"
        ]):
            return True
        # Entertainment & sports
        if any(k in text for k in [
            "movie", "song", "who won the world cup", "cristiano ronaldo", "lionel messi", "tell me a joke"
        ]):
            return True
        # Generic coding unrelated to HR Flow
        if any(k in text for k in [
            "write a python", "quicksort", "binary search", "how does quicksort", "html code", "css flexbox",
            "javascript function", "leetcode"
        ]):
            return True
        # Personal advice
        if any(k in text for k in [
            "should i buy bitcoin", "should i buy stocks", "cure a headache", "cure fever", "lose weight"
        ]):
            return True
        return False

    @classmethod
    def _check_general_hr_knowledge(cls, text: str) -> Optional[str]:
        # Onboarding definition & best practices
        if any(k in text for k in ["what does employee onboarding mean", "what is employee onboarding", "what is onboarding", "what is the onboarding process", "explain employee onboarding", "explain onboarding", "explain the onboarding process"]):
            if not any(k in text for k in ["pending", "delayed", "our organisation", "our company", "in hr flow", "list"]):
                return (
                    "### What Is Employee Onboarding?\n\n"
                    "**Employee Onboarding** is the structured human resources process of integrating a new hire into an organization. "
                    "It spans from the moment an offer is accepted through the employee's initial 30 to 90 days of employment.\n\n"
                    "**Key Objectives & Phases:**\n"
                    "1. **Pre-boarding & Compliance:** Collecting statutory identity documents, signing employment contracts, and completing Background Verification (BGV).\n"
                    "2. **Logistics & IT Provisioning:** Issuing laptop assets, corporate credentials, software licenses, and access badges before Day 1.\n"
                    "3. **Orientation & Cultural Assimilation:** Introducing company culture, mission, core values, and assigning a mentor or Day-1 buddy.\n"
                    "4. **Role Enablement:** Setting clear milestone expectations, 30-60-90 day performance goals, and conducting periodic check-ins.\n\n"
                    "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
                )

        if any(k in text for k in ["how can hr improve onboarding", "onboarding best practices", "improve new hire onboarding"]):
            return (
                "### Best Practices for Improving Employee Onboarding\n\n"
                "To enhance onboarding retention and reduce early attrition, HR teams should implement:\n\n"
                "1. **Automated Pre-Boarding:** Collect compliance documentation digitally before Day 1 so the first day focuses on culture and introductions rather than paperwork.\n"
                "2. **Structured Buddy Program:** Pair every new hire with an experienced peer to accelerate team integration and psychological safety.\n"
                "3. **Clear 30-60-90 Day Milestones:** Establish measurable deliverable goals early so new hires know exactly what success looks like.\n"
                "4. **Early Touchpoint Check-Ins:** Schedule automated HR follow-ups on Day 7, Day 30, and Day 60 to identify blockers and gather early feedback.\n\n"
                "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
            )

        # Probation definition
        if any(k in text for k in ["what is a probation review", "what is probation", "what does probation mean", "explain probation"]):
            if not any(k in text for k in ["overdue", "due", "this month", "this week", "count", "how many", "list", "show"]):
                return (
                    "### What Is a Probation Review?\n\n"
                    "A **Probationary Period** is an initial trial phase (typically 3 to 6 months) during which an employer evaluates a new employee's job performance, cultural alignment, work habits, and capability to fulfill role duties.\n\n"
                    "A **Probation Review** is the formal evaluation meeting held before the probation end date where:\n"
                    "- The reporting manager reviews performance against initial milestone expectations.\n"
                    "- The employee provides feedback on their onboarding and support.\n"
                    "- An official decision is recorded: **Confirmation**, **Extension** (if additional evaluation time is required), or **Separation**.\n\n"
                    "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
                )

        # Confirmation definition
        if any(k in text for k in ["what is employee confirmation", "what is confirmation in hr", "explain confirmation"]):
            if not any(k in text for k in ["pending", "show", "who", "decision"]):
                return (
                    "### What Is Employee Confirmation?\n\n"
                    "**Employee Confirmation** is the formal transition of an employee from probationary status to permanent employment status. "
                    "It signifies that the employee has successfully met the performance and behavioral standards expected during their probation.\n\n"
                    "**Standard Workflow:**\n"
                    "1. Manager submits evaluation and recommendation.\n"
                    "2. HR verifies statutory document completeness and performance sign-offs.\n"
                    "3. Formal Confirmation Letter is issued.\n\n"
                    "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
                )

        # Performance Review definition
        if any(k in text for k in ["what is a performance review", "what are performance reviews", "why are performance reviews important"]):
            if not any(k in text for k in ["pending", "overdue", "list", "show", "our"]):
                return (
                    "### What Is a Performance Review?\n\n"
                    "A **Performance Review** (or appraisal) is a periodic formal assessment where an employee's work performance, goals, strengths, and areas for development are evaluated and discussed with their manager.\n\n"
                    "**Core Value for Organizations:**\n"
                    "- Aligns individual contributions with company objectives.\n"
                    "- Provides transparent feedback and identifies growth opportunities.\n"
                    "- Informs compensation decisions, promotions, and succession planning.\n\n"
                    "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
                )

        # Offboarding definition
        if any(k in text for k in ["what is offboarding", "what is employee offboarding", "explain offboarding"]):
            if not any(k in text for k in ["pending", "list", "show", "clearance", "who"]):
                return (
                    "### What Is Employee Offboarding?\n\n"
                    "**Employee Offboarding** (or exit management) encompasses all processes required when an employee departs an organization—whether through resignation, retirement, or termination.\n\n"
                    "**Essential Components:**\n"
                    "1. **Knowledge Transfer (KT):** Documenting handover notes and transitioning duties to colleagues.\n"
                    "2. **Asset Recovery:** Collecting corporate hardware (laptops, phones) and access badges.\n"
                    "3. **Security Deprovisioning:** Revoking email, cloud, and building access credentials.\n"
                    "4. **Exit Interview & Clearances:** Gathering candid feedback and completing Finance, Admin, and HR sign-offs for final settlement.\n\n"
                    "*Note: This is general HR operational guidance. To view current organization-specific records and pending activities in HR Flow, ask for pending onboarding activities or check the respective lifecycle workspace.*"
                )

        return None

    @classmethod
    def _is_follow_up_responsibility_query(cls, text: str) -> bool:
        return any(k in text for k in [
            "who is responsible for them", "who is responsible", "who is assigned to them",
            "who owns them", "who handles them", "who is in charge of them", "who is responsible for these",
            "who owns these", "who are their managers"
        ])

    @classmethod
    def _is_follow_up_longest_delay_query(cls, text: str) -> bool:
        return any(k in text for k in [
            "delayed the longest", "longest delayed", "most delayed", "highest delay",
            "which one has been delayed the longest", "which is delayed the longest",
            "which has been delayed the longest", "which one is most overdue", "most overdue"
        ])

    @classmethod
    def _is_follow_up_draft_query(cls, text: str) -> bool:
        return any(k in text for k in [
            "draft a reminder for that person", "draft a reminder for them",
            "draft a follow-up for that person", "draft a follow-up for them",
            "draft a message for that person", "draft a reminder for him",
            "draft a reminder for her", "draft a reminder for that task",
            "draft a reminder for this task", "draft a reminder",
            "draft a follow-up for that task", "draft a follow-up"
        ])

    @classmethod
    def _parse_date_sort(cls, d_str: Optional[str]) -> int:
        if not d_str:
            return 0
        try:
            return int(d_str.replace("-", ""))
        except Exception:
            return 0

