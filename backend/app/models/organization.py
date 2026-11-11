from datetime import datetime, date
from typing import Optional, List
from sqlalchemy import (
    BigInteger,
    String,
    Boolean,
    Text,
    Date,
    DateTime,
    ForeignKey,
    Index,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    department_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    head_of_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("employees.id", ondelete="SET NULL", use_alter=True, name="fk_departments_head_of_department_id"),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    employees: Mapped[List["Employee"]] = relationship("Employee", back_populates="department", foreign_keys="Employee.department_id")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    role_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="role")


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(25), nullable=False)
    department_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    employment_status: Mapped[str] = mapped_column(String(30), nullable=False, default="FULL_TIME", index=True)
    date_of_joining: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    manager_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    department: Mapped["Department"] = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    manager: Mapped[Optional["Employee"]] = relationship("Employee", remote_side=[id], foreign_keys=[manager_id])
    user: Mapped[Optional["User"]] = relationship("User", back_populates="employee", uselist=False)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def status(self) -> str:
        return self.employment_status


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("employees.id", ondelete="SET NULL"), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    role_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="users")
    employee: Mapped[Optional["Employee"]] = relationship("Employee", back_populates="user", foreign_keys=[employee_id])
