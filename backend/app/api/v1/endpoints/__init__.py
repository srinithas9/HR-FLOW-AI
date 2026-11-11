from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.roles import router as roles_router
from app.api.v1.endpoints.departments import router as departments_router
from app.api.v1.endpoints.employees import router as employees_router

__all__ = [
    "auth_router",
    "users_router",
    "roles_router",
    "departments_router",
    "employees_router",
]

