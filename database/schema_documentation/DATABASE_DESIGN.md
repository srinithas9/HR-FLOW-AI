# RELATIONAL DATABASE DESIGN SPECIFICATION
## HR Operations & Action Intelligence Platform

> **Database System**: PostgreSQL 17  
> **Database Name**: `hr_operations_db`  
> **Schema**: `public`  
> **Table Count**: Exactly 26 Tables (23 Core Business Tables + 3 Copilot Extension Tables)  
> **Key Standard**: BIGINT/BIGSERIAL Primary Keys, TIMESTAMPTZ Timestamps, DATE for Calendar Days

---

## Complete Table Summary

| # | Table Name | Category | Primary Key | Foreign Keys / Key Dependencies |
|---|---|---|---|---|
| 1 | `departments` | Organization | `id` | `head_of_department_id` -> `employees.id` (nullable) |
| 2 | `roles` | Access Control | `id` | None |
| 3 | `users` | Identity & Access | `id` | `employee_id` -> `employees.id`, `role_id` -> `roles.id` |
| 4 | `employees` | Workforce Core | `id` | `department_id` -> `departments.id`, `manager_id` -> `employees.id` |
| 5 | `employee_lifecycle` | Lifecycle Tracking | `id` | `employee_id` -> `employees.id` |
| 6 | `onboarding_records` | Lifecycle Detail | `id` | `employee_id` -> `employees.id`, `buddy_id` -> `employees.id` |
| 7 | `probation_records` | Lifecycle Detail | `id` | `employee_id` -> `employees.id` |
| 8 | `confirmation_records` | Lifecycle Detail | `id` | `probation_record_id` -> `probation_records.id`, `employee_id` -> `employees.id`, `approved_by_manager_id` -> `employees.id`, `approved_by_hr_id` -> `users.id` |
| 9 | `performance_reviews` | Lifecycle Detail | `id` | `employee_id` -> `employees.id`, `reviewer_id` -> `employees.id` |
| 10 | `offboarding_records` | Lifecycle Detail | `id` | `employee_id` -> `employees.id` |
| 11 | `task_templates` | Workflow Configuration | `id` | None |
| 12 | `tasks` | Workflow Core | `id` | `template_id` -> `task_templates.id`, `employee_id` -> `employees.id`, `owner_id` -> `users.id` |
| 13 | `task_dependencies` | Workflow Rules | `id` | `task_id` -> `tasks.id`, `prerequisite_task_id` -> `tasks.id` |
| 14 | `task_status_history` | Audit & Compliance | `id` | `task_id` -> `tasks.id`, `old_owner_id` -> `users.id`, `new_owner_id` -> `users.id`, `changed_by_user_id` -> `users.id` |
| 15 | `document_requirements` | Compliance Policy | `id` | None |
| 16 | `employee_documents` | Compliance Tracking | `id` | `employee_id` -> `employees.id`, `requirement_id` -> `document_requirements.id`, `verified_by_id` -> `users.id` |
| 17 | `follow_ups` | Operations SLA | `id` | `task_id` -> `tasks.id`, `initiator_user_id` -> `users.id`, `target_user_id` -> `users.id` |
| 18 | `notifications` | Communication | `id` | `user_id` -> `users.id`, `task_id` -> `tasks.id` |
| 19 | `escalations` | SLA Governance | `id` | `task_id` -> `tasks.id`, `escalated_by_user_id` -> `users.id`, `escalated_to_user_id` -> `users.id` |
| 20 | `task_snapshots` | Machine Learning | `id` | `task_id` -> `tasks.id` |
| 21 | `ml_predictions` | Machine Learning | `id` | `task_snapshot_id` -> `task_snapshots.id`, `task_id` -> `tasks.id` |
| 22 | `ai_insights` | GenAI & Analytics | `id` | `task_id` -> `tasks.id`, `employee_id` -> `employees.id`, `reviewed_by_user_id` -> `users.id` |
| 23 | `activity_logs` | Audit & Logging | `id` | `user_id` -> `users.id` |
| 24 | `ai_recommendations` | GenAI Copilot | `id` | `user_id` -> `users.id`, `task_id` -> `tasks.id`, `employee_id` -> `employees.id` |
| 25 | `ai_recommendation_history` | GenAI Audit | `id` | `recommendation_id` -> `ai_recommendations.id`, `user_id` -> `users.id` |
| 26 | `ai_operational_summaries` | GenAI Operations | `id` | None |

---

## Detailed Column-Level Specifications

### 1. `departments`
Stores enterprise departments across engineering and functional business units.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `department_code` (VARCHAR(30), UNIQUE, NOT NULL): Business code (e.g., `DEPT_SWE`, `DEPT_DEVOPS`).
- `name` (VARCHAR(100), NOT NULL): Full department name.
- `description` (TEXT, NULL): Functional overview.
- `head_of_department_id` (BIGINT, NULL, FK -> `employees.id`): Department leader.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Operational status.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record modification timestamp.

### 2. `roles`
Stores access control roles.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `role_code` (VARCHAR(30), UNIQUE, NOT NULL): Key role code (`HR_ADMIN`, `HR_OPERATIONS`, `PEOPLE_MANAGER`, `EMPLOYEE`).
- `role_name` (VARCHAR(100), NOT NULL): Display name.
- `description` (TEXT, NULL): Responsibilities and access scope.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Active state flag.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Update timestamp.

### 3. `users`
System user accounts for platform authentication and authorization.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NULL, FK -> `employees.id`, UNIQUE): Associated employee record.
- `email` (VARCHAR(150), UNIQUE, NOT NULL): Corporate login email.
- `full_name` (VARCHAR(150), NOT NULL): User's full name.
- `role_id` (BIGINT, NOT NULL, FK -> `roles.id`): Assigned role.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Account status.
- `last_login_at` (TIMESTAMPTZ, NULL): Timestamp of latest platform access.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Account creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Account update timestamp.

### 4. `employees`
Core employee profile and employment details.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_code` (VARCHAR(20), UNIQUE, NOT NULL): Unique employee identifier (e.g., `EMP-1001`).
- `first_name` (VARCHAR(50), NOT NULL): First name.
- `last_name` (VARCHAR(50), NOT NULL): Last name.
- `email` (VARCHAR(150), UNIQUE, NOT NULL): Work email address.
- `phone_number` (VARCHAR(25), NOT NULL): Contact number.
- `department_id` (BIGINT, NOT NULL, FK -> `departments.id`): Assigned department.
- `designation` (VARCHAR(100), NOT NULL): Technical or functional job title.
- `location` (VARCHAR(50), NOT NULL): Indian office hub (Bengaluru, Hyderabad, Pune, Chennai, Mumbai, Gurugram).
- `employment_status` (VARCHAR(30), NOT NULL): Status (`FULL_TIME`, `PROBATION`, `CONFIRMED`, `NOTICE_PERIOD`, `RESIGNED`, `TERMINATED`).
- `date_of_joining` (DATE, NOT NULL): Official start date.
- `manager_id` (BIGINT, NULL, FK -> `employees.id`): Direct reporting manager.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Profile creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Profile update timestamp.

### 5. `employee_lifecycle`
Tracks employee progression across all 6 lifecycle stages.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Associated employee.
- `current_stage` (VARCHAR(40), NOT NULL): Stage (`ONBOARDING`, `PROBATION`, `CONFIRMATION`, `PERFORMANCE_REVIEW`, `TRANSITION`, `OFFBOARDING`).
- `stage_start_date` (DATE, NOT NULL): Date stage was initiated.
- `stage_target_date` (DATE, NOT NULL): Expected completion date.
- `stage_status` (VARCHAR(30), NOT NULL): Execution status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`).
- `completed_at` (TIMESTAMPTZ, NULL): Exact completion timestamp.
- `notes` (TEXT, NULL): Contextual operational notes.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 6. `onboarding_records`
Specific onboarding tracking, asset allocation, and BGV verification.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`, UNIQUE): Associated employee.
- `start_date` (DATE, NOT NULL): Onboarding initiation date.
- `target_completion_date` (DATE, NOT NULL): SLA completion target date.
- `actual_completion_date` (DATE, NULL): Actual completion date.
- `buddy_id` (BIGINT, NULL, FK -> `employees.id`): Assigned peer onboarding buddy.
- `it_asset_status` (VARCHAR(30), NOT NULL): Asset status (`PENDING`, `ASSIGNED`, `DELIVERED`).
- `bgv_status` (VARCHAR(30), NOT NULL): Background check status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`).
- `orientation_completed` (BOOLEAN, NOT NULL, DEFAULT FALSE): Corporate induction completion flag.
- `overall_status` (VARCHAR(30), NOT NULL): Stage status (`IN_PROGRESS`, `COMPLETED`, `DELAYED`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 7. `probation_records`
Manages probation period milestones and evaluations.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Associated employee.
- `probation_start_date` (DATE, NOT NULL): Start of probation.
- `probation_end_date` (DATE, NOT NULL): Scheduled end date.
- `extended_end_date` (DATE, NULL): Extension date if extended.
- `extension_reason` (TEXT, NULL): Documented justification for extension.
- `manager_feedback` (TEXT, NULL): Formal evaluation notes from people manager.
- `hr_evaluation` (TEXT, NULL): HR operational assessment.
- `status` (VARCHAR(30), NOT NULL): Milestone state (`UNDER_REVIEW`, `EXTENDED`, `RECOMMENDED_FOR_CONFIRMATION`, `CONFIRMED`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 8. `confirmation_records`
Handles confirmation assessments, approvals, and letter issuance.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `probation_record_id` (BIGINT, NOT NULL, FK -> `probation_records.id`): Linked probation milestone.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Associated employee.
- `confirmation_due_date` (DATE, NOT NULL): Target SLA date for confirmation action.
- `effective_confirmation_date` (DATE, NULL): Effective date of confirmed status.
- `approved_by_manager_id` (BIGINT, NULL, FK -> `employees.id`): Approving manager.
- `approved_by_hr_id` (BIGINT, NULL, FK -> `users.id`): Approving HR specialist.
- `confirmation_letter_issued` (BOOLEAN, NOT NULL, DEFAULT FALSE): Formal issuance flag.
- `status` (VARCHAR(30), NOT NULL): State (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `ISSUED`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Update timestamp.

### 9. `performance_reviews`
Bi-annual performance appraisal cycles and ratings.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Employee being reviewed.
- `review_cycle` (VARCHAR(30), NOT NULL): Cycle identifier (e.g., `FY24-H1`, `FY24-H2`, `FY25-H1`, `FY25-H2`).
- `reviewer_id` (BIGINT, NOT NULL, FK -> `employees.id`): Reviewing manager.
- `self_review_status` (VARCHAR(30), NOT NULL): Status of self-evaluation (`PENDING`, `SUBMITTED`).
- `manager_review_status` (VARCHAR(30), NOT NULL): Status of manager evaluation (`PENDING`, `COMPLETED`).
- `rating` (NUMERIC(3,2), NULL): Score on 1.00 - 5.00 scale.
- `review_submission_deadline` (DATE, NOT NULL): Deadline for appraisal completion.
- `completion_date` (DATE, NULL): Date completed.
- `status` (VARCHAR(30), NOT NULL): Status (`DRAFT`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `OVERDUE`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 10. `offboarding_records`
Manages separation, notice period, KT, and clearances.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Exiting employee.
- `resignation_date` (DATE, NOT NULL): Date resignation tendered.
- `last_working_day` (DATE, NOT NULL): Agreed final working day.
- `exit_interview_completed` (BOOLEAN, NOT NULL, DEFAULT FALSE): HR interview status.
- `asset_recovery_status` (VARCHAR(30), NOT NULL): IT hardware recovery status (`PENDING`, `PARTIAL`, `COMPLETED`).
- `kt_status` (VARCHAR(30), NOT NULL): Knowledge transfer status (`NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`).
- `clearance_status` (VARCHAR(30), NOT NULL): Department clearances (`PENDING`, `APPROVED`).
- `overall_status` (VARCHAR(30), NOT NULL): Exit status (`IN_PROGRESS`, `COMPLETED`, `DELAYED`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 11. `task_templates`
Standardized blueprint templates for operational workflows.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `template_code` (VARCHAR(50), UNIQUE, NOT NULL): Standard code (e.g., `ONB_BGV_VERIFY`, `OFF_KT_SIGNOFF`).
- `name` (VARCHAR(150), NOT NULL): Display name.
- `category` (VARCHAR(40), NOT NULL): Workflow category (`ONBOARDING`, `PROBATION`, `CONFIRMATION`, `PERFORMANCE`, `OFFBOARDING`, `COMPLIANCE`).
- `default_priority` (VARCHAR(20), NOT NULL): Priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `estimated_duration_days` (INTEGER, NOT NULL): Expected SLA duration in calendar days.
- `default_role_code` (VARCHAR(30), NOT NULL): Role typically assigned.
- `description` (TEXT, NULL): Detailed operational guidance.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Operational status.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Template creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Template update timestamp.

### 12. `tasks`
Core operational task instances.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_code` (VARCHAR(50), UNIQUE, NOT NULL): Unique tracking code (e.g., `TSK-10001`).
- `template_id` (BIGINT, NULL, FK -> `task_templates.id`): Origin template reference.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Subject employee.
- `owner_id` (BIGINT, NOT NULL, FK -> `users.id`): Action owner responsible for completion.
- `category` (VARCHAR(40), NOT NULL): Workflow category.
- `title` (VARCHAR(200), NOT NULL): Task title.
- `description` (TEXT, NULL): Task details and instructions.
- `priority` (VARCHAR(20), NOT NULL): Priority level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `status` (VARCHAR(30), NOT NULL): Status (`PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`).
- `due_date` (DATE, NOT NULL): Official SLA completion due date.
- `start_date` (DATE, NULL): Date execution commenced.
- `completed_at` (TIMESTAMPTZ, NULL): Exact timestamp when marked completed.
- `deadline_extension_count` (INTEGER, NOT NULL, DEFAULT 0): Number of times due date was moved.
- `last_deadline_change_reason` (TEXT, NULL): Mandatory audit reason for last extension.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Task creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Task update timestamp.

### 13. `task_dependencies`
Enforces sequential prerequisite rules between tasks.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Successor task dependent on prerequisite.
- `prerequisite_task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Prerequisite task.
- `dependency_type` (VARCHAR(30), NOT NULL, DEFAULT 'FINISH_TO_START'): Relationship type (`FINISH_TO_START`, `START_TO_START`).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Creation timestamp.
- **Constraints**:
  - `CHECK (task_id != prerequisite_task_id)`: Prevents self-dependency.
  - `UNIQUE (task_id, prerequisite_task_id)`: Prevents duplicate edge.

### 14. `task_status_history`
Immutable audit log of all task lifecycle transitions, reassignments, and date adjustments.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Associated task.
- `old_status` (VARCHAR(30), NOT NULL): Previous status.
- `new_status` (VARCHAR(30), NOT NULL): Updated status.
- `old_owner_id` (BIGINT, NULL, FK -> `users.id`): Previous owner in reassignment.
- `new_owner_id` (BIGINT, NULL, FK -> `users.id`): New owner in reassignment.
- `old_due_date` (DATE, NULL): Previous due date in extension.
- `new_due_date` (DATE, NULL): Updated due date in extension.
- `changed_by_user_id` (BIGINT, NOT NULL, FK -> `users.id`): Actor who executed mutation.
- `change_reason` (TEXT, NULL): Documented justification.
- `changed_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Timestamp of event.

### 15. `document_requirements`
Compliance catalog of required employee documentation.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `requirement_code` (VARCHAR(50), UNIQUE, NOT NULL): Unique code (e.g., `DOC_PAN_CARD`, `DOC_PREV_EXP`).
- `name` (VARCHAR(150), NOT NULL): Document name.
- `lifecycle_stage` (VARCHAR(40), NOT NULL): Applicable stage (`ONBOARDING`, `PROBATION`, `CONFIRMATION`, `OFFBOARDING`, `COMPLIANCE`).
- `is_mandatory` (BOOLEAN, NOT NULL, DEFAULT TRUE): Mandatory compliance flag.
- `file_format_allowed` (VARCHAR(50), NOT NULL, DEFAULT 'PDF, JPG, PNG'): Permitted formats.
- `description` (TEXT, NULL): Submission instructions.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Catalog active flag.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Update timestamp.

### 16. `employee_documents`
Tracks employee document uploads and multi-stage verification.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `employee_id` (BIGINT, NOT NULL, FK -> `employees.id`): Employee owner.
- `requirement_id` (BIGINT, NOT NULL, FK -> `document_requirements.id`): Document type.
- `document_name` (VARCHAR(200), NOT NULL): Original filename.
- `file_path` (VARCHAR(500), NOT NULL): Secure storage location URI.
- `submission_date` (DATE, NOT NULL): Date submitted.
- `status` (VARCHAR(30), NOT NULL): State (`PENDING_SUBMISSION`, `SUBMITTED`, `VERIFIED`, `REJECTED`).
- `verified_by_id` (BIGINT, NULL, FK -> `users.id`): Verifying HR specialist.
- `verification_notes` (TEXT, NULL): Feedback or rejection reasoning.
- `verified_at` (TIMESTAMPTZ, NULL): Timestamp of verification decision.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record update timestamp.

### 17. `follow_ups`
Operational follow-up requests and reminder interactions.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Related task.
- `initiator_user_id` (BIGINT, NOT NULL, FK -> `users.id`): Sender (HR Ops / Manager).
- `target_user_id` (BIGINT, NOT NULL, FK -> `users.id`): Recipient assignee.
- `follow_up_date` (DATE, NOT NULL): Follow-up calendar date.
- `notes` (TEXT, NOT NULL): Follow-up inquiry content.
- `response_received` (BOOLEAN, NOT NULL, DEFAULT FALSE): Response flag.
- `response_notes` (TEXT, NULL): Content of assignee reply.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Creation timestamp.

### 18. `notifications`
Direct operational notifications and automated alerts.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `user_id` (BIGINT, NOT NULL, FK -> `users.id`): Alert recipient.
- `task_id` (BIGINT, NULL, FK -> `tasks.id`): Related task.
- `title` (VARCHAR(200), NOT NULL): Notification headline.
- `message` (TEXT, NOT NULL): Message body.
- `notification_type` (VARCHAR(30), NOT NULL): Type (`REMINDER`, `OVERDUE`, `ESCALATION`, `ASSIGNMENT`, `SYSTEM`).
- `is_read` (BOOLEAN, NOT NULL, DEFAULT FALSE): Read receipt flag.
- `read_at` (TIMESTAMPTZ, NULL): Timestamp when viewed.
- `sent_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Dispatch timestamp.

### 19. `escalations`
Formal operational escalations for blocked or overdue SLA tasks.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Escalated task.
- `escalated_by_user_id` (BIGINT, NOT NULL, FK -> `users.id`): User raising escalation.
- `escalated_to_user_id` (BIGINT, NOT NULL, FK -> `users.id`): Manager / HR Lead handling escalation.
- `escalation_level` (INTEGER, NOT NULL, DEFAULT 1): Severity level (1 = Manager, 2 = Dept Head, 3 = HR Leadership).
- `reason` (TEXT, NOT NULL): Detailed cause of escalation.
- `status` (VARCHAR(30), NOT NULL): Status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`).
- `resolved_at` (TIMESTAMPTZ, NULL): Resolution timestamp.
- `resolution_notes` (TEXT, NULL): Action taken to unblock task.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Escalation creation timestamp.

### 20. `task_snapshots`
Temporal point-in-time state records of active tasks used for Machine Learning delay prediction.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Monitored task.
- `snapshot_timestamp` (TIMESTAMPTZ, NOT NULL): Exact point in time represented.
- `task_category` (VARCHAR(40), NOT NULL): Category at snapshot time.
- `days_remaining` (INTEGER, NOT NULL): Calendar days remaining to due date at snapshot.
- `current_status` (VARCHAR(30), NOT NULL): Task status at snapshot time.
- `reminder_count` (INTEGER, NOT NULL): Total reminders dispatched prior to snapshot.
- `owner_previous_delay_rate` (NUMERIC(5,4), NOT NULL): Historical late-completion ratio of assigned owner.
- `owner_current_workload` (INTEGER, NOT NULL): Total active tasks assigned to owner at snapshot.
- `dependency_status` (VARCHAR(30), NOT NULL): State of prerequisites (`NONE`, `ALL_RESOLVED`, `BLOCKED`).
- `task_priority` (VARCHAR(20), NOT NULL): Priority level at snapshot.
- `is_eligible_for_prediction` (BOOLEAN, NOT NULL, DEFAULT TRUE): Flag indicating eligibility (non-overdue at snapshot).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Snapshot recording timestamp.

### 21. `ml_predictions`
Inference outputs from the Task Delay Risk Prediction model.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_snapshot_id` (BIGINT, NOT NULL, FK -> `task_snapshots.id`): Associated snapshot.
- `task_id` (BIGINT, NOT NULL, FK -> `tasks.id`): Target task.
- `model_version` (VARCHAR(50), NOT NULL): Model release tag (e.g., `v1.0.0-rf`).
- `predicted_delay_probability` (NUMERIC(5,4), NOT NULL): Continuous probability score (0.0000 - 1.0000).
- `predicted_label` (INTEGER, NOT NULL): Binary prediction (1 = Delay Risk, 0 = On Track).
- `confidence_score` (NUMERIC(5,4), NOT NULL): Model confidence metric.
- `prediction_timestamp` (TIMESTAMPTZ, NOT NULL): Time of inference calculation.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Record insertion timestamp.

### 22. `ai_insights`
Database-grounded operational insights and recommended actions produced by GenAI.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `task_id` (BIGINT, NULL, FK -> `tasks.id`): Optional task link.
- `employee_id` (BIGINT, NULL, FK -> `employees.id`): Optional employee link.
- `insight_category` (VARCHAR(40), NOT NULL): Category (`DELAY_RISK`, `WORKLOAD_BOTTLENECK`, `LIFECYCLE_STALL`, `ANOMALY`).
- `title` (VARCHAR(200), NOT NULL): Insight summary header.
- `insight_text` (TEXT, NOT NULL): Grounded qualitative analysis.
- `recommended_action` (TEXT, NOT NULL): Suggested concrete operational step.
- `supporting_data` (JSONB, NOT NULL, DEFAULT '{}'::jsonb): Structured facts and IDs backing the insight.
- `review_status` (VARCHAR(30), NOT NULL, DEFAULT 'PENDING_REVIEW'): Governance state (`PENDING_REVIEW`, `APPROVED`, `REJECTED`, `IMPLEMENTED`).
- `reviewed_by_user_id` (BIGINT, NULL, FK -> `users.id`): Human approver.
- `reviewed_at` (TIMESTAMPTZ, NULL): Human approval timestamp.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Insight generation timestamp.

### 23. `activity_logs`
Enterprise audit trail recording mutations across system entities.
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier.
- `user_id` (BIGINT, NULL, FK -> `users.id`): Actor executing the operation (null for system jobs).
- `entity_type` (VARCHAR(50), NOT NULL): Target entity (`TASK`, `EMPLOYEE`, `DOCUMENT`, `LIFECYCLE`, `ESCALATION`, `SYSTEM`).
- `entity_id` (BIGINT, NULL): Primary key of affected entity.
- `action` (VARCHAR(50), NOT NULL): Action performed (`CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `REASSIGN`, `APPROVE`).
- `details` (JSONB, NOT NULL, DEFAULT '{}'::jsonb): Contextual payload, before/after values, and metadata.
- `ip_address` (VARCHAR(50), NULL): Origin network IP address.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Event timestamp.

### 24. `ai_recommendations`
Actionable operational recommendations generated by the GenAI HR Operations Copilot.
- `id` (BIGSERIAL, PRIMARY KEY): Unique recommendation identifier.
- `user_id` (BIGINT, NOT NULL, FK -> `users.id` ON DELETE CASCADE): Target user / recipient of the recommendation.
- `task_id` (BIGINT, NULL, FK -> `tasks.id` ON DELETE SET NULL): Optional associated task.
- `employee_id` (BIGINT, NULL, FK -> `employees.id` ON DELETE SET NULL): Optional associated employee.
- `recommendation_category` (VARCHAR(50), NOT NULL): Category (e.g., `WORKLOAD_REBALANCING`, `SLA_RECOVERY`, `ONBOARDING_ESCALATION`, `PROBATION_REVIEW`).
- `title` (VARCHAR(255), NOT NULL): Concise summary title.
- `explanation` (TEXT, NOT NULL): Detailed grounding and root-cause rationale.
- `recommended_action` (TEXT, NOT NULL): Specific actionable intervention.
- `priority` (VARCHAR(20), NOT NULL, DEFAULT 'MEDIUM'): Priority level (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- `status` (VARCHAR(30), NOT NULL, DEFAULT 'PENDING'): Lifecycle status (`PENDING`, `ACCEPTED`, `SNOOZED`, `REJECTED`, `DISMISSED`, `EXPIRED`).
- `snooze_until` (TIMESTAMPTZ, NULL): Resurface timestamp if snoozed.
- `snooze_count` (INTEGER, NOT NULL, DEFAULT 0): Count of snooze actions taken.
- `accepted_at` (TIMESTAMPTZ, NULL): Timestamp when user accepted the recommendation.
- `rejected_at` (TIMESTAMPTZ, NULL): Timestamp when user rejected the recommendation.
- `expires_at` (TIMESTAMPTZ, NULL): Recommendation expiration timestamp.
- `supporting_evidence` (JSONB, NOT NULL, DEFAULT '{}'::jsonb): Structured metrics and evidence payload.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Generation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Mutation timestamp.

### 25. `ai_recommendation_history`
Immutable regulatory audit trail tracking all user interactions with Copilot recommendations.
- `id` (BIGSERIAL, PRIMARY KEY): Unique history event identifier.
- `recommendation_id` (BIGINT, NULL, FK -> `ai_recommendations.id` ON DELETE SET NULL): Associated recommendation (preserves audit trail on deletion).
- `user_id` (BIGINT, NULL, FK -> `users.id` ON DELETE SET NULL): User executing the action.
- `action` (VARCHAR(30), NOT NULL): Action performed (`GENERATED`, `ACCEPTED`, `SNOOZED`, `REJECTED`, `DISMISSED`, `EXPIRED`).
- `previous_status` (VARCHAR(30), NULL): Status before interaction.
- `new_status` (VARCHAR(30), NOT NULL): Status resulting from interaction.
- `action_timestamp` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Interaction timestamp.
- `notes` (TEXT, NULL): User-provided reason or notes.
- `action_metadata` (JSONB, NOT NULL, DEFAULT '{}'::jsonb): Metadata context payload.

### 26. `ai_operational_summaries`
Periodic AI-synthesized operational health digests across roles and time windows.
- `id` (BIGSERIAL, PRIMARY KEY): Unique summary identifier.
- `summary_type` (VARCHAR(20), NOT NULL): Cadence type (`DAILY`, `WEEKLY`).
- `period_start` (TIMESTAMPTZ, NOT NULL): Window start timestamp.
- `period_end` (TIMESTAMPTZ, NOT NULL): Window end timestamp.
- `target_role` (VARCHAR(30), NOT NULL, DEFAULT 'HR_OPERATIONS'): Target audience role.
- `title` (VARCHAR(255), NOT NULL): Summary title.
- `executive_summary` (TEXT, NOT NULL): Narrative executive overview.
- `key_metrics` (JSONB, NOT NULL, DEFAULT '{}'::jsonb): Structured operational metrics.
- `critical_bottlenecks` (JSONB, NOT NULL, DEFAULT '[]'::jsonb): Array of identified bottlenecks.
- `action_items` (JSONB, NOT NULL, DEFAULT '[]'::jsonb): Prioritized action items.
- `generated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()): Synthesis timestamp.
- *Constraint:* `UNIQUE (summary_type, target_role, period_start, period_end)` prevents duplicate digests.

---

## Relational Constraints & Integrity Guarantees

1. **Foreign Key Integrity**: All relationships enforce referential integrity with appropriate cascading rules or restrict constraints.
2. **Task Prerequisite Rule**: `task_dependencies` enforces `CHECK (task_id != prerequisite_task_id)` preventing cyclic self-dependency.
3. **Audit Trail Completeness**: `task_status_history`, `activity_logs`, and `ai_recommendation_history` preserve state changes across user reassignments, deadline alterations, and recommendation decisions.
4. **Historical Isolation**: `task_snapshots` strictly isolate point-in-time operational states without forward data leakage.
5. **AI Governance**: `ai_insights` mandates human review flags (`review_status`, `reviewed_by_user_id`, `reviewed_at`) before system execution, and `ai_recommendation_history` ensures every AI-driven action is auditable.

