import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select, delete, text
from app.main import app
from app.db.session import get_db, SessionLocal
from app.models.organization import Employee, Department, User
from app.models.lifecycle import (
    EmployeeLifecycle,
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)
from app.models.compliance import EmployeeDocument, DocumentRequirement
from app.models.intelligence import ActivityLog

client = TestClient(app)


def get_token(email: str = "neha.saxena@auratech.in") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password@123"})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.fixture(autouse=True)
def preserve_database_state():
    """Ensure that every test cleans up any created activity_logs or lifecycle additions."""
    yield
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM employee_lifecycle WHERE id > 800;"))
        db.execute(text("DELETE FROM activity_logs WHERE id > 1000;"))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_create_employee_and_profile():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Fetch valid department ID
    dept_res = client.get("/api/v1/departments", headers=headers)
    assert dept_res.status_code == 200
    depts = dept_res.json()
    assert len(depts) > 0
    dept_id = depts[0]["id"]

    test_code = "EMP-TEST-999"
    test_email = "test.newhire999@auratech.in"

    created_id = None
    try:
        # 2. Create employee
        create_payload = {
            "employee_code": test_code,
            "first_name": "Aarav",
            "last_name": "Nambiar",
            "email": test_email,
            "phone_number": "+91 98765 43210",
            "department_id": dept_id,
            "designation": "Software Engineer",
            "location": "Bengaluru",
            "employment_status": "PROBATION",
            "date_of_joining": str(date.today()),
        }
        create_res = client.post("/api/v1/employees", json=create_payload, headers=headers)
        assert create_res.status_code == 201, create_res.text
        created_data = create_res.json()
        created_id = created_data["id"]
        assert created_data["employee_code"] == test_code
        assert created_data["first_name"] == "Aarav"

        # 3. Test duplicate employee_code validation
        dup_code_res = client.post("/api/v1/employees", json=create_payload, headers=headers)
        assert dup_code_res.status_code in [400, 422]
        assert "already exists" in dup_code_res.text

        # 4. Test duplicate email validation
        dup_email_payload = create_payload.copy()
        dup_email_payload["employee_code"] = "EMP-TEST-888"
        dup_email_res = client.post("/api/v1/employees", json=dup_email_payload, headers=headers)
        assert dup_email_res.status_code in [400, 422]
        assert "already exists" in dup_email_res.text

        # 5. Update employee
        update_payload = {
            "designation": "Senior Software Engineer",
            "location": "Pune",
        }
        update_res = client.put(f"/api/v1/employees/{created_id}", json=update_payload, headers=headers)
        assert update_res.status_code == 200
        assert update_res.json()["designation"] == "Senior Software Engineer"
        assert update_res.json()["location"] == "Pune"

        # 6. Retrieve full 360-degree employee profile
        profile_res = client.get(f"/api/v1/employees/{created_id}/profile", headers=headers)
        assert profile_res.status_code == 200
        profile = profile_res.json()
        assert profile["employee"]["id"] == created_id
        assert profile["current_lifecycle_stage"] in ["ONBOARDING", "PROBATION"]
        assert len(profile["lifecycle_history"]) >= 1

    finally:
        # Clean up ephemeral test employee
        if created_id:
            db = SessionLocal()
            try:
                db.execute(delete(ActivityLog).where(ActivityLog.entity_id == created_id, ActivityLog.entity_type == "EMPLOYEE", ActivityLog.id > 1000))
                db.execute(delete(OnboardingRecord).where(OnboardingRecord.employee_id == created_id))
                db.execute(delete(ProbationRecord).where(ProbationRecord.employee_id == created_id))
                db.execute(delete(EmployeeLifecycle).where(EmployeeLifecycle.employee_id == created_id))
                db.execute(delete(Employee).where(Employee.id == created_id))
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()


def test_reporting_manager_cannot_create_employee():
    mgr_token = get_token("ananya.sharma@auratech.in")
    headers = {"Authorization": f"Bearer {mgr_token}"}

    payload = {
        "employee_code": "EMP-FAIL-001",
        "first_name": "Unauthorized",
        "last_name": "Create",
        "email": "unauth@auratech.in",
        "phone_number": "+91 99999 88888",
        "department_id": 1,
        "designation": "QA Engineer",
        "location": "Bengaluru",
        "employment_status": "PROBATION",
        "date_of_joining": str(date.today()),
    }
    res = client.post("/api/v1/employees", json=payload, headers=headers)
    assert res.status_code == 403


def test_lifecycle_overview():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_active_employees" in data
    assert "onboarding_active" in data
    assert "probation_active" in data
    assert "confirmation_pending" in data
    assert "performance_reviews_in_progress" in data
    assert "offboarding_in_progress" in data
    assert "confirmed_employees" in data
    assert data["total_active_employees"] >= 150


def test_onboarding_list_and_update():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/onboarding?size=5", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    record = items[0]
    rec_id = record["id"]
    orig_asset_status = record["it_asset_status"]
    orig_orientation = record["orientation_completed"]

    try:
        # Update onboarding progress
        update_res = client.patch(
            f"/api/v1/lifecycle/onboarding/{rec_id}",
            json={"it_asset_status": "PROVISIONED", "orientation_completed": True},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["it_asset_status"] == "PROVISIONED"
        assert update_res.json()["orientation_completed"] is True
    finally:
        # Revert
        db = SessionLocal()
        try:
            db.execute(text(f"UPDATE onboarding_records SET it_asset_status = '{orig_asset_status}', orientation_completed = {orig_orientation} WHERE id = {rec_id};"))
            db.commit()
        finally:
            db.close()




def test_probation_list_and_update():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/probation?size=5", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    record = items[0]
    rec_id = record["id"]
    orig_feedback = record.get("manager_feedback")

    try:
        update_res = client.patch(
            f"/api/v1/lifecycle/probation/{rec_id}",
            json={"manager_feedback": "Strong technical skills and solid sprint delivery.", "status": "UNDER_REVIEW"},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["manager_feedback"] == "Strong technical skills and solid sprint delivery."
    finally:
        db = SessionLocal()
        try:
            feedback_val = f"'{orig_feedback}'" if orig_feedback else "NULL"
            db.execute(text(f"UPDATE probation_records SET manager_feedback = {feedback_val} WHERE id = {rec_id};"))
            db.commit()
        finally:
            db.close()




def test_confirmation_approval_admin():
    """ADMIN can make formal confirmation decisions: status becomes CONFIRMED, records user & date & notes."""
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}
    rec_id = 191

    try:
        approve_res = client.post(
            f"/api/v1/lifecycle/confirmation/{rec_id}/approve",
            json={
                "effective_confirmation_date": str(date.today()),
                "confirmation_letter_issued": True,
                "notes": "Formal confirmation approved by System Admin."
            },
            headers=headers
        )
        assert approve_res.status_code == 200
        data = approve_res.json()
        assert data["status"] == "CONFIRMED"
        assert data["confirmation_letter_issued"] is True
        assert data["approved_by_hr_id"] is not None
        assert data["effective_confirmation_date"] == str(date.today())
    finally:
        db = SessionLocal()
        try:
            db.execute(text(f"UPDATE confirmation_records SET status = 'PENDING_APPROVAL', confirmation_letter_issued = false, approved_by_manager_id = NULL, approved_by_hr_id = NULL, effective_confirmation_date = NULL WHERE id = {rec_id};"))
            db.execute(text("DELETE FROM employee_lifecycle WHERE id > 800;"))
            db.commit()
        finally:
            db.close()




def test_confirmation_approval_hr_manager():
    """HR_MANAGER can make formal confirmation decisions."""
    hr_mgr_token = get_token("rajesh.venkat@auratech.in")
    headers = {"Authorization": f"Bearer {hr_mgr_token}"}
    rec_id = 191

    try:
        approve_res = client.post(
            f"/api/v1/lifecycle/confirmation/{rec_id}/approve",
            json={
                "effective_confirmation_date": str(date.today()),
                "confirmation_letter_issued": True,
                "notes": "Formal confirmation approved by HR Manager."
            },
            headers=headers
        )
        assert approve_res.status_code == 200
        data = approve_res.json()
        assert data["status"] == "CONFIRMED"
        assert data["confirmation_letter_issued"] is True
        assert data["approved_by_hr_id"] is not None
    finally:
        db = SessionLocal()
        try:
            db.execute(text(f"UPDATE confirmation_records SET status = 'PENDING_APPROVAL', confirmation_letter_issued = false, approved_by_manager_id = NULL, approved_by_hr_id = NULL, effective_confirmation_date = NULL WHERE id = {rec_id};"))
            db.execute(text("DELETE FROM employee_lifecycle WHERE id > 800;"))
            db.commit()
        finally:
            db.close()




def test_confirmation_approval_reporting_manager_recommendation_only():
    """REPORTING_MANAGER can ONLY submit a manager recommendation (APPROVED_BY_MANAGER), CANNOT confirm."""
    mgr_token = get_token("meera.sundaram@auratech.in")  # Manager of employee 191 (Emp 14)
    headers = {"Authorization": f"Bearer {mgr_token}"}
    rec_id = 191

    try:
        approve_res = client.post(
            f"/api/v1/lifecycle/confirmation/{rec_id}/approve",
            json={
                "effective_confirmation_date": str(date.today()),
                "confirmation_letter_issued": True,
                "notes": "Manager recommendation: meets performance standards."
            },
            headers=headers
        )
        assert approve_res.status_code == 200
        data = approve_res.json()
        assert data["status"] == "APPROVED_BY_MANAGER"
        assert data["status"] != "CONFIRMED"
        assert data["approved_by_manager_id"] == 14
        assert data["approved_by_hr_id"] is None
    finally:
        db = SessionLocal()
        try:
            db.execute(text(f"UPDATE confirmation_records SET status = 'PENDING_APPROVAL', confirmation_letter_issued = false, approved_by_manager_id = NULL, approved_by_hr_id = NULL, effective_confirmation_date = NULL WHERE id = {rec_id};"))
            db.execute(text("DELETE FROM employee_lifecycle WHERE id > 800;"))
            db.commit()
        finally:
            db.close()




def test_confirmation_approval_reporting_manager_forbidden_for_non_report():
    """REPORTING_MANAGER cannot recommend or approve confirmation for an employee outside their direct hierarchy."""
    other_mgr_token = get_token("ananya.sharma@auratech.in")  # Manages SWE, NOT 191
    headers = {"Authorization": f"Bearer {other_mgr_token}"}
    rec_id = 191  # Belongs to employee 191 (managed by 14)

    res = client.post(
        f"/api/v1/lifecycle/confirmation/{rec_id}/approve",
        json={"notes": "Attempting unauthorized approval"},
        headers=headers
    )
    assert res.status_code == 403
    assert "direct reports" in res.text


def test_confirmation_approval_hr_executive_forbidden():
    """HR_EXECUTIVE cannot make confirmation decisions (HTTP 403 Forbidden)."""
    hr_exec_token = get_token("kavita.iyer@auratech.in")
    headers = {"Authorization": f"Bearer {hr_exec_token}"}
    rec_id = 191

    res = client.post(
        f"/api/v1/lifecycle/confirmation/{rec_id}/approve",
        json={"notes": "Unauthorized executive approval attempt"},
        headers=headers
    )
    assert res.status_code == 403


def test_reporting_manager_cannot_verify_documents():
    """REPORTING_MANAGER cannot verify or reject employee documents (restricted to HR/Admin)."""
    mgr_token = get_token("ananya.sharma@auratech.in")
    headers = {"Authorization": f"Bearer {mgr_token}"}

    res = client.patch(
        "/api/v1/lifecycle/documents/1/verify",
        json={"status": "VERIFIED", "verification_notes": "Manager attempting to verify doc"},
        headers=headers
    )
    assert res.status_code == 403


def test_reporting_manager_data_scoping_and_isolation():
    """
    Verify Reporting Manager data scoping:
    1. /lifecycle/overview returns counts scoped strictly to direct reports (no org leakage).
    2. /employees/{id}/profile for non-direct report returns 403 Forbidden.
    3. Update operations on non-direct report lifecycle records return 403 Forbidden.
    """
    mgr_token = get_token("ananya.sharma@auratech.in")  # VP SWE (emp 2, manages 16, 17, 18, 19)
    headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Overview KPIs scoped
    overview_res = client.get("/api/v1/lifecycle/overview", headers=headers)
    assert overview_res.status_code == 200
    overview = overview_res.json()
    assert overview["total_active_employees"] == 5
    assert overview["total_active_employees"] < 50

    # 2. Accessing non-report profile
    non_report_emp_id = 191  # Managed by 14
    profile_res = client.get(f"/api/v1/employees/{non_report_emp_id}/profile", headers=headers)
    assert profile_res.status_code == 403
    assert "direct reporting hierarchy" in profile_res.text

    # 3. Accessing direct report profile succeeds
    direct_report_emp_id = 16
    direct_profile_res = client.get(f"/api/v1/employees/{direct_report_emp_id}/profile", headers=headers)
    assert direct_profile_res.status_code == 200
    assert direct_profile_res.json()["employee"]["id"] == direct_report_emp_id

    # 4. Attempting to update probation for non-direct report returns 403
    prob_res = client.patch(
        "/api/v1/lifecycle/probation/191",
        json={"manager_feedback": "Unauthorized feedback"},
        headers=headers
    )
    assert prob_res.status_code == 403


def test_document_verification():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/documents?size=5", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    doc = items[0]
    doc_id = doc["id"]
    orig_status = doc["status"]
    orig_notes = doc.get("verification_notes")

    try:
        verify_res = client.patch(
            f"/api/v1/lifecycle/documents/{doc_id}/verify",
            json={"status": "VERIFIED", "verification_notes": "Aadhaar and PAN details verified against records."},
            headers=headers
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["status"] == "VERIFIED"
        assert verify_res.json()["verification_notes"] == "Aadhaar and PAN details verified against records."
    finally:
        db = SessionLocal()
        try:
            notes_val = f"'{orig_notes}'" if orig_notes else "NULL"
            db.execute(text(f"UPDATE employee_documents SET status = '{orig_status}', verification_notes = {notes_val} WHERE id = {doc_id};"))
            db.commit()
        finally:
            db.close()




def test_performance_review_management():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/performance-reviews?size=5", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    review = items[0]
    rev_id = review["id"]
    orig_status = review["manager_review_status"]
    orig_rating = review.get("rating")

    try:
        update_res = client.patch(
            f"/api/v1/lifecycle/performance-reviews/{rev_id}",
            json={"manager_review_status": "COMPLETED", "rating": 4.50},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["manager_review_status"] == "COMPLETED"
        assert float(update_res.json()["rating"]) == 4.50
    finally:
        db = SessionLocal()
        try:
            rating_val = f"{orig_rating}" if orig_rating is not None else "NULL"
            db.execute(text(f"UPDATE performance_reviews SET manager_review_status = '{orig_status}', rating = {rating_val} WHERE id = {rev_id};"))
            db.commit()
        finally:
            db.close()




def test_offboarding_management():
    admin_token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/v1/lifecycle/offboarding?size=5", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 0

    off = items[0]
    off_id = off["id"]
    orig_kt = off["kt_status"]
    orig_asset = off["asset_recovery_status"]

    try:
        update_res = client.patch(
            f"/api/v1/lifecycle/offboarding/{off_id}",
            json={"kt_status": "COMPLETED", "asset_recovery_status": "RETURNED"},
            headers=headers
        )
        assert update_res.status_code == 200
        assert update_res.json()["kt_status"] == "COMPLETED"
        assert update_res.json()["asset_recovery_status"] == "RETURNED"
    finally:
        db = SessionLocal()
        try:
            db.execute(text(f"UPDATE offboarding_records SET kt_status = '{orig_kt}', asset_recovery_status = '{orig_asset}' WHERE id = {off_id};"))
            db.commit()
        finally:
            db.close()

def test_lifecycle_overview_process_cards():
    token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/lifecycle/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "process_cards" in data
    cards = data["process_cards"]
    assert len(cards) == 6

    stages = [c["stage"] for c in cards]
    assert "ONBOARDING" in stages
    assert "PROBATION" in stages
    assert "CONFIRMATION" in stages
    assert "DOCUMENTATION" in stages
    assert "PERFORMANCE" in stages
    assert "OFFBOARDING" in stages

    for card in cards:
        assert "primary_count" in card
        assert "secondary_count" in card
        assert "action_required_count" in card
        assert card["primary_count"] >= 0


def test_lifecycle_templates_endpoints():
    admin_token = get_token("neha.saxena@auratech.in")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    exec_token = get_token("kavita.iyer@auratech.in")
    exec_headers = {"Authorization": f"Bearer {exec_token}"}

    # 1. List templates
    res = client.get("/api/v1/lifecycle/templates", headers=admin_headers)
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 25

    # 2. Filter by category
    res_onb = client.get("/api/v1/lifecycle/templates?category=ONBOARDING", headers=admin_headers)
    assert res_onb.status_code == 200
    assert all(t["category"] == "ONBOARDING" for t in res_onb.json())

    # 3. Preview execution for employee 1
    tmpl_ids = [templates[0]["id"], templates[1]["id"]]
    preview_res = client.post(
        f"/api/v1/lifecycle/templates/preview?employee_id=1&template_ids={tmpl_ids[0]}&template_ids={tmpl_ids[1]}",
        headers=admin_headers
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert preview_data["employee_id"] == 1
    assert len(preview_data["template_tasks"]) == 2

    # 4. HR Executive cannot create template
    create_payload = {
        "template_code": "TMPL_TEST_LFC_001",
        "name": "Test Checklist Task",
        "category": "ONBOARDING",
        "default_priority": "MEDIUM",
        "estimated_duration_days": 2,
        "default_role_code": "HR_EXECUTIVE",
    }
    exec_create = client.post("/api/v1/lifecycle/templates", json=create_payload, headers=exec_headers)
    assert exec_create.status_code == 403

    # 5. Admin can create, toggle, and clean up template
    admin_create = client.post("/api/v1/lifecycle/templates", json=create_payload, headers=admin_headers)
    assert admin_create.status_code == 201
    created = admin_create.json()
    tmpl_id = created["id"]

    try:
        # Toggle active
        toggle_res = client.post(f"/api/v1/lifecycle/templates/{tmpl_id}/toggle-active", headers=admin_headers)
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is False
    finally:
        db = SessionLocal()
        try:
            db.execute(text(f"DELETE FROM task_templates WHERE id = {tmpl_id};"))
            db.commit()
        finally:
            db.close()


def test_lifecycle_calendar_endpoint():
    token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/lifecycle/calendar", headers=headers)
    assert res.status_code == 200
    events = res.json()
    assert isinstance(events, list)
    if len(events) > 0:
        ev = events[0]
        assert "category" in ev
        assert "date" in ev
        assert "employee_name" in ev
        assert "status" in ev

    # Filter by category
    res_onb = client.get("/api/v1/lifecycle/calendar?category=ONBOARDING", headers=headers)
    assert res_onb.status_code == 200
    assert all(e["category"] == "ONBOARDING" for e in res_onb.json())


def test_performance_cycles_endpoint():
    token = get_token("neha.saxena@auratech.in")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/lifecycle/performance-reviews/cycles", headers=headers)
    assert res.status_code == 200
    cycles = res.json()
    assert isinstance(cycles, list)
    assert len(cycles) > 0
    assert "FY24-H2" in cycles or "FY23-H1" in cycles

