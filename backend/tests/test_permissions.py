import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
HR_EXEC_EMAIL = "kavita.iyer@auratech.in"
HR_MGR_EMAIL = "rajesh.venkat@auratech.in"
MGR_EMAIL = "ananya.sharma@auratech.in"
PASSWORD = "Password@123"


def get_token(email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_admin_can_access_users_endpoint():
    token = get_token(ADMIN_EMAIL)
    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "pagination" in data


def test_hr_executive_cannot_access_users_endpoint():
    token = get_token(HR_EXEC_EMAIL)
    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PERMISSION_DENIED"


def test_hr_manager_cannot_access_users_endpoint():
    token = get_token(HR_MGR_EMAIL)
    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PERMISSION_DENIED"


def test_reporting_manager_cannot_access_users_endpoint():
    token = get_token(MGR_EMAIL)
    response = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "PERMISSION_DENIED"


def test_roles_endpoint_accessible_by_all_authenticated_roles():
    for email in [ADMIN_EMAIL, HR_EXEC_EMAIL, HR_MGR_EMAIL, MGR_EMAIL]:
        token = get_token(email)
        response = client.get("/api/v1/roles", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        roles = response.json()
        assert len(roles) == 4
        role_codes = {r["role_code"] for r in roles}
        assert role_codes == {"ADMIN", "HR_EXECUTIVE", "REPORTING_MANAGER", "HR_MANAGER"}
