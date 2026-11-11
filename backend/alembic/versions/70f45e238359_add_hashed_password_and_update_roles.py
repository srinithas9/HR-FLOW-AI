"""add_hashed_password_and_update_roles

Revision ID: 70f45e238359
Revises: bfca747c664b
Create Date: 2026-11-08 12:56:00

Justification:
1. Adds `hashed_password` column to `users` table to enable secure bcrypt-hashed credentials for JWT authentication.
2. Updates `roles` table to match the 4 approved Phase 1 business roles: ADMIN, HR_EXECUTIVE, REPORTING_MANAGER, HR_MANAGER.
3. Sets default bcrypt-hashed password for existing Phase 0 users so all accounts can authenticate cleanly.
4. Preserves 100% of existing relational database records without truncation or deletion.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '70f45e238359'
down_revision: Union[str, None] = 'bfca747c664b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_HASH = "$2b$10$9D4PsCiKk6o.hbY6Mbgv9uSSakcvXEtIZs2KIOwAsiEMWqZp15MP6"  # bcrypt hash for 'Password@123'


def upgrade() -> None:
    # Step 1: Add hashed_password column (nullable first to allow backfill)
    op.add_column('users', sa.Column('hashed_password', sa.String(length=255), nullable=True))

    # Step 2: Backfill existing users with secure default hash
    op.execute(f"UPDATE users SET hashed_password = '{DEFAULT_HASH}' WHERE hashed_password IS NULL;")

    # Step 3: Enforce NOT NULL constraint
    op.alter_column('users', 'hashed_password', nullable=False)

    # Step 4: Re-align role codes in roles table to the 4 approved Phase 1 roles
    op.execute("""
        UPDATE roles 
        SET role_code = 'ADMIN', 
            role_name = 'Admin', 
            description = 'System and HR Administrator with user management and configuration rights' 
        WHERE id = 1;
    """)
    op.execute("""
        UPDATE roles 
        SET role_code = 'HR_EXECUTIVE', 
            role_name = 'HR Executive', 
            description = 'HR Operations Specialist with employee record management permissions' 
        WHERE id = 2;
    """)
    op.execute("""
        UPDATE roles 
        SET role_code = 'REPORTING_MANAGER', 
            role_name = 'Reporting Manager', 
            description = 'People Manager with reporting-scope employee access and team approvals' 
        WHERE id = 3;
    """)
    op.execute("""
        UPDATE roles 
        SET role_code = 'HR_MANAGER', 
            role_name = 'HR Manager', 
            description = 'HR Manager with organization-wide HR operations and management permissions' 
        WHERE id = 4;
    """)

    # Step 5: Assign users who are senior HR business partners to role_id=4 (HR_MANAGER),
    # and map individual contributors from former role 4 to role_id=3 (REPORTING_MANAGER with 0 direct reports)
    # First, move former role 4 users to role 3
    op.execute("UPDATE users SET role_id = 3 WHERE role_id = 4;")
    # Next, assign select senior HR Specialists / Business Partners to role 4 (HR_MANAGER)
    op.execute("UPDATE users SET role_id = 4 WHERE id IN (97, 101, 104, 109, 110, 111);")


def downgrade() -> None:
    # Restore original roles
    op.execute("UPDATE users SET role_id = 2 WHERE role_id = 4;")
    op.execute("""
        UPDATE roles SET role_code = 'HR_ADMIN', role_name = 'HR Administrator' WHERE id = 1;
        UPDATE roles SET role_code = 'HR_OPERATIONS', role_name = 'HR Operations Specialist' WHERE id = 2;
        UPDATE roles SET role_code = 'PEOPLE_MANAGER', role_name = 'People Manager / Technical Lead' WHERE id = 3;
        UPDATE roles SET role_code = 'EMPLOYEE', role_name = 'Employee' WHERE id = 4;
    """)
    op.drop_column('users', 'hashed_password')
