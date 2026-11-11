from typing import List
from sqlalchemy.orm import Session, aliased
from sqlalchemy import select, func

from app.core.exceptions import ResourceNotFoundException
from app.models.organization import Department, Employee
from app.schemas.department import DepartmentRead, DepartmentDetail


class DepartmentService:
    @staticmethod
    def list_departments(db: Session) -> List[DepartmentRead]:
        """List all departments with employee counts."""
        # Query departments and count employees per department
        emp_count_subq = (
            select(
                Employee.department_id,
                func.count(Employee.id).label("emp_count")
            )
            .group_by(Employee.department_id)
            .subquery()
        )

        stmt = (
            select(
                Department,
                func.coalesce(emp_count_subq.c.emp_count, 0).label("employee_count")
            )
            .outerjoin(emp_count_subq, Department.id == emp_count_subq.c.department_id)
            .order_by(Department.id.asc())
        )

        results = db.execute(stmt).all()
        departments = []
        for dept, count in results:
            d_dict = DepartmentRead.model_validate(dept)
            d_dict.employee_count = count
            departments.append(d_dict)
        return departments

    @staticmethod
    def get_department_by_id(db: Session, department_id: int) -> DepartmentDetail:
        """Get department details with head of department name."""
        HeadEmployee = aliased(Employee)
        emp_count_subq = (
            select(
                Employee.department_id,
                func.count(Employee.id).label("emp_count")
            )
            .where(Employee.department_id == department_id)
            .group_by(Employee.department_id)
            .subquery()
        )

        stmt = (
            select(
                Department,
                HeadEmployee,
                func.coalesce(emp_count_subq.c.emp_count, 0).label("employee_count")
            )
            .outerjoin(HeadEmployee, Department.head_of_department_id == HeadEmployee.id)
            .outerjoin(emp_count_subq, Department.id == emp_count_subq.c.department_id)
            .where(Department.id == department_id)
        )

        row = db.execute(stmt).first()
        if not row:
            raise ResourceNotFoundException(f"Department with ID {department_id} does not exist.")

        dept, head_emp, count = row
        head_name = f"{head_emp.first_name} {head_emp.last_name}" if head_emp else None

        detail = DepartmentDetail.model_validate(dept)
        detail.employee_count = count
        detail.head_of_department_name = head_name
        return detail

