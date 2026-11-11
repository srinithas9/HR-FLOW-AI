# PHASE 1 BACKEND DOCUMENTATION
## REST APIs, Authentication, Authorization and RBAC

> **Platform**: AI-Powered HR Operations & Action Intelligence Platform  
> **Backend Architecture**: Modular Monolith  
> **Status**: Completed, Audited & Verified  
> **API Version**: `v1` (`/api/v1`)

---

## 1. Architecture & Security Overview

Phase 1 establishes the core backend engineering foundations for the platform:
1. **Stateless JWT Authentication**: Secure password verification via bcrypt (12 rounds) and HS256-signed JWT tokens with configurable expiration.
2. **Four-Role RBAC Model**: Backend authorization enforcing permissions across `ADMIN`, `HR_MANAGER`, `HR_EXECUTIVE`, and `REPORTING_MANAGER`.
3. **Query-Level Reporting Scope Restriction**: Reporting Managers are restricted at the SQL query level strictly to their assigned direct reporting team members.
4. **Data Isolation & Security**: Password hashes and secret values are strictly excluded from all schemas and responses. Authentication errors use generic messages to prevent user-enumeration attacks.
5. **Alembic Database Migration**: Created and applied revision `70f45e238359` adding `hashed_password` to the `users` table and aligning `roles` without deleting or modifying any Phase 0 records.

---

## 2. RBAC Permission Matrix

| API Endpoint | Method | ADMIN | HR_MANAGER | HR_EXECUTIVE | REPORTING_MANAGER | Scope / Restriction Notes |
|---|:---:|:---:|:---:|:---:|:---:|---|
| `/api/v1/auth/login` | POST | Allow | Allow | Allow | Allow | Public authentication endpoint |
| `/api/v1/auth/me` | GET | Allow | Allow | Allow | Allow | Authenticated user profile |
| `/api/v1/roles` | GET | Allow | Allow | Allow | Allow | Returns 4 approved business roles |
| `/api/v1/departments` | GET | Allow | Allow | Allow | Allow | Headcount & department catalog |
| `/api/v1/departments/{id}` | GET | Allow | Allow | Allow | Allow | Department detail & department head |
| `/api/v1/users` | GET | Allow | **Deny (403)** | **Deny (403)** | **Deny (403)** | Restricted strictly to ADMIN |
| `/api/v1/users/{id}` | GET | Allow | Own Only | Own Only | Own Only | Non-ADMIN can only view own account |
| `/api/v1/users` | POST | Allow | **Deny (403)** | **Deny (403)** | **Deny (403)** | User creation restricted to ADMIN |
| `/api/v1/users/{id}` | PATCH | Allow | **Deny (403)** | **Deny (403)** | **Deny (403)** | Role/profile editing restricted to ADMIN |
| `/api/v1/users/{id}/status` | PATCH | Allow | **Deny (403)** | **Deny (403)** | **Deny (403)** | Account activation restricted to ADMIN |
| `/api/v1/employees` | GET | Allow | Allow | Allow | **Restricted** | REPORTING_MANAGER scoped strictly to direct reports |
| `/api/v1/employees/{id}` | GET | Allow | Allow | Allow | **Restricted** | 403 Forbidden if employee is outside manager scope |

---

## 3. Environment Variables Reference

Configure environment parameters in `backend/.env` (modeled after `.env.example`):

| Variable Name | Default / Sample | Description |
|---|---|---|
| `POSTGRES_SERVER` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `postgres` | Database username |
| `POSTGRES_PASSWORD` | `postgres` | Database user password |
| `POSTGRES_DB` | `hr_operations_db` | Relational database name |
| `JWT_SECRET_KEY` | *(min 32 bytes)* | Secret key for signing JWT tokens |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token validity duration in minutes (24h) |
| `DEFAULT_USER_PASSWORD` | `Password@123` | Default password for seeded development users |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Permitted CORS origins |
| `TIMEZONE` | `Asia/Kolkata` | Standard operational business timezone (IST) |

---

## 4. API Documentation & Interactive Swagger UI

Interactive OpenAPI documentation is live at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

### Testing Authentication in Swagger UI:
1. Open `http://localhost:8000/docs`.
2. Click the green **Authorize** button in the top right corner.
3. Call `POST /api/v1/auth/login` with your credentials:
   - **Admin**: `shruti.dutta10@indiatree-tech.in` / `Password@123`
   - **HR Executive**: `geeta.dutta325@indiatree-tech.in` / `Password@123`
   - **HR Manager**: `vivek.reddy326@indiatree-tech.in` / `Password@123`
   - **Reporting Manager**: `rohan.pillai1@indiatree-tech.in` / `Password@123`
4. Copy the returned `access_token` into the Swagger Authorization popup as `Bearer <token>`.
5. Execute protected queries against `/api/v1/employees`, `/api/v1/departments`, or `/api/v1/users`.

---

## 5. Example Requests and Responses

### 5.1 Login Request
`POST /api/v1/auth/login`
```json
{
  "email": "shruti.dutta10@indiatree-tech.in",
  "password": "Password@123"
}
```
**Response (`HTTP 200 OK`)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in_minutes": 1440,
  "user": {
    "id": 10,
    "email": "shruti.dutta10@indiatree-tech.in",
    "full_name": "Shruti Dutta",
    "role_id": 1,
    "role": {
      "id": 1,
      "role_code": "ADMIN",
      "role_name": "Admin",
      "description": "System and HR Administrator with user management and configuration rights",
      "is_active": true,
      "created_at": "2024-11-01T09:00:00+05:30",
      "updated_at": "2024-11-01T09:00:00+05:30"
    },
    "employee_id": 10,
    "is_active": true,
    "last_login_at": "2026-11-08T13:00:00+05:30"
  }
}
```

### 5.2 Current User Profile
`GET /api/v1/auth/me`  
*Header: `Authorization: Bearer <access_token>`*

**Response (`HTTP 200 OK`)**:
```json
{
  "id": 10,
  "email": "shruti.dutta10@indiatree-tech.in",
  "full_name": "Shruti Dutta",
  "role": {
    "id": 1,
    "role_code": "ADMIN",
    "role_name": "Admin",
    "description": "System and HR Administrator with user management and configuration rights",
    "is_active": true,
    "created_at": "2024-11-01T09:00:00+05:30",
    "updated_at": "2024-11-01T09:00:00+05:30"
  },
  "employee_id": 10,
  "is_active": true,
  "last_login_at": "2026-11-08T13:00:00+05:30",
  "created_at": "2024-11-01T09:00:00+05:30"
}
```

### 5.3 List Employees with Filtering & Pagination
`GET /api/v1/employees?department_id=1&employment_status=CONFIRMED&page=1&size=2`  
*Header: `Authorization: Bearer <access_token>`*

**Response (`HTTP 200 OK`)**:
```json
{
  "items": [
    {
      "id": 1,
      "employee_code": "EMP-0001",
      "first_name": "Rohan",
      "last_name": "Pillai",
      "email": "rohan.pillai1@indiatree-tech.in",
      "phone_number": "+91-954129841",
      "department_id": 1,
      "designation": "Engineering Manager",
      "location": "Bengaluru",
      "employment_status": "CONFIRMED",
      "date_of_joining": "2023-04-12",
      "manager_id": null,
      "created_at": "2023-04-12T09:00:00+05:30",
      "updated_at": "2026-11-08T09:00:00+05:30"
    },
    {
      "id": 11,
      "employee_code": "EMP-0011",
      "first_name": "Karthik",
      "last_name": "Reddy",
      "email": "karthik.reddy11@indiatree-tech.in",
      "phone_number": "+91-948120491",
      "department_id": 1,
      "designation": "Technical Lead",
      "location": "Bengaluru",
      "employment_status": "CONFIRMED",
      "date_of_joining": "2023-08-15",
      "manager_id": 1,
      "created_at": "2023-08-15T09:00:00+05:30",
      "updated_at": "2026-11-08T09:00:00+05:30"
    }
  ],
  "pagination": {
    "page": 1,
    "size": 2,
    "total": 105,
    "total_pages": 53
  }
}
```

### 5.4 Cross-Employee Access Rejection for Reporting Manager
`GET /api/v1/employees/10`  
*Authenticated as `rohan.pillai1@indiatree-tech.in` (Engineering Manager for SWE)*

**Response (`HTTP 403 Forbidden`)**:
```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Access denied: You are only authorized to view employees within your direct reporting hierarchy.",
    "details": null
  }
}
```

---

## 6. Running Automated Tests

Run the full pytest suite from `backend`:

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v
```

All 29 tests execute in under 6 seconds, testing authentication, invalid credentials, token expiry, RBAC restrictions, employee hierarchy scoping, pagination, input validation, and database record preservation.

