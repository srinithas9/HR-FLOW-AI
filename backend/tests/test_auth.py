import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

ADMIN_EMAIL = "neha.saxena@auratech.in"
VALID_PASSWORD = "Password@123"


def test_login_success():
    response = client.post("/api/v1/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": VALID_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"]["role_code"] == "ADMIN"
    assert "hashed_password" not in data["user"]


def test_login_invalid_password():
    response = client.post("/api/v1/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": "WrongPassword!456"
    })
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"
    assert data["error"]["message"] == "Invalid email or password."


def test_login_unknown_email():
    response = client.post("/api/v1/auth/login", json={
        "email": "nonexistent.user999@auratech.in",
        "password": VALID_PASSWORD
    })
    assert response.status_code == 401
    data = response.json()
    # Message must be generic and not leak user existence
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"
    assert data["error"]["message"] == "Invalid email or password."


def test_login_inactive_user():
    from app.db.session import SessionLocal
    from app.models.organization import User
    db = SessionLocal()
    user = db.query(User).filter(User.id == 23).first()
    original_status = user.is_active
    try:
        user.is_active = False
        db.commit()
        response = client.post("/api/v1/auth/login", json={
            "email": user.email,
            "password": VALID_PASSWORD
        })
        assert response.status_code == 403
        data = response.json()
        assert data["error"]["code"] == "PERMISSION_DENIED"
        assert "inactive" in data["error"]["message"].lower()
    finally:
        user.is_active = original_status
        db.commit()
        db.close()


def test_current_user_me_endpoint():
    # Login to get token
    login_res = client.post("/api/v1/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": VALID_PASSWORD
    })
    token = login_res.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {token}"
    })
    assert response.status_code == 200
    me_data = response.json()
    assert me_data["email"] == ADMIN_EMAIL
    assert me_data["role"]["role_code"] == "ADMIN"
    assert "hashed_password" not in me_data


def test_me_missing_token():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


def test_me_invalid_token():
    response = client.get("/api/v1/auth/me", headers={
        "Authorization": "Bearer completely-invalid-malformed-token"
    })
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"


def test_me_expired_token():
    # Create an expired token
    expired_token = create_access_token(
        subject="1",
        role="ADMIN",
        email=ADMIN_EMAIL,
        user_id=1,
        expires_delta=timedelta(seconds=-10)
    )
    response = client.get("/api/v1/auth/me", headers={
        "Authorization": f"Bearer {expired_token}"
    })
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "AUTHENTICATION_FAILED"
