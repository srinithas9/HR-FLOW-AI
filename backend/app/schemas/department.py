from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DepartmentRead(BaseModel):
    id: int
    department_code: str
    name: str
    description: Optional[str] = None
    head_of_department_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    employee_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class DepartmentDetail(DepartmentRead):
    head_of_department_name: Optional[str] = None

