from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class DocumentRequirementRead(BaseModel):
    id: int
    requirement_code: str
    name: str
    lifecycle_stage: str
    is_mandatory: bool
    file_format_allowed: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeDocumentRead(BaseModel):
    id: int
    employee_id: int
    requirement_id: int
    document_name: str
    file_path: str
    submission_date: date
    status: str
    verified_by_id: Optional[int] = None
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Display helper
    requirement_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeDocumentCreate(BaseModel):
    requirement_id: int
    document_name: str = Field(..., min_length=2, max_length=200)
    file_path: str = Field(..., min_length=2, max_length=500)


class DocumentVerificationUpdate(BaseModel):
    status: str = Field(..., description="VERIFIED or REJECTED")
    verification_notes: Optional[str] = None

