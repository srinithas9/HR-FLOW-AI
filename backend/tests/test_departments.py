import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
PASSWORD = "Password@123"


def get_token() -> str:
    res = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": PASSWORD})
    return res.json()["access_token"]


def test_list_departments():
    token = get_token()
    response = client.get("/api/v1/departments", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    depts = response.json()
    assert len(depts) == 12
    # Verify employee count is populated
    swe = next((d for d in depts if d["department_code"] == "DEPT_SWE"), None)
    assert swe is not None
    assert swe["employee_count"] == 65


def test_get_department_detail():
    token = get_token()
    response = client.get("/api/v1/departments/1", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    dept = response.json()
    assert dept["id"] == 1
    assert dept["department_code"] == "DEPT_SWE"
    assert dept["head_of_department_name"] is not None


def test_get_nonexistent_department_returns_404():
    token = get_token()
    response = client.get("/api/v1/departments/9999", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
