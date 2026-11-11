# MASTER PROJECT SPECIFICATION
## AI-Powered HR Operations & Action Intelligence Platform

> **Document Status**: Approved Master Specification (Permanent Source of Truth)  
> **Last Updated**: November 2026  
> **Scope Type**: Fixed-Scope Modular Monolith

---

## 1. Project Objective

The **AI-Powered HR Operations & Action Intelligence Platform** is an enterprise-grade operational management system tailored for an Indian technology organization. It bridges the gap between passive HR record-keeping and proactive, automated, action-oriented operations.

Key platform objectives:
1. **Centralize & Orchestrate Lifecycle Activities**: Seamlessly coordinate end-to-end employee lifecycle activities across onboarding, probation, confirmation, performance reviews, transfers/promotions, and offboarding.
2. **Prevent Operational Bottlenecks**: Actively monitor operational deadlines, SLA compliance, dependencies, and bottlenecks across multi-stakeholder workflows (employees, managers, IT, HR Ops, finance).
3. **ML-Powered Proactive Risk Mitigation**: Leverage an integrated Machine Learning model to forecast task delay risk before SLAs are breached, enabling early intervention.
4. **Database-Grounded GenAI Assistance**: Provide an intelligent GenAI HR Operations Assistant that queries verified system data to answer complex HR operational questions and draft contextual actions with required human approval.
5. **Full Operational Auditability**: Guarantee enterprise governance through comprehensive status histories, snapshot captures, auditable reassignments, and transparent human-in-the-loop controls.

---

## 2. Approved Functional Scope

### 2.1 The Exactly Seven Functional Modules

1. **Module 1: Employee Lifecycle Management**
   - Tracks employees across all 6 core lifecycle stages.
   - Manages stage transitions, milestones, target dates, and stage completion statuses.
   - Coordinates multi-departmental actions across IT assets, background verification (BGV), orientation, probation milestones, confirmation approvals, appraisal cycles, and exit handovers.

2. **Module 2: Operational Task & Workflow Engine**
   - Directs task creation, template-based generation, hierarchical assignment, and dependency enforcement.
   - Manages strict finish-to-start and start-to-start prerequisite chains preventing out-of-order execution.
   - Enforces business rules for status transitions, deadline adjustments with mandatory audit reasons, and ownership reassignments.

3. **Module 3: Document Compliance & Verification System**
   - Manages mandatory and optional document requirements per lifecycle stage.
   - Tracks employee document uploads, formats, validation timestamps, and verification workflows.
   - Handles multi-state verification (Pending Submission, Submitted, Verified, Rejected for Correction) with detailed reviewer feedback.

4. **Module 4: SLA, Reminders & Escalation Management**
   - Monitors due dates, approaching deadlines, and SLA breaches in real-time.
   - Dispatches contextual automated reminders and follow-up requests.
   - Implements multi-tiered escalation protocols (Level 1, Level 2, Level 3) alerting managers and HR leadership when tasks are blocked or overdue.

5. **Module 5: Task Delay Risk Prediction (ML Engine)**
   - Consumes historical task execution snapshots taken at standardized observation windows.
   - Evaluates risk features including workload pressure, historical delay patterns, remaining duration, dependency friction, and category priorities.
   - Produces risk probabilities and actionable risk tier classifications for active, non-overdue tasks.

6. **Module 6: Database-Grounded GenAI HR Operations Assistant**
   - Natural language interface grounded strictly in live database entities and operational states.
   - Answers queries regarding pending reviews, onboarding blockers, compliance gaps, and team workloads.
   - Formulates draft recommendations, notifications, and reminders.
   - Strictly enforces Human-in-the-Loop approval before executing any recommended action.

7. **Module 7: Operational Analytics & Action Intelligence**
   - Real-time operational dashboards delivering cross-departmental KPI visibility.
   - Visualizes cycle times, completion rates, bottleneck distributions, and overdue heatmaps across Indian tech delivery centers.
   - Provides drill-down audit logs and historical snapshots for compliance and process optimization.

---

## 3. Approved User Roles & Responsibilities

The system defines **exactly four** distinct user roles:

1. **HR Administrator (`HR_ADMIN`)**:
   - Master system configuration, role management, department governance, task template definitions, and compliance policy settings.
   - System-wide visibility across all delivery hubs, audit logs, and AI operational insights.
   - Authority to override workflows and reassign escalated operational tasks.

2. **HR Operations Specialist (`HR_OPERATIONS`)**:
   - Daily operational execution: managing onboarding batches, validating compliance documents, initiating probation reviews, and tracking offboarding clearance.
   - Reviews and acts upon ML task delay risk predictions and GenAI suggested operational actions.
   - Initiates manual and automated follow-ups and processes multi-tier escalations.

3. **People Manager / Technical Lead (`PEOPLE_MANAGER`)**:
   - Oversees direct reports across engineering and functional squads.
   - Responsible for technical onboarding task signoffs, probation evaluations, confirmation recommendations, and periodic performance reviews.
   - Receives targeted reminders, responds to escalations, and manages team-level knowledge transfer (KT) during offboarding.

4. **Employee (`EMPLOYEE`)**:
   - Self-service operational tasks: profile detail updates, mandatory document submissions, self-evaluation in performance reviews, asset acknowledgments, and exit clearances.
   - Real-time visibility into personal lifecycle stage milestones and pending assigned action items.

---

## 4. The Six Employee Lifecycle Areas

1. **Onboarding**:
   - Pre-joining document verification, IT asset allocation (laptops, peripherals, dev credentials), background verification (BGV), corporate orientation, buddy allocation, and Day-1 team introduction.
2. **Probation**:
   - Standard 3 to 6-month probation tracking, Day-30 check-in, Day-60 mid-probation review, formal 90-day evaluation, manager performance feedback, and probation extension handling.
3. **Confirmation**:
   - Formal confirmation assessment, People Manager recommendation, HR review, confirmation letter issuance, and transition to confirmed full-time employee status.
4. **Performance Review**:
   - Bi-annual appraisal cycles (e.g., FY24-H1, FY24-H2, FY25-H1, FY25-H2), employee self-assessment, manager technical review, performance rating normalization, and review finalization.
5. **Role Transition & Promotion (Internal Mobility)**:
   - Departmental transfers, technical promotion tracks (e.g., Software Engineer to Senior Software Engineer), role realignment, and updated reporting structures.
6. **Offboarding**:
   - Resignation submission, notice period calculation, handover & knowledge transfer (KT) completion, IT asset recovery, department clearances (Finance, Admin, HR), exit interview, and relieving letter issuance.

---

## 5. Indian Technology Company Context

- **Company Domain**: Enterprise Cloud, AI, and Software Engineering Solutions.
- **Delivery Hubs**: Bengaluru (HQ), Hyderabad, Pune, Chennai, Mumbai, Gurugram.
- **Calendar & Timezone**: Indian Standard Time (`IST` / `UTC+05:30`), Indian national holidays, and standard 5-day tech workweeks.
- **Workforce Distribution**:
  - ~80% Technical: Software Engineering, Quality Assurance, DevOps & Cloud Engineering, Data Engineering, AI/ML, Cybersecurity, IT Support, Product Management.
  - ~20% Functional/Management: Project Management, HR, Finance, Operations & Administration.
- **Realistic Designations**:
  - Technical: Software Engineer, Senior Software Engineer, Backend Developer, Frontend Developer, Full Stack Developer, Technical Lead, Engineering Manager, QA Engineer, Automation Test Engineer, DevOps Engineer, Cloud Engineer, Site Reliability Engineer, Platform Engineer, Data Engineer, Data Scientist, AI Engineer, ML Engineer, Cybersecurity Engineer, IT Support Engineer.
  - Functional: HR Business Partner, HR Operations Associate, Talent Acquisition Specialist, Financial Analyst, Payroll Specialist, Facilities Manager, Scrum Master, Technical Product Manager.

---

## 6. Exact 23-Table Database Design

The relational schema consists of **exactly 23 normalized tables**:

| # | Table Name | Category | Primary Function |
|---|---|---|---|
| 1 | `departments` | Organizational Hierarchy | Defines 12 technical and operational business units |
| 2 | `roles` | Access Control | The 4 approved platform roles with granular permissions |
| 3 | `users` | Identity & Access | Platform user accounts mapped to employees and roles |
| 4 | `employees` | Workforce Core | Core demographic, designation, manager hierarchy, and status |
| 5 | `employee_lifecycle` | Lifecycle Tracking | Master timeline of stages and transitions per employee |
| 6 | `onboarding_records` | Lifecycle Stage Detail | Onboarding-specific workflows, BGV, IT assets, buddy |
| 7 | `probation_records` | Lifecycle Stage Detail | Probation milestones, manager feedback, extensions |
| 8 | `confirmation_records` | Lifecycle Stage Detail | Formal confirmation approvals and letter issuance |
| 9 | `performance_reviews` | Lifecycle Stage Detail | Bi-annual appraisal cycles, ratings, self & manager reviews |
| 10 | `offboarding_records` | Lifecycle Stage Detail | Resignation, notice period, KT, asset return, clearances |
| 11 | `task_templates` | Workflow Configuration | Standard reusable task definitions by lifecycle stage |
| 12 | `tasks` | Workflow Core | Actionable task instances with priority, due date, owner |
| 13 | `task_dependencies` | Workflow Rules | Prerequisite task links preventing circular & invalid order |
| 14 | `task_status_history` | Audit & Compliance | Immutable timeline of task states, reassignments, due dates |
| 15 | `document_requirements` | Compliance Policy | Mandatory/optional document specifications per stage |
| 16 | `employee_documents` | Compliance Tracking | Uploaded document verification states and reviewer remarks |
| 17 | `follow_ups` | Operations SLA | Tracked reminders and follow-up interactions between users |
| 18 | `notifications` | User Communication | In-app alerts for assignments, deadlines, and breaches |
| 19 | `escalations` | SLA Governance | Multi-tiered escalation incidents with resolution tracking |
| 20 | `task_snapshots` | Machine Learning | Point-in-time state records of active tasks for ML |
| 21 | `ml_predictions` | Machine Learning | Model inference outputs, delay risks, and confidence scores |
| 22 | `ai_insights` | GenAI & Analytics | Grounded AI recommendations requiring human approval |
| 23 | `activity_logs` | Platform Governance | Audit log of all operational mutations and system actions |

---

## 7. Technology Stack & Architecture

- **Architecture Style**: Modular Monolith. Strictly clean internal boundaries, single deployable unit, shared relational database.
- **Frontend**:
  - React 18 / 19 with TypeScript
  - Vite build toolchain
  - Tailwind CSS + shadcn/ui component library
  - Lucide React iconography
  - Framer Motion animation framework
  - Recharts data visualization
  - Axios HTTP client
- **Backend**:
  - Python 3.12+
  - FastAPI framework
  - SQLAlchemy 2.x ORM (typed mappings, modern select syntax)
  - Pydantic 2.x data validation & settings management
  - Alembic database migration management
  - psycopg v3 database driver
- **Database**:
  - PostgreSQL 17 on `localhost:5432` (`hr_operations_db`)
- **Machine Learning**:
  - Scikit-learn, Pandas, NumPy

---

## 8. Machine Learning: Task Delay Risk Prediction

- **Single ML Model**: Task Delay Risk Prediction.
- **Objective**: Predict whether an active, non-overdue task will exceed its due date before completion.
- **Target Variable**: `task_overdue` (Binary: `1` = Overdue, `0` = On-time / Non-overdue).
- **Leakage Prevention**:
  - Strict temporal cutoffs: Features calculated strictly using data timestamped on or before the snapshot instant.
  - Zero target or post-outcome leakage (no completion timestamps, post-snapshot reminders, or subsequent reassignments included in features).
  - Group-aware splitting: Split by task ID / time block to ensure snapshot windows from the same task do not cross train/test partitions.
- **Input Features**:
  1. `task_category` (Categorical)
  2. `days_remaining` (Integer, relative to due date)
  3. `current_status` (Categorical)
  4. `reminder_count` (Integer, reminders sent prior to snapshot)
  5. `owner_previous_delay_rate` (Float, historical owner completion performance)
  6. `owner_current_workload` (Integer, active open tasks assigned to owner at snapshot)
  7. `dependency_status` (Categorical: `NONE`, `ALL_RESOLVED`, `BLOCKED`)
  8. `task_priority` (Categorical: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)

---

## 9. Database-Grounded GenAI HR Assistant

- **Core Tenet**: Zero hallucination, 100% grounded in relational database facts.
- **Workflow**:
  1. Natural language query from HR Operations or Admin.
  2. Structured retrieval against PostgreSQL database via read-only repository views.
  3. Synthesized operational summary with supporting entity references.
  4. Suggested draft action (e.g., send follow-up, reassign bottleneck, trigger escalation).
  5. **Human Approval Gate**: Action remains in `PENDING_REVIEW` until an authorized user explicitly approves, edits, or rejects the operation.

---

## 10. Explicit Project Exclusions

To preserve strict scope boundaries, the following domains are **explicitly excluded**:
1. Applicant Tracking / Recruitment / Resume Parsing.
2. Payroll calculation, tax withholding, and salary disbursement.
3. Biometric attendance and shift scheduling.
4. Autonomous unreviewed AI actions.
5. Microservices infrastructure, Kubernetes orchestrations, or multi-database polyglot storage.

---

## 11. Multi-Phase Development Roadmap

- **Phase 0 (Current)**: Project Foundation, Relational Architecture, 23 PostgreSQL Tables, Synthetic Data Generation & Loading, ML-Ready Snapshot Dataset, Verification.
- **Phase 1**: Core Backend Engineering, RESTful Domain APIs, Authentication & RBAC, Lifecycle State Handlers, Workflow Validation.
- **Phase 2**: Frontend Web Application, Design System, Executive Dashboards, Lifecycle Visualizers, Interactive Task Board.
- **Phase 3**: Machine Learning Pipeline, Delay Risk Model Training, Model Evaluation, Model Serialization, Live Inference Service.
- **Phase 4**: Database-Grounded GenAI HR Operations Assistant, Human-in-the-Loop Action Framework, Final System Integration & E2E Verification.

