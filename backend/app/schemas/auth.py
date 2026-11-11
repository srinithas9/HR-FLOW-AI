from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from app.schemas.role import RoleRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthUserRead(BaseModel):
    id: int
    email: str
    full_name: str
    role_id: int
    role: RoleRead
    employee_id: Optional[int] = None
    is_active: bool
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: AuthUserRead


class UserMeResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: RoleRead
    employee_id: Optional[int] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

