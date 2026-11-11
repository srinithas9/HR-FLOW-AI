# DATASET VALIDATION REPORT
**Execution Date**: 2026-11-08 12:27:39 IST  
**Target Database**: `hr_operations_db` (PostgreSQL 17)  

---
## Validation Results Summary

| Check | Status | Details |
|---|---|---|
| **Check 1: CSV File Existence** | `PASSED` | All 23 normalized CSV files + 1 ML-ready dataset exist. |
| **Check 2: Primary Key Uniqueness** | `PASSED` | All 23 tables have 100% unique primary keys. |
| **Check 3: Foreign Key Relationships** | `PASSED` | All foreign key constraints verified with zero dangling references. |
| **Check 4: Required Fields Integrity** | `PASSED` | All mandatory business fields populated. |
| **Check 5: Chronological Date Consistency** | `PASSED` | Start dates, due dates, and creation dates chronologically aligned. |
| **Check 6: Status Domain Integrity** | `PASSED` | All lifecycle and task status values match approved enums. |
| **Check 7: Completed Task Timestamps** | `PASSED` | All completed tasks possess valid completion timestamps; no uncompleted tasks have completion timestamps. |
| **Check 8: Dependency Rules** | `PASSED` | No self-dependencies; all prerequisites reference distinct tasks. |
| **Check 9: Employee Hierarchy Integrity** | `PASSED` | Reporting structure verified; no self-reporting relationships. |
| **Check 10: ML Snapshot Leakage Prevention** | `PASSED` | All 15,414 ML snapshots represent strictly non-overdue points without target or future leakage. |

## Table Row Counts

| Table Name | Row Count | Status |
|---|---|---|
| `departments.csv` | 12 | `VALID` |
| `roles.csv` | 4 | `VALID` |
| `users.csv` | 115 | `VALID` |
| `employees.csv` | 360 | `VALID` |
| `employee_lifecycle.csv` | 1,096 | `VALID` |
| `onboarding_records.csv` | 360 | `VALID` |
| `probation_records.csv` | 360 | `VALID` |
| `confirmation_records.csv` | 352 | `VALID` |
| `performance_reviews.csv` | 1,131 | `VALID` |
| `offboarding_records.csv` | 24 | `VALID` |
| `task_templates.csv` | 20 | `VALID` |
| `tasks.csv` | 5,982 | `VALID` |
| `task_dependencies.csv` | 4,542 | `VALID` |
| `task_status_history.csv` | 17,479 | `VALID` |
| `document_requirements.csv` | 12 | `VALID` |
| `employee_documents.csv` | 2,160 | `VALID` |
| `follow_ups.csv` | 733 | `VALID` |
| `notifications.csv` | 5,982 | `VALID` |
| `escalations.csv` | 733 | `VALID` |
| `task_snapshots.csv` | 15,414 | `VALID` |
| `ml_predictions.csv` | 1,895 | `VALID` |
| `ai_insights.csv` | 350 | `VALID` |
| `activity_logs.csv` | 5,982 | `VALID` |
| **TOTAL RELATIONAL ROWS** | **65,098** | `SURPASSES MINIMUM 10,000` |
| **ML-READY DATASET ROWS** | **15,414** | `SURPASSES TARGET 10,000` |