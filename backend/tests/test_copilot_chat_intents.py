from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.core.llm_provider import LLMProvider
from app.services.copilot_tools import TOOL_DEFINITIONS, TOOL_MAPPING

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
MANAGER_EMAIL = "ananya.sharma@auratech.in"
VALID_PASSWORD = "Password@123"


def get_auth_headers(email: str = ADMIN_EMAIL) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": VALID_PASSWORD})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def ask_copilot(headers: dict, message: str, conversation_id: str | None = None) -> dict:
    payload = {"message": message}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    resp = client.post("/api/v1/copilot/chat", json=payload, headers=headers)
    assert resp.status_code == 200, f"Copilot chat failed for '{message}': {resp.text}"
    return resp.json()


def test_copilot_requires_authentication():
    resp = client.post("/api/v1/copilot/chat", json={"message": "Why is employee onboarding important?"})
    assert resp.status_code in (401, 403)


def test_all_12_copilot_tools_preserved():
    expected_tools = {
        "get_my_tasks",
        "search_hr_tasks",
        "get_lifecycle_activities",
        "get_followups",
        "get_escalations",
        "get_operational_bottlenecks",
        "get_employee_hr_summary",
        "get_task_delay_assessment",
        "get_hr_daily_briefing_context",
        "draft_followup_message",
        "get_operational_analytics",
        "get_ml_risk_predictions",
    }
    assert set(TOOL_MAPPING.keys()) == expected_tools
    schema_names = {entry["function"]["name"] for entry in TOOL_DEFINITIONS}
    assert schema_names == expected_tools


def test_general_hr_knowledge_questions_do_not_call_db_tools():
    headers = get_auth_headers(ADMIN_EMAIL)

    general_prompts = [
        ("Explain why employee onboarding is important.", ["onboarding", "culture", "compliance"]),
        ("Why is employee onboarding important?", ["onboarding", "productivity"]),
        ("What is probation?", ["probation"]),
        ("Explain employee offboarding", ["offboarding"]),
        ("What are the benefits of performance reviews?", ["performance review", "feedback"]),
        ("Explain the importance of performance reviews.", ["performance review"]),
        ("Why is documentation important in HR?", ["documentation", "compliance"]),
        ("What are the benefits of employee engagement?", ["engagement", "productivity"]),
        ("Explain the employee lifecycle.", ["lifecycle", "onboarding", "offboarding"]),
        ("What is the purpose of background verification?", ["background verification", "identity"]),
        ("How does continuous manager feedback support employee retention?", ["human resources"]),
    ]

    for prompt, expected_keywords in general_prompts:
        data = ask_copilot(headers, prompt)
        msg_lower = data["assistant_message"].lower()

        assert data["source_metadata"]["tools_called"] == [], (
            f"General question '{prompt}' unexpectedly called DB tools: {data['source_metadata']['tools_called']}"
        )
        assert data["related_records"] == [], (
            f"General question '{prompt}' should not attach operational citations"
        )
        assert "tsk-" not in msg_lower, f"General question '{prompt}' leaked task IDs"
        assert "manoj nair" not in msg_lower and "sanjay chatterjee" not in msg_lower
        for kw in expected_keywords:
            assert kw in msg_lower, f"Expected '{kw}' in response to '{prompt}': {data['assistant_message']}"


def test_operational_hr_questions_call_database_tools():
    headers = get_auth_headers(ADMIN_EMAIL)

    # 1. Show delayed onboarding activities
    onb = ask_copilot(headers, "Show delayed onboarding activities")
    assert set(onb["source_metadata"]["tools_called"]).intersection({"get_lifecycle_activities", "search_hr_tasks"})
    if "[TSK-" in onb["assistant_message"]:
        # Task codes are explicitly displayed so distinct seeded tasks never look like silent duplicates
        assert "TSK-" in onb["assistant_message"]

    # 2. Which employees have pending onboarding tasks?
    onb_pending = ask_copilot(headers, "Which employees have pending onboarding tasks?")
    assert set(onb_pending["source_metadata"]["tools_called"]).intersection({"get_lifecycle_activities", "search_hr_tasks"})

    # 3. Who has pending documentation? / Who is responsible for overdue documentation?
    doc_pending = ask_copilot(headers, "Who has pending documentation?")
    assert set(doc_pending["source_metadata"]["tools_called"]).intersection({"get_lifecycle_activities", "search_hr_tasks"})

    doc_overdue = ask_copilot(headers, "Who is responsible for overdue documentation?")
    assert set(doc_overdue["source_metadata"]["tools_called"]).intersection({"get_lifecycle_activities", "search_hr_tasks"})

    # 4. Show all pending probation reviews
    prob = ask_copilot(headers, "Show all pending probation reviews.")
    assert "get_lifecycle_activities" in prob["source_metadata"]["tools_called"]

    # 5. Which tasks are overdue this week?
    overdue_tasks = ask_copilot(headers, "Which tasks are overdue this week?")
    assert "search_hr_tasks" in overdue_tasks["source_metadata"]["tools_called"]

    # 6. Which employees have overdue performance reviews?
    perf = ask_copilot(headers, "Which employees have overdue performance reviews?")
    assert "get_lifecycle_activities" in perf["source_metadata"]["tools_called"]

    # 7. Specific task delay assessment continues calling get_task_delay_assessment (NOT treated as conceptual)
    task_explain = ask_copilot(headers, "Why is task TSK-00197 delayed?")
    assert "get_task_delay_assessment" in task_explain["source_metadata"]["tools_called"]

    # 8. Multi-turn follow-up responsibility query resolves session context
    follow = ask_copilot(headers, "Who is responsible for them?", conversation_id=onb["conversation_id"])
    assert "resolve_conversational_context" in follow["source_metadata"]["tools_called"]


def test_mixed_questions_provide_explanation_and_live_data_separated():
    headers = get_auth_headers(ADMIN_EMAIL)

    mixed_prompts = [
        ("Explain onboarding and show delayed tasks", "onboarding", {"search_hr_tasks", "get_lifecycle_activities"}),
        (
            "Explain why onboarding is important and show me employees whose onboarding is delayed.",
            "onboarding",
            {"get_lifecycle_activities", "search_hr_tasks"},
        ),
        (
            "Explain probation and show me employees approaching their probation end date.",
            "probation",
            {"get_lifecycle_activities"},
        ),
    ]

    for prompt, topic_kw, expected_tools in mixed_prompts:
        data = ask_copilot(headers, prompt)
        msg = data["assistant_message"]
        assert "---" in msg, f"Mixed question '{prompt}' should clearly separate explanation and DB results"
        explanation_part, operational_part = msg.split("---", 1)
        assert topic_kw in explanation_part.lower()
        assert len(operational_part.strip()) > 20
        assert set(data["source_metadata"]["tools_called"]).intersection(expected_tools)


def test_reporting_manager_rbac_scoping_preserved_on_operational_queries():
    mgr_headers = get_auth_headers(MANAGER_EMAIL)
    data = ask_copilot(mgr_headers, "Show delayed onboarding activities")
    assert set(data["source_metadata"]["tools_called"]).intersection({"get_lifecycle_activities", "search_hr_tasks"})
    # General question also succeeds without DB exposure for Reporting Manager
    gen = ask_copilot(mgr_headers, "Why is employee onboarding important?")
    assert gen["source_metadata"]["tools_called"] == []


def test_configured_llm_omits_tools_for_pure_general_questions():
    headers = get_auth_headers(ADMIN_EMAIL)

    captured_payloads = []

    def fake_post(url, json=None, headers=None):
        captured_payloads.append(json)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Onboarding helps new hires understand culture, roles, tools, and compliance.",
                    }
                }
            ]
        }
        return mock_resp

    with patch.object(LLMProvider, "is_llm_configured", return_value=True), \
         patch("app.core.llm_provider.httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.post.side_effect = fake_post
        mock_client_cls.return_value.__enter__.return_value = mock_client

        # Pure general knowledge question: payload must NOT send tools to LLM
        data = ask_copilot(headers, "Explain why employee onboarding is important.")
        assert len(captured_payloads) == 1
        assert "tools" not in captured_payloads[0]
        assert data["source_metadata"]["tools_called"] == []
        assert "culture" in data["assistant_message"].lower()

        # Operational question: payload MUST include all 12 tools
        captured_payloads.clear()
        ask_copilot(headers, "Show delayed onboarding activities")
        assert len(captured_payloads) == 1
        assert len(captured_payloads[0]["tools"]) == 12

