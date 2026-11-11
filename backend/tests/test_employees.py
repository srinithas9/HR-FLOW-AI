import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
HR_MGR_EMAIL = "vikram.malhotra@auratech.in"
HR_EXEC_EMAIL = "kavita.iyer@auratech.in"
MGR_EMAIL = "ananya.sharma@auratech.in"  # VP SWE, employee_id = 2
PASSWORD = "Password@123"


def get_token(email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return res.json()["access_token"]


def test_admin_employee_pagination_and_total():
    token = get_token(ADMIN_EMAIL)
    response = client.get("/api/v1/employees?page=1&size=10", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 10
    assert data["pagination"]["total"] == 200
    assert data["pagination"]["total_pages"] == 20


def test_employee_search_by_code_and_name():
    token = get_token(ADMIN_EMAIL)
    # Search for EMP0001
    res1 = client.get("/api/v1/employees?search=EMP0001", headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 200
    assert len(res1.json()["items"]) == 1
    assert res1.json()["items"][0]["employee_code"] == "EMP0001"

    # Search by partial name
    res2 = client.get("/api/v1/employees?search=Vikram", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 200
    assert any("Vikram" in e["first_name"] for e in res2.json()["items"])


def test_employee_filtering():
    token = get_token(ADMIN_EMAIL)

    # Filter by department_id = 1 (SWE)
    res_dept = client.get("/api/v1/employees?department_id=1&size=100", headers={"Authorization": f"Bearer {token}"})
    assert res_dept.status_code == 200
    assert res_dept.json()["pagination"]["total"] == 65
    assert len(res_dept.json()["items"]) == 65
    assert all(e["department_id"] == 1 for e in res_dept.json()["items"])

    # Filter by status = PROBATION
    res_prob = client.get("/api/v1/employees?employment_status=PROBATION", headers={"Authorization": f"Bearer {token}"})
    assert res_prob.status_code == 200
    assert all(e["employment_status"] == "PROBATION" for e in res_prob.json()["items"])


def test_filter_options_endpoint():
    token = get_token(ADMIN_EMAIL)
    res = client.get("/api/v1/employees/filters/options", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "designations" in data
    assert len(data["designations"]) > 0
    assert "managers" in data
    assert len(data["managers"]) > 0
    assert "departments" in data
    assert len(data["departments"]) == 12
    assert "employment_statuses" in data
    assert "CONFIRMED" in data["employment_statuses"]


def test_designation_and_joining_date_filtering():
    token = get_token(ADMIN_EMAIL)

    # Get a designation from filter options
    opts = client.get("/api/v1/employees/filters/options", headers={"Authorization": f"Bearer {token}"}).json()
    test_desig = opts["designations"][0]

    res = client.get(f"/api/v1/employees?designation={test_desig}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(e["designation"] == test_desig for e in data["items"])

    # Filter by joining date range
    res_date = client.get(
        "/api/v1/employees?joining_date_from=2024-01-01&joining_date_to=2025-12-31",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_date.status_code == 200
    for emp in res_date.json()["items"]:
        assert "2024-01-01" <= emp["date_of_joining"] <= "2025-12-31"


def test_hr_executive_rbac_scoping():
    token = get_token(HR_EXEC_EMAIL)

    # List employees as HR_EXECUTIVE - scoped strictly to assigned responsibilities (21 employees)
    res = client.get("/api/v1/employees?size=100", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 21
    assigned_ids = {e["id"] for e in items}

    # Allowed access to an assigned employee
    first_assigned_id = next(iter(assigned_ids))
    res_allowed = client.get(f"/api/v1/employees/{first_assigned_id}", headers={"Authorization": f"Bearer {token}"})
    assert res_allowed.status_code == 200
    assert res_allowed.json()["id"] == first_assigned_id

    # Forbidden cross-access: attempt to view an employee outside assigned scope
    unassigned_id = next(i for i in range(1, 201) if i not in assigned_ids)
    res_denied = client.get(f"/api/v1/employees/{unassigned_id}", headers={"Authorization": f"Bearer {token}"})
    assert res_denied.status_code == 403
    assert res_denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_reporting_manager_access_restriction():
    # Login as Ananya Sharma (employee_id = 2)
    mgr_token = get_token(MGR_EMAIL)

    # List employees as reporting manager - must only return employees reporting to Ananya Sharma (+ herself)
    res = client.get("/api/v1/employees?size=100", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res.status_code == 200
    mgr_items = res.json()["items"]
    assert len(mgr_items) < 200
    assert all(e["manager_id"] == 2 or e["id"] == 2 for e in mgr_items)

    # Allowed access to direct report
    direct_report_id = [e["id"] for e in mgr_items if e["id"] != 2][0]
    res_report = client.get(f"/api/v1/employees/{direct_report_id}", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_report.status_code == 200
    assert res_report.json()["id"] == direct_report_id

    # Forbidden cross-access: attempt to view an employee outside Ananya's team (e.g. employee 10 in HR)
    res_unrelated = client.get("/api/v1/employees/10", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_unrelated.status_code == 403
    assert res_unrelated.json()["error"]["code"] == "PERMISSION_DENIED"


def test_circular_reporting_prevented():
    token = get_token(ADMIN_EMAIL)

    # Employee 2 (Ananya Sharma, VP SWE) is manager of Employee 4.
    # Trying to make Employee 4 the manager of Employee 2 must be blocked with circular chain error!
    res_cycle = client.put(
        "/api/v1/employees/2",
        json={"manager_id": 4},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_cycle.status_code == 422
    assert "circular" in res_cycle.json()["error"]["message"].lower()

    # Self-reporting: making an employee report to themselves
    res_self = client.put(
        "/api/v1/employees/2",
        json={"manager_id": 2},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_self.status_code == 422
    assert "own reporting manager" in res_self.json()["error"]["message"].lower()


def test_full_employee_profile_endpoint():
    token = get_token(ADMIN_EMAIL)
    res = client.get("/api/v1/employees/1/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()

    assert "employee" in data
    assert data["employee"]["id"] == 1
    assert "current_lifecycle_stage" in data
    assert "lifecycle_history" in data
    assert "hr_tasks" in data
    assert "assigned_tasks" in data
    assert "documents" in data
    assert "performance_reviews" in data
    assert "pending_actions" in data
    assert "activity_history" in data
    assert data["can_edit"] is True


def test_nonexistent_employee_returns_404():
    token = get_token(ADMIN_EMAIL)
    res = client.get("/api/v1/employees/99999", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
