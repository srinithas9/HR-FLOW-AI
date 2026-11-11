from app.db.base import Base

from app.models.organization import (
    Department,
    Role,
    Employee,
    User,
)

from app.models.lifecycle import (
    EmployeeLifecycle,
    OnboardingRecord,
    ProbationRecord,
    ConfirmationRecord,
    PerformanceReview,
    OffboardingRecord,
)

from app.models.workflow import (
    TaskTemplate,
    Task,
    TaskDependency,
    TaskStatusHistory,
    FollowUp,
    Notification,
    Escalation,
)

from app.models.compliance import (
    DocumentRequirement,
    EmployeeDocument,
)

from app.models.intelligence import (
    TaskSnapshot,
    MLPrediction,
    AIInsight,
    ActivityLog,
    AIRecommendation,
    AIRecommendationHistory,
    AIOperationalSummary,
)

__all__ = [
    "Base",
    # Organization (4)
    "Department",
    "Role",
    "Employee",
    "User",
    # Lifecycle (6)
    "EmployeeLifecycle",
    "OnboardingRecord",
    "ProbationRecord",
    "ConfirmationRecord",
    "PerformanceReview",
    "OffboardingRecord",
    # Workflow (7)
    "TaskTemplate",
    "Task",
    "TaskDependency",
    "TaskStatusHistory",
    "FollowUp",
    "Notification",
    "Escalation",
    # Compliance (2)
    "DocumentRequirement",
    "EmployeeDocument",
    # Intelligence (7)
    "TaskSnapshot",
    "MLPrediction",
    "AIInsight",
    "ActivityLog",
    "AIRecommendation",
    "AIRecommendationHistory",
    "AIOperationalSummary",
]
