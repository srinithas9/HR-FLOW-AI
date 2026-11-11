from fastapi import APIRouter
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.users import router as users_router
from app.api.v1.endpoints.roles import router as roles_router
from app.api.v1.endpoints.departments import router as departments_router
from app.api.v1.endpoints.employees import router as employees_router
from app.api.v1.endpoints.lifecycle import router as lifecycle_router
from app.api.v1.endpoints.tasks import router as tasks_router
from app.api.v1.endpoints.follow_ups import router as follow_ups_router
from app.api.v1.endpoints.ml import router as ml_router
from app.api.v1.endpoints.ml_intelligence import router as ml_intelligence_router
from app.api.v1.endpoints.copilot import router as copilot_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.analytics import router as analytics_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(roles_router)
api_v1_router.include_router(departments_router)
api_v1_router.include_router(employees_router)
api_v1_router.include_router(lifecycle_router)
api_v1_router.include_router(tasks_router)
api_v1_router.include_router(follow_ups_router)
api_v1_router.include_router(ml_router)
api_v1_router.include_router(ml_intelligence_router)
api_v1_router.include_router(copilot_router)
api_v1_router.include_router(copilot_router, prefix="/hr-operations-copilot")
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(analytics_router)

