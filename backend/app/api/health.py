from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Application level health check."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timezone": settings.TIMEZONE,
    }


@router.get("/health/db", status_code=status.HTTP_200_OK)
def database_health_check(db: Session = Depends(get_db)):
    """Database connectivity health check."""
    try:
        result = db.execute(text("SELECT 1 AS check_alive, current_database() AS db_name, version() AS db_version;")).mappings().first()
        if not result:
            raise HTTPException(status_code=500, detail="Database check returned no result")

        return {
            "status": "healthy",
            "database_connected": True,
            "database_name": result["db_name"],
            "postgres_version": result["db_version"],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connectivity failed: {str(exc)}",
        )

