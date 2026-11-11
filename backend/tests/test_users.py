import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
MGR_EMAIL = "ananya.sharma@auratech.in"
PASSWORD = "Password@123"


def get_token(email: str) -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    return res.json()["access_token"]


def test_admin_create_user_success():
    admin_token = get_token(ADMIN_EMAIL)
    test_email = "ephemeral.testuser@auratech.in"
    new_user_data = {
        "email": test_email,
        "password": "SecurePassword@2026",
        "full_name": "Test Platform Engineer",
        "role_id": 2,  # HR_EXECUTIVE
        "is_active": True
    }
    created_id = None
    try:
        response = client.post(
            "/api/v1/users",
            json=new_user_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 201
        created = response.json()
        created_id = created["id"]
        assert created["email"] == test_email
        assert created["full_name"] == "Test Platform Engineer"
        assert created["role"]["id"] == 2
        # Verify password hash is NEVER exposed
        assert "password" not in created
        assert "hashed_password" not in created
    finally:
        if created_id:
            from app.db.session import SessionLocal
            from sqlalchemy import text
            db = SessionLocal()
            try:
                db.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": created_id})
                db.commit()
            finally:
                db.close()


def test_non_admin_cannot_create_user():
    mgr_token = get_token(MGR_EMAIL)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "unauthorized.create@auratech.in",
            "password": "Password@123",
            "full_name": "Unauthorized User",
            "role_id": 1
        },
        headers={"Authorization": f"Bearer {mgr_token}"}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


def test_duplicate_email_rejected():
    admin_token = get_token(ADMIN_EMAIL)
    # Attempt to create with existing email
    response = client.post(
        "/api/v1/users",
        json={
            "email": ADMIN_EMAIL,
            "password": "Password@123",
            "full_name": "Duplicate Admin",
            "role_id": 1
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RESOURCE_CONFLICT"


def test_invalid_role_id_rejected():
    admin_token = get_token(ADMIN_EMAIL)
    response = client.post(
        "/api/v1/users",
        json={
            "email": "badrole.user@auratech.in",
            "password": "Password@123",
            "full_name": "Bad Role User",
            "role_id": 9999
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_admin_update_user_status():
    admin_token = get_token(ADMIN_EMAIL)
    # Update status of user 22
    response = client.patch(
        "/api/v1/users/22/status",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Restore status to active
    restore_res = client.patch(
        "/api/v1/users/22/status",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert restore_res.status_code == 200
    assert restore_res.json()["is_active"] is True
