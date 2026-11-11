from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.permissions import require_active_user, require_roles
from app.models.organization import User
from app.services.task_service import TaskService
from app.schemas.common import PaginatedResponse, MessageResponse
from app.schemas.task import (
    TaskRead,
    TaskDetail,
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskReassign,
    TaskDeadlineExtension,
    TaskDependencyCreate,
    TaskDependencyRead,
    TaskOverviewMetrics,
    TaskTemplateRead,
    TaskCommentCreate,
    TaskCommentRead,
    TaskReopen,
)

router = APIRouter(prefix="/tasks", tags=["HR Action Center & Tasks"])


@router.get("", response_model=PaginatedResponse[TaskRead], status_code=status.HTTP_200_OK)
def list_tasks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None, description="ONBOARDING, PROBATION, CONFIRMATION, PERFORMANCE, OFFBOARDING, COMPLIANCE"),
    department_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None, description="LOW, MEDIUM, HIGH, CRITICAL"),
    status: Optional[str] = Query(None, description="PENDING, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED"),
    due_date_from: Optional[date] = Query(None),
    due_date_to: Optional[date] = Query(None),
    overdue: Optional[bool] = Query(None),
    risk_level: Optional[str] = Query(None, description="LOW, MEDIUM, HIGH, CRITICAL"),
    active_only: Optional[bool] = Query(None, description="Filter for active tasks only"),
    due_in_next_days: Optional[int] = Query(None, description="Filter for tasks due within next N days"),
    view: Optional[str] = Query(None, description="MY_TASKS, TEAM_TASKS, ALL_TASKS, COMPLETED"),
    due_window: Optional[str] = Query(None, description="TODAY, NEXT_7_DAYS, OVERDUE"),
    search: Optional[str] = Query(None, description="Search by task ID, title, description, or employee name"),
    sort_by: str = Query("due_date", description="due_date, priority, status, created_at, task_code"),
    sort_order: str = Query("asc", description="asc or desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    List tasks with comprehensive filtering, search, sorting, and pagination.
    REPORTING_MANAGER is strictly scoped to direct reports and directly assigned tasks.
    """
    return TaskService.list_tasks(
        db=db,
        current_user=current_user,
        page=page,
        size=size,
        category=category,
        department_id=department_id,
        owner_id=owner_id,
        employee_id=employee_id,
        priority=priority,
        status=status,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        overdue=overdue,
        risk_level=risk_level,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        active_only=active_only,
        due_in_next_days=due_in_next_days,
        view=view,
        due_window=due_window,
    )


@router.get("/overview", response_model=TaskOverviewMetrics, status_code=status.HTTP_200_OK)
def get_task_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve aggregated task metrics (Pending, In Progress, Blocked, Overdue, High ML Risk).
    Scoped for Reporting Managers to their direct reports.
    """
    return TaskService.get_task_overview(db=db, current_user=current_user)


@router.get("/templates", response_model=List[TaskTemplateRead], status_code=status.HTTP_200_OK)
def list_task_templates(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """List active task templates for guided task creation."""
    return TaskService.list_task_templates(db=db, category=category)


@router.get("/{task_id}", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def get_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Retrieve comprehensive task details including dependencies, status history,
    reassignments, follow-ups, and ML risk intelligence.
    """
    return TaskService.get_task_by_id(db=db, current_user=current_user, task_id=task_id)


@router.post("", response_model=TaskDetail, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Create a new operational task with employee association, template, and initial dependencies.
    """
    return TaskService.create_task(db=db, current_user=current_user, data=data)


@router.put("/{task_id}", response_model=TaskDetail, status_code=status.HTTP_200_OK)
@router.patch("/{task_id}", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Update task metadata, priority, title, or description."""
    return TaskService.update_task(db=db, current_user=current_user, task_id=task_id, data=data)


@router.post("/{task_id}/reassign", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def reassign_task_owner(
    task_id: int,
    data: TaskReassign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Reassign task to a new owner with audit reason logging."""
    return TaskService.reassign_task(db=db, current_user=current_user, task_id=task_id, data=data)


@router.post("/{task_id}/extend-deadline", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def extend_task_deadline(
    task_id: int,
    data: TaskDeadlineExtension,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Modify task deadline. Mandatory reason required (minimum 5 characters).
    Maintains extension counters and audit history.
    """
    return TaskService.extend_deadline(db=db, current_user=current_user, task_id=task_id, data=data)


@router.patch("/{task_id}/status", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def update_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Update task status.
    - Prevents completion if mandatory prerequisites are incomplete,
      unless an authorized administrative override (ADMIN or HR_MANAGER) is provided with an explicit audit reason.
    - Automatically updates completed_at timestamp.
    """
    return TaskService.update_status(db=db, current_user=current_user, task_id=task_id, data=data)


@router.post("/{task_id}/dependencies", response_model=TaskDependencyRead, status_code=status.HTTP_201_CREATED)
def add_task_dependency(
    task_id: int,
    data: TaskDependencyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Add a prerequisite dependency to a task.
    - Restricted to ADMIN and HR_MANAGER.
    - Prevents self-dependency.
    - Performs cycle detection to prevent circular dependencies.
    """
    return TaskService.add_dependency(db=db, current_user=current_user, task_id=task_id, data=data)


@router.delete("/{task_id}/dependencies/{dependency_id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def remove_task_dependency(
    task_id: int,
    dependency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HR_MANAGER"]))
):
    """
    Remove a prerequisite dependency.
    Restricted to ADMIN and HR_MANAGER.
    """
    TaskService.remove_dependency(db=db, current_user=current_user, task_id=task_id, dependency_id=dependency_id)
    return MessageResponse(message=f"Dependency {dependency_id} removed successfully.")


@router.post("/{task_id}/comments", response_model=TaskCommentRead, status_code=status.HTTP_201_CREATED)
def add_task_comment(
    task_id: int,
    data: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Add an operational comment to a task."""
    return TaskService.add_comment(db=db, current_user=current_user, task_id=task_id, comment=data.comment)


@router.post("/{task_id}/reopen", response_model=TaskDetail, status_code=status.HTTP_200_OK)
def reopen_task(
    task_id: int,
    data: TaskReopen,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """Reopen a completed task back to IN_PROGRESS."""
    return TaskService.reopen_task(db=db, current_user=current_user, task_id=task_id, reason=data.reason)


@router.delete("/{task_id}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_user)
):
    """
    Delete a manually created task.
    Protected: lifecycle-generated tasks, completed tasks, and tasks with active dependents cannot be deleted.
    """
    TaskService.delete_task(db=db, current_user=current_user, task_id=task_id)
    return MessageResponse(message=f"Task {task_id} deleted successfully.")

