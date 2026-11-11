from typing import Optional, List, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from app.schemas.lifecycle import (
    EmployeeLifecycleRead,
    OnboardingRecordRead,
    ProbationRecordRead,
    ConfirmationRecordRead,
    PerformanceReviewRead,
    OffboardingRecordRead,
)
from app.schemas.document import EmployeeDocumentRead


class EmployeeRead(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    phone_number: str
    department_id: int
    designation: str
    location: str
    employment_status: str
    date_of_joining: date
    manager_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeDetail(EmployeeRead):
    department_name: Optional[str] = None
    manager_name: Optional[str] = None
    current_lifecycle_stage: Optional[str] = None


class EmployeeCreate(BaseModel):
    employee_code: str = Field(..., min_length=3, max_length=20, description="Unique employee identifier (e.g. EMP-00999)")
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr = Field(..., description="Unique corporate email address")
    phone_number: str = Field(..., min_length=10, max_length=20)
    department_id: int = Field(..., description="Valid department ID")
    designation: str = Field(..., min_length=2, max_length=100)
    location: str = Field(..., min_length=2, max_length=100, description="Indian office hub (e.g. Bengaluru, Hyderabad, Pune, Chennai, Mumbai, Gurugram)")
    employment_status: str = Field("PROBATION", max_length=30, description="CONFIRMED, PROBATION, NOTICE_PERIOD, RESIGNED")
    date_of_joining: date
    manager_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(None, min_length=10, max_length=20)
    department_id: Optional[int] = None
    designation: Optional[str] = Field(None, min_length=2, max_length=100)
    location: Optional[str] = Field(None, min_length=2, max_length=100)
    employment_status: Optional[str] = Field(None, max_length=30)
    date_of_joining: Optional[date] = None
    manager_id: Optional[int] = None


class EmployeeTaskItem(BaseModel):
    id: int
    task_code: str
    title: str
    category: str
    priority: str
    status: str
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    is_subject: bool = True  # True = HR task concerning employee; False = task assigned to employee
    link_path: str

    model_config = ConfigDict(from_attributes=True)


class EmployeeActivityItem(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmployeeProfileResponse(BaseModel):
    employee: EmployeeDetail
    current_lifecycle_stage: Optional[str] = None
    lifecycle_history: List[EmployeeLifecycleRead] = []
    onboarding: Optional[OnboardingRecordRead] = None
    onboarding_checklist: List[EmployeeTaskItem] = []
    probation: Optional[ProbationRecordRead] = None
    confirmation: Optional[ConfirmationRecordRead] = None
    documents: List[EmployeeDocumentRead] = []
    performance_reviews: List[PerformanceReviewRead] = []
    offboarding: Optional[OffboardingRecordRead] = None
    hr_tasks: List[EmployeeTaskItem] = []
    assigned_tasks: List[EmployeeTaskItem] = []
    tasks: List[EmployeeTaskItem] = []
    pending_actions: List[Dict[str, Any]] = []
    activity_history: List[EmployeeActivityItem] = []
    can_edit: bool = False


class EmployeeFilterOptions(BaseModel):
    designations: List[str]
    managers: List[Dict[str, Any]]
    departments: List[Dict[str, Any]]
    employment_statuses: List[str]
