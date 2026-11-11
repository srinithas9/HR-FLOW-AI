from typing import Any, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppException(Exception):
    """Base application exception."""
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(self, message: Optional[str] = None, details: Any = None):
        if message:
            self.message = message
        self.details = details
        super().__init__(self.message)


class AuthenticationException(AppException):
    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "AUTHENTICATION_FAILED"
    message = "Authentication credentials are invalid or missing."


class PermissionDeniedException(AppException):
    status_code = status.HTTP_403_FORBIDDEN
    error_code = "PERMISSION_DENIED"
    message = "You do not have permission to access this resource."


class ResourceNotFoundException(AppException):
    status_code = status.HTTP_404_NOT_FOUND
    error_code = "RESOURCE_NOT_FOUND"
    message = "The requested resource was not found."


class ConflictException(AppException):
    status_code = status.HTTP_409_CONFLICT
    error_code = "RESOURCE_CONFLICT"
    message = "Resource already exists or conflicts with current state."


class ValidationException(AppException):
    status_code = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)
    error_code = "VALIDATION_ERROR"
    message = "Invalid input data provided."


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "HTTP_ERROR",
                "message": str(exc.detail),
                "details": None,
            }
        },
    )


from fastapi.encoders import jsonable_encoder

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "error": {
                "code": "REQUEST_VALIDATION_ERROR",
                "message": "Input validation failed.",
                "details": jsonable_encoder(exc.errors()),
            }
        },
    )
