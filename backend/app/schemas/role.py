from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RoleRead(BaseModel):
    id: int
    role_code: str
    role_name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

