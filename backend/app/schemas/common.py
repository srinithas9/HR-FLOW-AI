from typing import Generic, TypeVar, List
from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int
    size: int
    total: int
    total_pages: int

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    pagination: PaginationMeta

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    status: str = "success"
    message: str

