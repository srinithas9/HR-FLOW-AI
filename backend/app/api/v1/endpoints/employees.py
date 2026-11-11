from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user, require_roles
from app.models.organization import User
from app.schemas.employee import (
    EmployeeRead,
    EmployeeDetail,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeProfileResponse,
    EmployeeFilterOptions,
)
from app.schemas.common import PaginatedResponse
from app.services.employee_service import EmployeeService

router = APIRouter(prefix="/employees", tags=["Employee Management"])


@router.get("", response_model=PaginatedResponse[EmployeeDetail], status_code=status.HTTP_200_OK)
def list_employees(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, employee code, email, or designation"),
    department_id: Optional[int] = Query(None, description="Filter by department ID"),
    employment_status: Optional[str] = Query(None, description="Filter by status (CONFIRMED, PROBATION, NOTICE_PERIOD, RESIGNED)"),
    manager_id: Optional[int] = Query(None, description="Filter by reporting manager ID"),
    location: Optional[str] = Query(None, description="Filter by Indian office hub"),
    designation: Optional[str] = Query(None, description="Filter by designation"),
    joining_date_from: Optional[date] = Query(None, description="Filter joining date from (inclusive)"),
    joining_date_to: Optional[date] = Query(None, description="Filter joining date to (inclusive)"),
    sort_by: str = Query("id", description="Field to sort by (id, employee_code, first_name, last_name, date_of_joining, employment_status, location, designation)"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$", description="Sort direction (asc or desc)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List employees with pagination, search, multi-field filtering, and sorting.
    RBAC Enforcement:
    - ADMIN and HR_MANAGER: Full organization-wide visibility.
    - HR_EXECUTIVE: Scoped strictly to assigned responsibilities.
    - REPORTING_MANAGER: Query-level restriction strictly to direct reporting team members.
    """
    return EmployeeService.list_employees(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        search=search,
        department_id=department_id,
        employment_status=employment_status,
        manager_id=manager_id,
        location=location,
        designation=designation,
        joining_date_from=joining_date_from,
        joining_date_to=joining_date_to,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/filters/options", response_model=EmployeeFilterOptions, status_code=status.HTTP_200_OK)
def get_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve dynamically populated filter options including distinct designations,
    managers, departments, and employment statuses.
    """
    return EmployeeService.get_filter_options(db=db, current_user=current_user)


@router.post("", response_model=EmployeeDetail, status_code=status.HTTP_201_CREATED)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Create a new employee with relation validation, initial lifecycle stage assignment, and activity logging.
    Strictly restricted to ADMIN and HR_MANAGER.
    """
    return EmployeeService.create_employee(db=db, current_user=current_user, data=data)


@router.get("/{employee_id}", response_model=EmployeeDetail, status_code=status.HTTP_200_OK)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve basic employee profile details.
    Enforces RBAC scoping across REPORTING_MANAGER and HR_EXECUTIVE roles.
    """
    return EmployeeService.get_employee_by_id(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
    )


@router.put("/{employee_id}", response_model=EmployeeDetail, status_code=status.HTTP_200_OK)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Update employee details with relation validation, cycle prevention, and activity logging.
    Strictly restricted to ADMIN and HR_MANAGER.
    """
    return EmployeeService.update_employee(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
        data=data,
    )


@router.get("/{employee_id}/profile", response_model=EmployeeProfileResponse, status_code=status.HTTP_200_OK)
def get_employee_full_profile(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve comprehensive 360-degree employee profile spanning:
    - Personal & professional information
    - Lifecycle stage timeline & current stage
    - Onboarding record & onboarding task checklist
    - Probation review record & status
    - Confirmation record & approval status
    - Document verification checklist & remarks
    - Performance review history
    - Offboarding & clearance record
    - HR tasks concerning the employee (subject) vs tasks assigned to the employee (owner)
    - Actionable pending items
    - Activity history from audit logs
    """
    return EmployeeService.get_employee_profile(
        db=db,
        current_user=current_user,
        employee_id=employee_id,
    )
