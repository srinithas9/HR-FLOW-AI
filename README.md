# AI-Powered HR Operations & Action Intelligence Platform

An enterprise-grade operational management and action intelligence platform designed for an Indian technology organization. The platform orchestrates employee lifecycle activities, monitors SLAs and deadlines, forecasts task delays using machine learning, and provides a database-grounded GenAI assistant with human-in-the-loop approvals.

---

## 1. System Architecture & Scope

- **Architecture Style**: Modular Monolith.
- **Scope**:
  - Exactly 7 Functional Modules.
  - Exactly 4 User Roles (`HR_ADMIN`, `HR_OPERATIONS`, `PEOPLE_MANAGER`, `EMPLOYEE`).
  - Exactly 6 Lifecycle Areas (Onboarding, Probation, Confirmation, Performance Review, Role Transition, Offboarding).
  - Exactly 23 PostgreSQL Tables.
  - One ML Model: Task Delay Risk Prediction.
  - One GenAI HR Operations Assistant.

---

## 2. Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide React, Framer Motion, Recharts, Axios.
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.x, Pydantic 2.x, Alembic, psycopg v3.
- **Database**: PostgreSQL 17 on `localhost:5432` (`hr_operations_db`).
- **Machine Learning**: Scikit-learn, Pandas, NumPy.

---

## 3. Directory Layout

```
hr-operations-platform/
├── frontend/                     # Frontend web application foundation
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── utils/
│
├── backend/                      # FastAPI modular monolith service
│   ├── app/
│   │   ├── api/                  # Endpoints (Health, Auth, Lifecycle, Tasks, etc.)
│   │   ├── core/                 # Config, settings, security
│   │   ├── db/                   # Engine, session factory, base
│   │   ├── models/               # 23 SQLAlchemy 2.x ORM models
│   │   ├── schemas/              # Pydantic v2 schemas
│   │   ├── services/             # Business services
│   │   └── utils/                # Helper functions
│   ├── alembic/                  # Database migration revisions
│   ├── tests/                    # Backend unit & integration test suites
│   ├── requirements.txt          # Python dependencies
│   ├── alembic.ini               # Alembic configuration
│   └── pytest.ini                # Pytest configuration
│
├── database/
│   ├── schema_documentation/     # DATABASE_DESIGN.md (full column-level docs)
│   ├── sql/                      # schema.sql (PostgreSQL DDL schema dump)
│   └── seed_scripts/             # Generation, validation, and loading scripts
│
├── datasets/
│   ├── csv/                      # 23 normalized CSV files
│   ├── ml_ready/                 # ML-ready task delay prediction dataset
│   ├── data_dictionary/          # Relational and ML feature dictionaries
│   └── validation_reports/       # Integrity validation reports
│
├── ml/
│   └── datasets/                 # ML datasets copy
│
├── docs/                         # Architecture documentation
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git exclusions
├── PROJECT_SPEC.md               # Master permanent specification
└── README.md                     # Project overview and runbook
```

---

## 4. Phase 0 Verification & Runbook

### Prerequisites
- Python 3.12+
- PostgreSQL 17 running on `localhost:5432` with database `hr_operations_db`

### Setup Python Environment
```bash
python -m venv backend/.venv
backend/.venv/Scripts/pip install -r backend/requirements.txt
```

### Apply Database Migrations (23 Tables)
```bash
cd backend
.venv/Scripts/alembic upgrade head
cd ..
```

### Generate, Validate & Load Synthetic Data
```bash
# 1. Generate 360 employees, 24+ months of operations, 65,000+ relational rows
backend/.venv/Scripts/python.exe database/seed_scripts/generate_synthetic_data.py

# 2. Execute automated 10-point integrity validation
backend/.venv/Scripts/python.exe database/seed_scripts/validate_synthetic_data.py

# 3. Load all 23 datasets into PostgreSQL in dependency order
backend/.venv/Scripts/python.exe database/seed_scripts/load_synthetic_data.py
```

### Run Backend Tests & Health Check
```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_health.py -v
```

### Start Backend Development Server
```bash
cd backend
.venv/Scripts/uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
```

Endpoints available:
- Swagger Documentation: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- Database Health Check: `http://localhost:8000/health/db`



Role	Email	Password	Access Scope
HR Admin (ADMIN)	neha.saxena@auratech.in	Password@123	System settings, user management, full access
HR Operations (HR_EXECUTIVE)	kavita.iyer@auratech.in	Password@123	Lifecycle ops (Onboarding, Probation, Offboarding)
HR Manager (HR_MANAGER)	rajesh.venkat@auratech.in	Password@123	Org-wide oversight, performance reviews, escalations
Reporting Manager (REPORTING_MANAGER)	vikram.malhotra@auratech.in	Password@123	Scoped to direct/indirect team members and approvals
3. Verification of Features & Data Fetching