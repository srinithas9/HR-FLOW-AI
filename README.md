# HR Flow – AI-Powered HR Operations & Action Intelligence Platform

HR Flow is an AI-powered HR operations platform designed to simplify employee lifecycle management, task tracking, follow-ups, and HR operations.

It combines **Machine Learning (ML)** and **Generative AI** to help HR teams monitor operational activities, identify potential task delays, retrieve HR information, and make better operational decisions through a centralized dashboard.

---

## 1. Project Overview

HR departments manage multiple activities throughout an employee's journey, including onboarding, documentation, probation, confirmation, performance reviews, and offboarding.

Managing these activities manually through spreadsheets, emails, and separate records can make it difficult to track deadlines, monitor pending tasks, identify delays, and determine which activities require immediate attention.

HR Flow addresses these challenges through a centralized platform that integrates employee lifecycle management, workflow tracking, predictive intelligence, HR analytics, and an AI-powered HR assistant.

The platform aims to transform traditional manual HR operations into a more organized, visible, and intelligent workflow management system.

---

## 2. Business Problems Identified

During the analysis of HR operational workflows, the following business problems were identified:

| No. | Business Problem | What HR Struggles With |
|---|---|---|
| 1 | Employee Lifecycle Tracking | Managing onboarding, probation, confirmation, documentation, performance reviews, and offboarding separately. |
| 2 | Pending Action Visibility | Identifying which HR activities are incomplete or still require attention. |
| 3 | Deadline Management | Tracking important dates and ensuring activities are completed on time. |
| 4 | Responsibility Tracking | Knowing who is responsible for completing each HR activity. |
| 5 | Follow-up Management | Remembering whom to contact when employees or managers haven't responded. |
| 6 | Delay Identification | Recognizing activities that are overdue or at risk of being delayed. |
| 7 | Operational Inefficiency | Managing multiple activities manually across spreadsheets, emails, and separate records. |
| 8 | Lack of Actionable Insights | Understanding what needs attention and deciding what HR should prioritize next. |

### How HR Flow Addresses These Problems

| Business Problem | HR Flow Solution |
|---|---|
| Employee Lifecycle Tracking | Centralized management of six employee lifecycle stages. |
| Pending Action Visibility | Dashboard and Action Center for monitoring incomplete activities. |
| Deadline Management | Task due dates, deadline tracking, and overdue status monitoring. |
| Responsibility Tracking | Task assignment and ownership tracking. |
| Follow-up Management | Follow-up scheduling and escalation management. |
| Delay Identification | ML-based task delay risk prediction. |
| Operational Inefficiency | Centralized HR operations and workflow management. |
| Lack of Actionable Insights | HR Analytics, operational insights, and AI HR Copilot. |

---

## 3. Key Features

### 3.1 Dashboard

Provides a centralized overview of employee information and HR operational activities.

- Displays employee and HR operational statistics.
- Provides visibility into pending activities.
- Highlights important items requiring attention.
- Displays employee lifecycle progress.
- Helps HR teams understand the overall operational status.

### 3.2 Employee Directory

Maintains centralized employee information.

- View employee records.
- Search and filter employees.
- Access individual employee profiles.
- View related HR information and lifecycle activities.

### 3.3 Employee Lifecycle Management

Manages six major stages of the employee journey:

1. **Onboarding:** Tracks activities involved in integrating new employees into the organization.
2. **Documentation:** Manages employee documents and documentation status.
3. **Probation:** Tracks probation periods and related activities.
4. **Confirmation:** Monitors employee confirmation processes.
5. **Performance Reviews:** Manages performance review activities and records.
6. **Offboarding:** Tracks employee exit activities and related formalities.

This centralized approach helps HR teams manage employee-related processes without maintaining separate tracking systems.

### 3.4 Task Management

Provides a structured system for managing HR operational activities.

- Create and assign HR tasks.
- Track task status and priority.
- Set and monitor deadlines.
- Manage task dependencies.
- Identify pending, blocked, and overdue activities.
- Monitor task ownership and completion.

### 3.5 Follow-ups and Escalations

Helps HR teams manage pending responses and delayed activities.

- Track pending responses from employees, managers, and external parties.
- Maintain follow-up schedules.
- Monitor follow-up status.
- Identify activities requiring additional attention.
- Escalate overdue tasks through defined responsibility levels.

### 3.6 Machine Learning Intelligence

Uses Machine Learning to estimate the probability of HR tasks becoming delayed.

- Identifies potentially high-risk tasks.
- Analyzes workload and historical delay patterns.
- Evaluates operational factors affecting task completion.
- Classifies tasks into low, medium, and high-risk categories.
- Supports proactive HR prioritization.

### 3.7 AI HR Copilot

An AI-powered conversational assistant that helps HR users retrieve operational information through natural-language questions.

- Answers HR operational queries.
- Retrieves employee and task information.
- Provides follow-up and escalation details.
- Generates operational summaries.
- Uses backend tools to retrieve relevant system records.
- Helps HR users access information without manually navigating multiple sections.

### 3.8 HR Analytics

Provides operational insights to help HR teams understand workflow performance.

Key analytical areas include:

- SLA compliance.
- Average task resolution time.
- Department workload.
- Operational bottlenecks.
- Employee-related statistics.
- Task completion and delay patterns.

---

## 4. Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Database Migrations | Alembic |
| Machine Learning | Scikit-learn, Pandas, NumPy |
| Model Storage | Joblib |
| Generative AI | Google Gemini 2.5 Flash |
| API Communication | REST APIs |
| Authentication | JWT, bcrypt |

---

## 5. Machine Learning Implementation

### Objective

The primary objective of the Machine Learning component is to predict the probability of HR tasks becoming delayed.

Instead of waiting until a task becomes overdue, the model estimates its potential delay risk so that HR teams can prioritize activities that may require attention.

### Algorithm

**Random Forest Classifier**

Random Forest is a supervised Machine Learning algorithm that combines multiple decision trees to make predictions.

### Probability Calibration

**Sigmoid (Platt) Calibration**

Probability calibration is used to adjust the predicted probabilities so that they better reflect observed outcome frequencies.

### Features Used

The model uses eight operational features:

1. Days remaining before the deadline.
2. Task category.
3. Task priority.
4. Current task status.
5. Reminder count.
6. Owner's historical delay rate.
7. Owner's current workload.
8. Task dependency status.

### Model Evaluation Results

The model was evaluated using a separate test dataset.

| Evaluation Metric | Test Result |
|---|---:|
| ROC-AUC | 0.5378 |
| PR-AUC | 0.1933 |
| Brier Score | 0.1442 |

### Risk Classification

The predicted probabilities are categorized into three operational risk levels:

| Risk Category | Probability |
|---|---|
| Low Risk | Below 12% |
| Medium Risk | 12% to below 22% |
| High Risk | 22% or above |

### Model Limitations

The current model is experimental.

The evaluation results indicate that its predictive performance requires further improvement, particularly in distinguishing delayed tasks from non-delayed tasks.

The model is intended to support HR prioritization rather than replace human decision-making. Further training, validation, and monitoring using real-world operational data are required before relying on its predictions for production decisions.

---

## 6. Generative AI Implementation

HR Flow includes an AI HR Copilot powered by **Google Gemini 2.5 Flash**.

The Copilot uses an OpenAI-compatible API integration and backend tools to retrieve relevant information from the HR system.

### How It Works

1. The user submits a question in natural language.
2. Gemini processes the query and identifies the required information.
3. The appropriate backend tool retrieves relevant HR records.
4. The LLM generates a response using the retrieved information.
5. Relevant record identifiers are included to support factual responses.

### Example Queries

Users can ask questions such as:

- Which HR tasks are currently overdue?
- Show employees whose probation period is ending soon.
- Which tasks are assigned to a particular employee or HR owner?
- What follow-ups are pending?
- Which tasks have been escalated?
- Summarize the current HR operational status.

### Fallback Mechanism

The application also includes an internal fallback mechanism for handling supported HR queries when the external LLM service is unavailable.

This helps maintain access to supported HR information even when the external AI service cannot be reached.

---

## 7. System Architecture

HR Flow follows a **Modular Monolithic Architecture**.

The application is organized into different functional modules within a single backend application.

### Architecture Overview

```text
                       HR USER
                          |
                          v
                 FRONTEND APPLICATION
                    HR Flow Dashboard
                          |
                          v
                  FASTAPI BACKEND
                  HR Operations Layer
                          |
              +-----------+-----------+
              |                       |
              v                       v
          DATABASE              AI & ML COMPONENTS
         PostgreSQL                    |
              |                +------+------+
              |                |             |
              v                v             v
       HR Operational       Machine       Generative
            Data            Learning         AI
                          Random Forest   Gemini 2.5
                          Delay Prediction HR Copilot
```

### Architecture Explanation

**Frontend Layer:**
- Developed using React, TypeScript, and Vite.
- Provides the user interface for HR operations.
- Communicates with the backend through REST APIs.

**Backend Layer:**
- Developed using Python and FastAPI.
- Handles business logic and HR workflows.
- Manages API requests, authentication, and data operations.
- Integrates database, ML, and AI components.

**Database Layer:**
- PostgreSQL stores employee information, operational tasks, lifecycle records, follow-ups, and other HR-related information.
- SQLAlchemy is used for database interactions.
- Alembic manages database migrations.

**Machine Learning Layer:**
- Uses a Random Forest model to estimate task delay probabilities.
- Provides operational risk classifications.

**Generative AI Layer:**
- Uses Gemini 2.5 Flash for natural-language HR assistance.
- Retrieves relevant information through backend tools.
- Generates contextual responses based on retrieved records.

---

## 8. Database Design

HR Flow uses **PostgreSQL** as its central relational database.

The documented database design contains 23 tables organized around the major functional areas of the application.

### Major Database Domains

| Domain | Purpose |
|---|---|
| Employee Management | Stores employee and user information. |
| Workflow and Action Center | Manages tasks, assignments, and dependencies. |
| Employee Lifecycle | Stores onboarding, documentation, probation, confirmation, performance review, and offboarding information. |
| Follow-ups and Escalations | Manages pending responses and escalation records. |
| Document Management | Maintains employee documentation records. |
| Performance Management | Stores performance review information. |
| Audit Management | Maintains audit-related records. |
| AI and ML Records | Supports AI/ML-related operational records. |

The relational database structure helps maintain consistency and relationships between employees, tasks, lifecycle activities, and operational records.

---

## 9. Installation and Setup

### Prerequisites

Install the following tools before setting up the project:

- Python 3.12 or compatible version.
- Node.js 20 or compatible version.
- PostgreSQL 17.
- Git.

### Step 1: Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
```

### Step 2: Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment.

**Windows:**

```bash
venv\Scripts\activate
```

**Linux / macOS:**

```bash
source venv/bin/activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables using the provided `.env.example` file.

Create the PostgreSQL database and configure its connection details.

Run database migrations:

```bash
alembic upgrade head
```

Start the backend using the application entry point configured in the project.

### Step 3: Frontend Setup

Open a separate terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

The frontend development server will start using the configured Vite development port.

### Step 4: Database Initialization

Use the database scripts provided in the repository to generate, validate, and load the synthetic HR dataset.

**Note:** Refer to the project configuration and setup scripts for the exact environment variables and database initialization commands.

---

## 10. Current Limitations

The current version is a functional prototype and has the following limitations:

1. **Synthetic Data:** The application currently uses synthetic employee and operational data rather than real organizational HR data.
2. **ML Performance:** The task delay prediction model requires further improvement and validation using real-world data.
3. **External Notifications:** Email and SMS notification integrations are not currently implemented.
4. **Single Organization:** The platform currently focuses on a single organizational environment.
5. **Predictive Reliability:** ML predictions are experimental and should be treated as decision-support indicators rather than definitive outcomes.

---

## 11. Future Enhancements

The following improvements can be considered for future development:

- Integration with email and messaging platforms for automated notifications.
- Improved ML performance through additional training data and model monitoring.
- Multi-organization and multi-tenant support.
- Enhanced HR analytics and reporting.
- Scalable background job processing.
- Advanced workflow automation.
- Improved predictive risk analysis.
- Integration with external HR and payroll systems.

---

## 12. Project Objective

The main objective of HR Flow is to transform traditional HR operational tracking into a centralized and intelligent workflow management system.

By integrating employee lifecycle management, task tracking, follow-ups, Machine Learning, Generative AI, and HR analytics, the platform aims to help HR teams:

- Manage employee-related activities efficiently.
- Maintain visibility into pending HR operations.
- Track responsibilities and deadlines.
- Identify potential operational delays.
- Reduce manual tracking efforts.
- Retrieve HR information through natural-language interactions.
- Make informed and proactive operational decisions.

---

## 13. Project Information

| Field | Details |
|---|---|
| Project Name | HR Flow |
| Project Title | AI-Powered HR Operations & Action Intelligence Platform |
| Project Category | Full-Stack Development, Machine Learning, Generative AI |
| Architecture | Modular Monolithic Architecture |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ML Algorithm | Random Forest Classifier |
| Generative AI | Google Gemini 2.5 Flash |
| Project Status | Functional Prototype |

---

**HR Flow – Making HR Operations More Visible, Organized, and Intelligent.**
