# Datasets Directory: HR Operations Platform

This directory contains the synthetic relational datasets and ML-ready features generated for the **AI-Powered HR Operations & Action Intelligence Platform**.

## Folder Layout

```
datasets/
├── csv/                   # 23 normalized relational CSV files corresponding to PostgreSQL tables
├── ml_ready/              # ML-ready snapshot dataset for Task Delay Risk Prediction
├── data_dictionary/       # Schema definitions and feature dictionaries
│   ├── data_dictionary.md
│   └── ml_feature_dictionary.md
└── validation_reports/    # Automated integrity validation reports
    └── validation_report.md
```

## Quick Reference Summary

- **Total Normalized Database Tables**: 23 tables
- **Total Relational Rows Generated**: 65,098 rows
- **Employee Population**: 360 employees across 12 tech and operational departments
- **Historical Coverage**: 24+ months (Nov 2024 to Nov 2026)
- **ML-Ready Snapshots**: 15,414 eligible snapshot rows with binary target `task_overdue`
- **Integrity Validation**: 100% passed across all 10 consistency checks

## How to Regenerate and Reload

From the project root:

```bash
# 1. Regenerate synthetic CSVs and ML dataset
backend/.venv/Scripts/python.exe database/seed_scripts/generate_synthetic_data.py

# 2. Run automated validation suite
backend/.venv/Scripts/python.exe database/seed_scripts/validate_synthetic_data.py

# 3. Load data into PostgreSQL in dependency order
backend/.venv/Scripts/python.exe database/seed_scripts/load_synthetic_data.py
```

