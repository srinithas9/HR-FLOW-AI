from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from app.schemas.role import RoleRead


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    role_id: int
    role: RoleRead
    employee_id: Optional[int] = None
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="User password (minimum 6 characters)")
    full_name: str = Field(..., min_length=1, max_length=150)
    role_id: int
    employee_id: Optional[int] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=150)
    role_id: Optional[int] = None
    employee_id: Optional[int] = None
    password: Optional[str] = Field(None, min_length=6, description="Update password if provided")


class UserStatusUpdate(BaseModel):
    is_active: bool

