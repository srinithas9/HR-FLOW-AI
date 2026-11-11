#!/usr/bin/env python3
"""
Database Loader for HR Operations & Action Intelligence Platform.
Loads all 23 validated CSV files into PostgreSQL in strict foreign-key dependency order.
Synchronizes PostgreSQL sequences and queries actual database row counts for verification.
"""

import sys
import csv
import json
from pathlib import Path
from sqlalchemy import create_engine, text

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from app.core.config import settings

CSV_DIR = BASE_DIR / "datasets" / "csv"

# Loading order: Parent tables first, followed by child dependent tables
TABLE_ORDER = [
    ("roles", "roles.csv"),
    ("departments", "departments.csv"),
    ("employees", "employees.csv"),
    ("users", "users.csv"),
    ("employee_lifecycle", "employee_lifecycle.csv"),
    ("onboarding_records", "onboarding_records.csv"),
    ("probation_records", "probation_records.csv"),
    ("confirmation_records", "confirmation_records.csv"),
    ("performance_reviews", "performance_reviews.csv"),
    ("offboarding_records", "offboarding_records.csv"),
    ("task_templates", "task_templates.csv"),
    ("tasks", "tasks.csv"),
    ("task_dependencies", "task_dependencies.csv"),
    ("task_status_history", "task_status_history.csv"),
    ("document_requirements", "document_requirements.csv"),
    ("employee_documents", "employee_documents.csv"),
    ("follow_ups", "follow_ups.csv"),
    ("notifications", "notifications.csv"),
    ("escalations", "escalations.csv"),
    ("task_snapshots", "task_snapshots.csv"),
    ("ml_predictions", "ml_predictions.csv"),
    ("ai_insights", "ai_insights.csv"),
    ("activity_logs", "activity_logs.csv"),
]


def clean_val(val: str, col_name: str):
    """Normalize empty string to None for NULL database insertion, and parse booleans/json."""
    if val == "" or val is None:
        return None
    if str(val).lower() == "true":
        return True
    if str(val).lower() == "false":
        return False
    if col_name in ["supporting_data", "details"]:
        if isinstance(val, dict):
            return json.dumps(val)
        return val if val else "{}"
    return val


def load_database():
    print("=" * 70)
    print("Loading 23 CSV Datasets into PostgreSQL Database...")
    print(f"Target DB URL: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    print("=" * 70)

    engine = create_engine(settings.sync_database_url)

    # Step 1: Truncate existing tables in reverse order for idempotency
    print("Truncating existing tables in reverse order for clean reload...")
    with engine.begin() as conn:
        for tbl, _ in reversed(TABLE_ORDER):
            conn.execute(text(f"TRUNCATE TABLE {tbl} CASCADE;"))

    # Step 2: Load tables in forward dependency order
    print("\nLoading tables in dependency order...")
    for tbl_name, csv_filename in TABLE_ORDER:
        csv_path = CSV_DIR / csv_filename
        if not csv_path.exists():
            raise FileNotFoundError(f"Missing required CSV: {csv_path}")

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        if not rows:
            print(f"  - {tbl_name:<25}: 0 rows to load")
            continue

        # Special case for departments: head_of_department_id can be updated after employees are loaded
        dept_heads = {}
        if tbl_name == "departments":
            for r in rows:
                if r.get("head_of_department_id"):
                    dept_heads[r["id"]] = r["head_of_department_id"]
                    r["head_of_department_id"] = None

        cols = list(rows[0].keys())
        col_names_str = ", ".join(cols)
        placeholders_str = ", ".join([f":{c}" for c in cols])
        insert_stmt = text(f"INSERT INTO {tbl_name} ({col_names_str}) VALUES ({placeholders_str})")

        # Batch clean and insert
        cleaned_rows = []
        for r in rows:
            cleaned_rows.append({col: clean_val(r[col], col) for col in cols})

        # Execute insert in transaction batches of 1,000
        batch_size = 1000
        with engine.begin() as conn:
            for i in range(0, len(cleaned_rows), batch_size):
                batch = cleaned_rows[i:i + batch_size]
                conn.execute(insert_stmt, batch)

            # Sync postgres primary key sequence
            conn.execute(text(f"""
                SELECT setval(
                    pg_get_serial_sequence('{tbl_name}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {tbl_name}), 1),
                    true
                );
            """))

        print(f"  [LOADED] {tbl_name:<25}: {len(cleaned_rows):>6} rows")

    # Now link department heads after employees are loaded
    dept_csv_path = CSV_DIR / "departments.csv"
    with open(dept_csv_path, "r", encoding="utf-8") as f:
        dept_rows = list(csv.DictReader(f))

    with engine.begin() as conn:
        for r in dept_rows:
            if r.get("head_of_department_id"):
                conn.execute(
                    text("UPDATE departments SET head_of_department_id = :hid WHERE id = :did"),
                    {"hid": int(r["head_of_department_id"]), "did": int(r["id"])},
                )

    # Step 3: Query Database directly to verify actual inserted row counts
    print("\n" + "=" * 70)
    print("VERIFYING ACTUAL ROW COUNTS IN POSTGRESQL...")
    print("=" * 70)

    total_db_records = 0
    db_counts = {}
    with engine.connect() as conn:
        for tbl_name, _ in TABLE_ORDER:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {tbl_name};")).scalar()
            db_counts[tbl_name] = result
            total_db_records += result
            print(f"  - {tbl_name:<25}: {result:>6} records in database")

    print("-" * 70)
    print(f"TOTAL CONFIRMED DATABASE RECORDS: {total_db_records:,}")
    print("=" * 70)

    return db_counts, total_db_records


if __name__ == "__main__":
    db_counts, total = load_database()
