# HR Flow – AI-Powered HR Operations & Action Intelligence Platform

HR Flow is an AI-powered HR operations platform designed to simplify employee lifecycle management, task tracking, follow-ups and HR operations.

It brings together Machine Learning and Generative AI to help HR teams monitor activities, identify potential task delays, retrieve HR information and make better operational decisions through a centralized dashboard.

---

## Project Overview

HR departments manage multiple activities throughout an employee's journey, including onboarding, documentation, probation, confirmation, performance reviews and offboarding.

Managing these activities manually through spreadsheets and emails can make it difficult to track deadlines, monitor pending tasks and identify operational delays.

HR Flow addresses these challenges through a centralized platform that combines employee management, workflow tracking, predictive intelligence and an AI-powered HR assistant.

## Key Features

### 1. Dashboard
- Provides an overview of employee and HR operational statistics.
- Displays pending activities and important items requiring attention.
- Provides visibility into employee lifecycle progress.

### 2. Employee Directory
- Centralized employee information.
- Employee search and filtering.
- Individual employee profiles and related HR information.

### 3. Employee Lifecycle Management
Manages six major stages of the employee journey:

- Onboarding
- Documentation
- Probation
- Confirmation
- Performance Reviews
- Offboarding

### 4. Task Management
- Create and assign HR operational tasks.
- Track task status, priority and deadlines.
- Manage task dependencies.
- Monitor pending, blocked and overdue activities.

### 5. Follow-ups and Escalations
- Track pending responses from employees, managers and external parties.
- Manage follow-up schedules.
- Escalate overdue tasks through defined responsibility levels.

### 6. ML Intelligence
Uses Machine Learning to estimate the probability of HR tasks becoming delayed.

- Identifies potentially high-risk tasks.
- Analyses workload and historical delay patterns.
- Classifies tasks into low, medium and high-risk categories.

### 7. AI HR Copilot
An AI-powered conversational assistant that helps users retrieve HR-related information using natural-language questions.

- Answers HR operational queries.
- Retrieves employee and task information.
- Provides follow-up and escalation details.
- Generates operational summaries.
- Uses backend tools to retrieve relevant system records.

### 8. HR Analytics
Provides operational insights such as:
- SLA compliance.
- Average task resolution time.
- Department workload.
- Operational bottlenecks.
- Employee-related statistics.

---

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Machine Learning | Scikit-learn, Pandas, NumPy |
| Model Storage | Joblib |
| Generative AI | Google Gemini 2.5 Flash |
| API Communication | REST APIs |
| Authentication | JWT, bcrypt |

---

## Machine Learning Implementation

**Objective:** Predict the probability of HR tasks becoming delayed.

**Algorithm:** Random Forest Classifier

**Probability Calibration:** Sigmoid (Platt) Calibration

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

The model currently provides an experimental task-risk assessment to support HR prioritization. Its predictive performance requires further improvement and validation using real-world operational data.

**Risk Categories:**

- Low Risk: Below 12%.
- Medium Risk: 12% to below 22%.
- High Risk: 22% or above.

---

## Generative AI Implementation

HR Flow includes an AI HR Copilot powered by **Google Gemini 2.5 Flash**.

The Copilot uses an OpenAI-compatible API integration and backend tools to retrieve relevant information from the HR system.

### How It Works

1. The user submits a question in natural language.
2. Gemini processes the query and identifies the required information.
3. The appropriate backend tool retrieves relevant HR records.
4. The LLM generates a response using the retrieved information.
5. Relevant record identifiers are included to support factual responses.

The application also includes an internal fallback mechanism for handling supported HR queries when the external LLM service is unavailable.

---

## System Architecture

HR Flow follows a **Modular Monolithic Architecture**.

```text
                    HR
                     |
                     v
              FRONTEND
             HR Flow Dashboard
                     |
                     v
                 BACKEND
              HR Operations
                     |
          +----------+----------+
          |                     |
          v                     v
       DATABASE          AI & ML COMPONENTS
      PostgreSQL          |              |
                          v              v
                    Machine Learning  Generative AI
                    Random Forest     Gemini 2.5 Flash
                    Delay Prediction  HR Copilot
          |
          v
     HR Operational Data
```

The frontend communicates with the FastAPI backend through REST APIs. The backend manages HR workflows and interacts with PostgreSQL to store and retrieve information. The ML model provides task-delay predictions, while the AI Copilot uses Gemini and backend tools to answer HR-related queries.

---

## Database

PostgreSQL is used as the central relational database.

The documented database design contains 23 tables covering:

- Employee and user information.
- Tasks and task dependencies.
- Employee lifecycle records.
- Follow-ups and escalations.
- Documents and performance reviews.
- Audit logs and AI/ML records.

---

## Installation and Setup

### Prerequisites

- Python 3.12 or compatible version.
- Node.js 20 or compatible version.
- PostgreSQL 17.
- Git.

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
```

### 2. Backend Setup

```bash
cd backend

python -m venv venv
```

Activate the virtual environment:

**Windows:**
```bash
venv\Scripts\activate
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

Install dependencies:

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

### 3. Frontend Setup

Open a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will start using the configured Vite development port.

### 4. Database Initialization

Use the database scripts provided in the repository to generate, validate and load the synthetic HR dataset.

**Note:** Refer to the project configuration and setup scripts for the exact environment variables and database initialization commands.

---

## Current Limitations and Future Enhancements

### Current Limitations
- The application currently uses synthetic employee and operational data.
- ML predictions require further improvement and real-world validation.
- External email and SMS notification integrations are not currently implemented.
- The platform currently focuses on a single organizational environment.

### Future Enhancements
- Email and messaging integrations for automated notifications.
- Improved ML performance through additional training data and model monitoring.
- Multi-organization support.
- Enhanced analytics and reporting.
- Scalable background job processing.

---

## Project Objective

The main objective of HR Flow is to transform traditional HR operational tracking into a centralized and intelligent workflow management system.

By integrating employee lifecycle management, task tracking, Machine Learning and Generative AI, the platform aims to help HR teams manage operations more efficiently, identify potential delays and make informed decisions.

---

**Project:** HR Flow – AI-Powered HR Operations & Action Intelligence Platform

**Category:** Full-Stack Development | Machine Learning | Generative AI

**Status:** Functional Prototype
