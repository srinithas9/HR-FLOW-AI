# PHASE 2 FRONTEND FOUNDATION & ENTERPRISE DESIGN SYSTEM

> **Platform**: AI-Powered HR Operations & Action Intelligence Platform  
> **Status**: Completed, Audited & Verified  
> **Technology Stack**: React 19, TypeScript 5.7, Vite 6.4, Tailwind CSS 3.4, shadcn/ui components, Lucide React, Framer Motion, Recharts, Axios, React Router 7, Vitest

---

## 1. Overview & Architecture

Phase 2 establishes the complete frontend application foundation and enterprise design system. It connects directly to the live FastAPI backend (`http://localhost:8000`) and PostgreSQL 17 database without introducing mocks, fake business logic, or data mutations.

Key deliverables:
1. **Centralized Enterprise Design Tokens**: Consistent visual hierarchy with deep navy brand (`#17365D`), vibrant blue action (`#2563EB`), neutral background (`#F5F7FB`), white surface cards, and restrained shadows.
2. **Unified Application Shell**: Fixed 250px left sidebar navigation, 64px sticky header with user avatar and profile dropdown, and flexible responsive content container with mobile off-canvas drawer.
3. **Enterprise Login Experience**: Connected to `POST /api/v1/auth/login`, including field validation, password show/hide toggle, loading indicators, error banner alerts, and redirect handling.
4. **Session Management & State Rehydration**: Reusable `AuthContext` with automatic Bearer token injection, session rehydration via `GET /api/v1/auth/me`, and global 401 interception.
5. **Role-Aware Navigation & Route Guards**: Enforcing access across all 4 platform roles (`ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, `REPORTING_MANAGER`) with dynamic sidebar filtering and `<ProtectedRoute>` guards.
6. **Reusable Component Library**: CVA-based Button variants, Input with icon slots, status Badges with dot indicators, Alert banners, accessible Modal/Dialog, KPI cards, paginated Table wrappers, Select dropdowns, and pulse Skeletons.
7. **Seven Module Placeholders**: Clean, lightweight placeholders for all 7 approved platform modules without fabricated data or charts.
8. **Automated Test Suite**: 16 unit tests across 5 test suites using Vitest and React Testing Library, plus end-to-end integration verification (`scripts/verify_phase2.py`).

---

## 2. Design System Color Tokens

| Token Name | Hex Code | Visual Semantic | Usage |
|---|---|---|---|
| `--brand-primary` | `#17365D` | Deep Navy | Application shell sidebar, primary titles, brand headers |
| `--action-primary` | `#2563EB` | Royal Blue | Primary interactive buttons, active navigation, focus rings |
| `--app-bg` | `#F5F7FB` | Soft Slate | Global page background |
| `--surface-card` | `#FFFFFF` | Pure White | Elevated cards, tables, modal content areas |
| `--text-primary` | `#172B4D` | Deep Slate | High-contrast primary text, headings, body text |
| `--text-secondary` | `#64748B` | Muted Slate | Subtitles, field labels, metadata timestamps |
| `--border-color` | `#E2E8F0` | Subtle Border | Container borders, table dividers, form field outlines |
| `--status-success` | `#16A34A` | Emerald Green | Completed status, active accounts, positive trends |
| `--status-warning` | `#D97706` | Amber | Pending reviews, approaching deadlines, probation notices |
| `--status-danger` | `#DC2626` | Ruby Red | SLA breaches, error alerts, rejected submissions |
| `--status-info` | `#0284C7` | Ocean Blue | General informational notifications, badge tags |

---

## 3. Approved Module Navigation & Role Permissions

| # | Module Name | Route | Allowed Roles | Description |
|---|---|---|---|---|
| 1 | Operations Dashboard | `/dashboard` | `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, `REPORTING_MANAGER` | Real-time operational visibility and key workforce metrics |
| 2 | Employees | `/employees` | `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, `REPORTING_MANAGER` | Workforce records, designations, and reporting hierarchy |
| 3 | Employee Lifecycle | `/lifecycle` | `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE` | Onboarding, probation, appraisals, and offboarding |
| 4 | HR Action Center | `/action-center` | `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, `REPORTING_MANAGER` | Operational tasks, prerequisite dependencies, approvals |
| 5 | Follow-ups & Reminders | `/follow-ups` | `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, `REPORTING_MANAGER` | SLA tracking, automated reminders, and escalations |
| 6 | HR Analytics | `/analytics` | `ADMIN`, `HR_MANAGER` | Departmental cycle times, bottlenecks, and velocity |
| 7 | AI Intelligence | `/ai-intelligence` | `ADMIN`, `HR_MANAGER` | ML task delay risk predictions and GenAI recommendations |

---

## 4. Frontend Directory Structure

```text
frontend/
├── .env.example
├── .env
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── vite-env.d.ts
    ├── api/
    │   ├── axiosClient.ts
    │   └── authApi.ts
    ├── components/
    │   ├── common/
    │   │   └── ModulePlaceholder.tsx
    │   ├── layout/
    │   │   ├── Header.tsx
    │   │   └── Sidebar.tsx
    │   └── ui/
    │       ├── Alert.tsx
    │       ├── Badge.tsx
    │       ├── Button.tsx
    │       ├── Card.tsx
    │       ├── EmptyState.tsx
    │       ├── Input.tsx
    │       ├── KPICard.tsx
    │       ├── Modal.tsx
    │       ├── Pagination.tsx
    │       ├── Select.tsx
    │       ├── Skeleton.tsx
    │       └── Table.tsx
    ├── context/
    │   └── AuthContext.tsx
    ├── hooks/
    │   └── useAuth.ts
    ├── layouts/
    │   └── AppLayout.tsx
    ├── pages/
    │   ├── action-center/
    │   │   └── ActionCenterPage.tsx
    │   ├── ai-intelligence/
    │   │   └── AIIntelligencePage.tsx
    │   ├── analytics/
    │   │   └── AnalyticsPage.tsx
    │   ├── auth/
    │   │   └── LoginPage.tsx
    │   ├── dashboard/
    │   │   └── DashboardPage.tsx
    │   ├── employees/
    │   │   └── EmployeesPage.tsx
    │   ├── errors/
    │   │   └── NotFoundPage.tsx
    │   │   └── UnauthorizedPage.tsx
    │   ├── follow-ups/
    │   │   └── FollowUpsPage.tsx
    │   └── lifecycle/
    │       └── LifecyclePage.tsx
    ├── routes/
    │   ├── AppRoutes.tsx
    │   └── ProtectedRoute.tsx
    ├── styles/
    │   ├── globals.css
    │   └── tokens.css
    ├── test/
    │   ├── alert.test.tsx
    │   ├── authNavigation.test.tsx
    │   ├── axiosClient.test.ts
    │   ├── badge.test.tsx
    │   ├── button.test.tsx
    │   ├── input.test.tsx
    │   └── setup.ts
    ├── types/
    │   ├── auth.ts
    │   ├── common.ts
    │   ├── department.ts
    │   └── employee.ts
    └── utils/
        └── cn.ts
```

---

## 5. Verification Commands

* **Run Frontend Unit Tests**:
  ```bash
  cd frontend
  npm test
  ```
* **Build Frontend Bundle**:
  ```bash
  cd frontend
  npm run build
  ```
* **Run Integration Verification**:
  ```bash
  & "backend\.venv\Scripts\python.exe" scripts\verify_phase2.py
  ```

