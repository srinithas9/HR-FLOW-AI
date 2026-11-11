from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_

from app.core.security import hash_password
from app.core.exceptions import ResourceNotFoundException, ConflictException, ValidationException
from app.models.organization import User, Role, Employee
from app.schemas.user import UserCreate, UserUpdate, UserRead
from app.schemas.common import PaginatedResponse, PaginationMeta


class UserService:
    @staticmethod
    def list_users(
        db: Session,
        page: int = 1,
        size: int = 20,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None
    ) -> PaginatedResponse[UserRead]:
        stmt = (
            select(User)
            .options(
                joinedload(User.role),
                joinedload(User.employee)
            )
        )

        if role_id is not None:
            stmt = stmt.where(User.role_id == role_id)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    User.full_name.ilike(search_pattern),
                    User.email.ilike(search_pattern)
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
        total = db.scalar(count_stmt) or 0

        # Pagination
        offset = (page - 1) * size
        stmt = stmt.order_by(User.id.asc()).offset(offset).limit(size)
        users = db.scalars(stmt).all()

        total_pages = (total + size - 1) // size if size > 0 else 1

        return PaginatedResponse(
            items=[UserRead.model_validate(u) for u in users],
            pagination=PaginationMeta(
                page=page,
                size=size,
                total=total,
                total_pages=total_pages
            )
        )

    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> User:
        stmt = (
            select(User)
            .options(
                joinedload(User.role),
                joinedload(User.employee)
            )
            .where(User.id == user_id)
        )
        user = db.scalar(stmt)
        if not user:
            raise ResourceNotFoundException(f"User with ID {user_id} does not exist.")
        return user

    @staticmethod
    def create_user(db: Session, user_in: UserCreate) -> User:
        # Check email uniqueness
        existing_email = db.scalar(select(User).where(User.email == user_in.email.strip().lower()))
        if existing_email:
            raise ConflictException(f"A user with email '{user_in.email}' already exists.")

        # Check role exists
        role = db.scalar(select(Role).where(Role.id == user_in.role_id))
        if not role:
            raise ValidationException(f"Role ID {user_in.role_id} does not exist.")

        # Check employee if provided
        if user_in.employee_id:
            emp = db.scalar(select(Employee).where(Employee.id == user_in.employee_id))
            if not emp:
                raise ValidationException(f"Employee ID {user_in.employee_id} does not exist.")
            # Check if employee already linked
            existing_link = db.scalar(select(User).where(User.employee_id == user_in.employee_id))
            if existing_link:
                raise ConflictException(f"Employee ID {user_in.employee_id} is already linked to another user account.")

        hashed_pw = hash_password(user_in.password)
        new_user = User(
            email=user_in.email.strip().lower(),
            hashed_password=hashed_pw,
            full_name=user_in.full_name.strip(),
            role_id=user_in.role_id,
            employee_id=user_in.employee_id,
            is_active=user_in.is_active,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return UserService.get_user_by_id(db, new_user.id)

    @staticmethod
    def update_user(db: Session, user_id: int, user_in: UserUpdate) -> User:
        user = UserService.get_user_by_id(db, user_id)

        if user_in.full_name is not None:
            user.full_name = user_in.full_name.strip()

        if user_in.role_id is not None:
            role = db.scalar(select(Role).where(Role.id == user_in.role_id))
            if not role:
                raise ValidationException(f"Role ID {user_in.role_id} does not exist.")
            user.role_id = user_in.role_id

        if user_in.employee_id is not None:
            emp = db.scalar(select(Employee).where(Employee.id == user_in.employee_id))
            if not emp:
                raise ValidationException(f"Employee ID {user_in.employee_id} does not exist.")
            user.employee_id = user_in.employee_id

        if user_in.password:
            user.hashed_password = hash_password(user_in.password)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user_status(db: Session, user_id: int, is_active: bool) -> User:
        user = UserService.get_user_by_id(db, user_id)
        user.is_active = is_active
        db.commit()
        db.refresh(user)
        return user

