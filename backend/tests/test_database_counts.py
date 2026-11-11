import pytest
from sqlalchemy import text
from app.db.session import SessionLocal
import app.models as models


def test_twenty_six_tables_exist_and_populated():
    db = SessionLocal()
    try:
        # Check all 26 tables have records matching the approved Phase 6.2C 200-employee AuraTech dataset
        table_checks = [
            (models.Department, 12),
            (models.Role, 4),
            (models.Employee, 200),
            (models.User, 23),
            (models.EmployeeLifecycle, 800),
            (models.OnboardingRecord, 200),
            (models.ProbationRecord, 200),
            (models.ConfirmationRecord, 200),
            (models.PerformanceReview, 600),
            (models.OffboardingRecord, 14),
            (models.TaskTemplate, 25),
            (models.Task, 3300),
            (models.TaskDependency, 2500),
            (models.TaskStatusHistory, 9800),
            (models.DocumentRequirement, 12),
            (models.EmployeeDocument, 1200),
            (models.FollowUp, 480),
            (models.Notification, 3450),
            (models.Escalation, 360),
            (models.TaskSnapshot, 8350),
            (models.MLPrediction, 3300),
            (models.AIInsight, 200),
            (models.ActivityLog, 1000),
            (models.AIRecommendation, 300),
            (models.AIRecommendationHistory, 500),
            (models.AIOperationalSummary, 120),
        ]

        total_records = 0
        for model_cls, expected_count in table_checks:
            count = db.query(model_cls).count()
            assert count == expected_count, f"Table {model_cls.__tablename__} count mismatch: {count} != {expected_count}"
            total_records += count

        assert total_records == 37150
        assert total_records >= 10000
    finally:
        db.close()
