from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.exceptions import ResourceNotFoundException
from app.models.organization import Role
from app.schemas.role import RoleRead


class RoleService:
    @staticmethod
    def list_roles(db: Session) -> List[RoleRead]:
        """Return all approved roles in the system."""
        stmt = select(Role).order_by(Role.id.asc())
        roles = db.scalars(stmt).all()
        return [RoleRead.model_validate(r) for r in roles]

    @staticmethod
    def get_role_by_id(db: Session, role_id: int) -> RoleRead:
        role = db.scalar(select(Role).where(Role.id == role_id))
        if not role:
            raise ResourceNotFoundException(f"Role with ID {role_id} does not exist.")
        return RoleRead.model_validate(role)

