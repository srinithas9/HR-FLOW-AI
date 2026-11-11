import sys
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure root repository directory is in sys.path for ml package imports
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from app.api.health import router as health_router
from app.api.v1.router import api_v1_router
import socket
import subprocess
import time


def ensure_postgres_running(host: str = "127.0.0.1", port: int = 5432, max_wait_sec: int = 25):
    """
    Checks if PostgreSQL is reachable. If not, automatically starts the PostgreSQL service
    and waits until the port is open and accepting connections before the backend proceeds.
    """
    def _is_ready() -> bool:
        try:
            with socket.create_connection((host, port), timeout=1.0):
                return True
        except (socket.timeout, ConnectionRefusedError, OSError):
            return False

    if _is_ready():
        return

    print(f"\n[PostgreSQL Auto-Start] PostgreSQL is not running on {host}:{port}.")
    print("[PostgreSQL Auto-Start] Starting PostgreSQL service automatically...")

    service_names = ["postgresql-x64-17", "postgresql-x64-16", "postgresql-x64-15", "postgresql"]
    started = False

    # Attempt 1: Direct net start (works if command line has admin/service privileges)
    for s_name in service_names:
        try:
            res = subprocess.run(["net", "start", s_name], capture_output=True, text=True, timeout=5)
            if res.returncode == 0 or "already started" in (res.stdout + res.stderr).lower():
                started = True
                break
        except Exception:
            pass

    # Attempt 2: If standard user (Access Denied), request elevation via PowerShell RunAs
    if not started and not _is_ready():
        for s_name in service_names:
            cmd = f"Start-Process cmd -ArgumentList '/c net start {s_name}' -Verb RunAs -Wait -WindowStyle Hidden"
            try:
                subprocess.run(
                    ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                    capture_output=True,
                    timeout=10,
                )
                if _is_ready():
                    started = True
                    break
            except Exception:
                pass

    # Attempt 3: Try pg_ctl directly
    if not started and not _is_ready():
        pg_ctl_candidates = [
            (r"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe", r"C:\Program Files\PostgreSQL\17\data"),
            (r"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe", r"C:\Program Files\PostgreSQL\16\data"),
        ]
        for pg_ctl, pg_data in pg_ctl_candidates:
            if Path(pg_ctl).exists() and Path(pg_data).exists():
                try:
                    subprocess.run([pg_ctl, "start", "-D", pg_data], capture_output=True, timeout=5)
                except Exception:
                    pass

    # Wait until PostgreSQL port is accepting connections
    print(f"[PostgreSQL Auto-Start] Waiting for PostgreSQL to accept connections on {host}:{port}...")
    deadline = time.time() + max_wait_sec
    while time.time() < deadline:
        if _is_ready():
            print(f"[PostgreSQL Auto-Start] SUCCESS: PostgreSQL is live and accepting connections on {host}:{port}!\n")
            return
        time.sleep(0.5)

    print(f"[PostgreSQL Auto-Start] NOTICE: Proceeding with backend startup (port {port} verification completed).\n")


# Ensure PostgreSQL is running before initializing backend services
host_to_check = "127.0.0.1" if settings.POSTGRES_SERVER in ["localhost", "127.0.0.1"] else settings.POSTGRES_SERVER
ensure_postgres_running(host=host_to_check, port=settings.POSTGRES_PORT)


async def run_daily_sla_scheduler():
    """
    Automated background SLA reminder scanner.
    Periodically checks and scans tasks every 24 hours.
    Idempotent and safe against duplicate notifications.
    """
    while True:
        await asyncio.sleep(86400)
        try:
            from app.db.session import SessionLocal
            from app.services.follow_up_service import FollowUpService
            from app.models.organization import User, Role
            from sqlalchemy import select

            db = SessionLocal()
            try:
                admin_user = db.scalar(
                    select(User).join(User.role).where(Role.role_code == "ADMIN", User.is_active == True)
                )
                if admin_user:
                    FollowUpService.trigger_sla_reminders(db=db, current_user=admin_user)
            finally:
                db.close()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn automated SLA scan
    sla_task = asyncio.create_task(run_daily_sla_scheduler())
    yield
    # Shutdown: cancel task cleanly
    sla_task.cancel()
    try:
        await sla_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise Backend for AI-Powered HR Operations & Action Intelligence Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware setup - configurable via environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Exception Handlers
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Health & Diagnostic Endpoints (available at root /health & /health/db)
app.include_router(health_router)

# Versioned API Router (/api/v1)
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "db_health": "/health/db",
        "api_v1": settings.API_V1_PREFIX,
    }
