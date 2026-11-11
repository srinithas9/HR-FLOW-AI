# DATA DICTIONARY: 23 NORMALIZED DATABASE TABLES
## AI-Powered HR Operations & Action Intelligence Platform

This data dictionary documents the exact schema, types, nullable constraints, and business definitions for all 23 relational database tables in `hr_operations_db`.

---

## 1. `departments`
- `id` (BIGINT, PK): Unique department identifier.
- `department_code` (VARCHAR(30), UNIQUE, NOT NULL): Business code (e.g., `DEPT_SWE`, `DEPT_QA`).
- `name` (VARCHAR(100), NOT NULL): Department name.
- `description` (TEXT, NULL): Scope and function of the unit.
- `head_of_department_id` (BIGINT, FK -> `employees.id`, NULL): Department head.
- `is_active` (BOOLEAN, NOT NULL): Operational status flag.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 2. `roles`
- `id` (BIGINT, PK): Unique role identifier.
- `role_code` (VARCHAR(30), UNIQUE, NOT NULL): `HR_ADMIN`, `HR_OPERATIONS`, `PEOPLE_MANAGER`, `EMPLOYEE`.
- `role_name` (VARCHAR(100), NOT NULL): Display name.
- `description` (TEXT, NULL): Functional role permissions.
- `is_active` (BOOLEAN, NOT NULL): Role status.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 3. `users`
- `id` (BIGINT, PK): System user identifier.
- `employee_id` (BIGINT, FK -> `employees.id`, NULL, UNIQUE): Linked employee.
- `email` (VARCHAR(150), UNIQUE, NOT NULL): Corporate login email.
- `full_name` (VARCHAR(150), NOT NULL): User name.
- `role_id` (BIGINT, FK -> `roles.id`, NOT NULL): Assigned role.
- `is_active` (BOOLEAN, NOT NULL): Active login state.
- `last_login_at` (TIMESTAMPTZ, NULL): Last login timestamp.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 4. `employees`
- `id` (BIGINT, PK): Unique employee identifier.
- `employee_code` (VARCHAR(20), UNIQUE, NOT NULL): Unique code (e.g. `EMP-0001`).
- `first_name` (VARCHAR(50), NOT NULL): First name.
- `last_name` (VARCHAR(50), NOT NULL): Last name.
- `email` (VARCHAR(150), UNIQUE, NOT NULL): Work email address.
- `phone_number` (VARCHAR(25), NOT NULL): Indian phone number (+91).
- `department_id` (BIGINT, FK -> `departments.id`, NOT NULL): Assigned department.
- `designation` (VARCHAR(100), NOT NULL): Official title.
- `location` (VARCHAR(50), NOT NULL): Office hub (Bengaluru, Hyderabad, Pune, Chennai, Mumbai, Gurugram).
- `employment_status` (VARCHAR(30), NOT NULL): `FULL_TIME`, `PROBATION`, `CONFIRMED`, `NOTICE_PERIOD`, `RESIGNED`.
- `date_of_joining` (DATE, NOT NULL): Official start date.
- `manager_id` (BIGINT, FK -> `employees.id`, NULL): Direct manager.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 5. `employee_lifecycle`
- `id` (BIGINT, PK): Unique lifecycle milestone ID.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Associated employee.
- `current_stage` (VARCHAR(40), NOT NULL): `ONBOARDING`, `PROBATION`, `CONFIRMATION`, `PERFORMANCE_REVIEW`, `TRANSITION`, `OFFBOARDING`.
- `stage_start_date` (DATE, NOT NULL): Stage begin date.
- `stage_target_date` (DATE, NOT NULL): Expected completion date.
- `stage_status` (VARCHAR(30), NOT NULL): `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`, `DELAYED`.
- `completed_at` (TIMESTAMPTZ, NULL): Stage completion timestamp.
- `notes` (TEXT, NULL): Operational notes.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 6. `onboarding_records`
- `id` (BIGINT, PK): Onboarding record ID.
- `employee_id` (BIGINT, FK -> `employees.id`, UNIQUE, NOT NULL): Employee.
- `start_date` (DATE, NOT NULL): Onboarding start.
- `target_completion_date` (DATE, NOT NULL): Target completion.
- `actual_completion_date` (DATE, NULL): Actual completion date.
- `buddy_id` (BIGINT, FK -> `employees.id`, NULL): Peer buddy.
- `it_asset_status` (VARCHAR(30), NOT NULL): `PENDING`, `ASSIGNED`, `DELIVERED`.
- `bgv_status` (VARCHAR(30), NOT NULL): `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`.
- `orientation_completed` (BOOLEAN, NOT NULL): Orientation flag.
- `overall_status` (VARCHAR(30), NOT NULL): `IN_PROGRESS`, `COMPLETED`, `DELAYED`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 7. `probation_records`
- `id` (BIGINT, PK): Probation record ID.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Employee.
- `probation_start_date` (DATE, NOT NULL): Start date.
- `probation_end_date` (DATE, NOT NULL): End date.
- `extended_end_date` (DATE, NULL): Extended date if any.
- `extension_reason` (TEXT, NULL): Reason for extension.
- `manager_feedback` (TEXT, NULL): Manager comments.
- `hr_evaluation` (TEXT, NULL): HR assessment.
- `status` (VARCHAR(30), NOT NULL): `UNDER_REVIEW`, `EXTENDED`, `RECOMMENDED_FOR_CONFIRMATION`, `CONFIRMED`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 8. `confirmation_records`
- `id` (BIGINT, PK): Confirmation record ID.
- `probation_record_id` (BIGINT, FK -> `probation_records.id`, NOT NULL): Linked probation.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Employee.
- `confirmation_due_date` (DATE, NOT NULL): Due date.
- `effective_confirmation_date` (DATE, NULL): Effective confirmation date.
- `approved_by_manager_id` (BIGINT, FK -> `employees.id`, NULL): Manager approver.
- `approved_by_hr_id` (BIGINT, FK -> `users.id`, NULL): HR approver.
- `confirmation_letter_issued` (BOOLEAN, NOT NULL): Letter issued flag.
- `status` (VARCHAR(30), NOT NULL): `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `ISSUED`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 9. `performance_reviews`
- `id` (BIGINT, PK): Review ID.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Reviewee.
- `review_cycle` (VARCHAR(30), NOT NULL): Cycle (`FY24-H2`, `FY25-H1`, `FY25-H2`, `FY26-H1`).
- `reviewer_id` (BIGINT, FK -> `employees.id`, NOT NULL): Manager reviewer.
- `self_review_status` (VARCHAR(30), NOT NULL): `PENDING`, `SUBMITTED`.
- `manager_review_status` (VARCHAR(30), NOT NULL): `PENDING`, `COMPLETED`.
- `rating` (NUMERIC(3,2), NULL): Score on 1.00 - 5.00 scale.
- `review_submission_deadline` (DATE, NOT NULL): Deadline date.
- `completion_date` (DATE, NULL): Date completed.
- `status` (VARCHAR(30), NOT NULL): `DRAFT`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `OVERDUE`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 10. `offboarding_records`
- `id` (BIGINT, PK): Offboarding record ID.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Exiting employee.
- `resignation_date` (DATE, NOT NULL): Resignation tender date.
- `last_working_day` (DATE, NOT NULL): Official last working day.
- `exit_interview_completed` (BOOLEAN, NOT NULL): Exit interview flag.
- `asset_recovery_status` (VARCHAR(30), NOT NULL): `PENDING`, `PARTIAL`, `COMPLETED`.
- `kt_status` (VARCHAR(30), NOT NULL): `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`.
- `clearance_status` (VARCHAR(30), NOT NULL): `PENDING`, `APPROVED`.
- `overall_status` (VARCHAR(30), NOT NULL): `IN_PROGRESS`, `COMPLETED`, `DELAYED`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 11. `task_templates`
- `id` (BIGINT, PK): Template ID.
- `template_code` (VARCHAR(50), UNIQUE, NOT NULL): Unique code.
- `name` (VARCHAR(150), NOT NULL): Template title.
- `category` (VARCHAR(40), NOT NULL): Workflow category.
- `default_priority` (VARCHAR(20), NOT NULL): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `estimated_duration_days` (INTEGER, NOT NULL): SLA days.
- `default_role_code` (VARCHAR(30), NOT NULL): Assigned role.
- `description` (TEXT, NULL): Instructions.
- `is_active` (BOOLEAN, NOT NULL): Active flag.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 12. `tasks`
- `id` (BIGINT, PK): Task ID.
- `task_code` (VARCHAR(50), UNIQUE, NOT NULL): Code (`TSK-00001`).
- `template_id` (BIGINT, FK -> `task_templates.id`, NULL): Template link.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Subject employee.
- `owner_id` (BIGINT, FK -> `users.id`, NOT NULL): Action owner.
- `category` (VARCHAR(40), NOT NULL): Category.
- `title` (VARCHAR(200), NOT NULL): Title.
- `description` (TEXT, NULL): Description.
- `priority` (VARCHAR(20), NOT NULL): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `status` (VARCHAR(30), NOT NULL): `PENDING`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELLED`.
- `due_date` (DATE, NOT NULL): Official SLA due date.
- `start_date` (DATE, NULL): Commencement date.
- `completed_at` (TIMESTAMPTZ, NULL): Actual completion timestamp.
- `deadline_extension_count` (INTEGER, NOT NULL): Extensions count.
- `last_deadline_change_reason` (TEXT, NULL): Audit reason for change.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 13. `task_dependencies`
- `id` (BIGINT, PK): Dependency ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Successor task.
- `prerequisite_task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Predecessor task.
- `dependency_type` (VARCHAR(30), NOT NULL): `FINISH_TO_START`, `START_TO_START`.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.

## 14. `task_status_history`
- `id` (BIGINT, PK): History record ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Associated task.
- `old_status` (VARCHAR(30), NOT NULL): Previous status.
- `new_status` (VARCHAR(30), NOT NULL): New status.
- `old_owner_id` (BIGINT, FK -> `users.id`, NULL): Previous owner.
- `new_owner_id` (BIGINT, FK -> `users.id`, NULL): New owner.
- `old_due_date` (DATE, NULL): Previous due date.
- `new_due_date` (DATE, NULL): New due date.
- `changed_by_user_id` (BIGINT, FK -> `users.id`, NOT NULL): Actor ID.
- `change_reason` (TEXT, NULL): Reason for change.
- `changed_at` (TIMESTAMPTZ, NOT NULL): Change timestamp.

## 15. `document_requirements`
- `id` (BIGINT, PK): Requirement ID.
- `requirement_code` (VARCHAR(50), UNIQUE, NOT NULL): Code.
- `name` (VARCHAR(150), NOT NULL): Document title.
- `lifecycle_stage` (VARCHAR(40), NOT NULL): Lifecycle stage.
- `is_mandatory` (BOOLEAN, NOT NULL): Mandatory flag.
- `file_format_allowed` (VARCHAR(50), NOT NULL): Permitted formats.
- `description` (TEXT, NULL): Guidelines.
- `is_active` (BOOLEAN, NOT NULL): Active status.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 16. `employee_documents`
- `id` (BIGINT, PK): Submission ID.
- `employee_id` (BIGINT, FK -> `employees.id`, NOT NULL): Employee.
- `requirement_id` (BIGINT, FK -> `document_requirements.id`, NOT NULL): Requirement.
- `document_name` (VARCHAR(200), NOT NULL): Filename.
- `file_path` (VARCHAR(500), NOT NULL): Storage path.
- `submission_date` (DATE, NOT NULL): Submission date.
- `status` (VARCHAR(30), NOT NULL): `PENDING_SUBMISSION`, `SUBMITTED`, `VERIFIED`, `REJECTED`.
- `verified_by_id` (BIGINT, FK -> `users.id`, NULL): Verifier user.
- `verification_notes` (TEXT, NULL): Verifier feedback.
- `verified_at` (TIMESTAMPTZ, NULL): Timestamp verified.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): Record update timestamp.

## 17. `follow_ups`
- `id` (BIGINT, PK): Follow-up ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Task.
- `initiator_user_id` (BIGINT, FK -> `users.id`, NOT NULL): Sender.
- `target_user_id` (BIGINT, FK -> `users.id`, NOT NULL): Recipient.
- `follow_up_date` (DATE, NOT NULL): Date sent.
- `notes` (TEXT, NOT NULL): Follow up content.
- `response_received` (BOOLEAN, NOT NULL): Response received flag.
- `response_notes` (TEXT, NULL): Assignee reply.
- `created_at` (TIMESTAMPTZ, NOT NULL): Record creation timestamp.

## 18. `notifications`
- `id` (BIGINT, PK): Notification ID.
- `user_id` (BIGINT, FK -> `users.id`, NOT NULL): Recipient user.
- `task_id` (BIGINT, FK -> `tasks.id`, NULL): Task link.
- `title` (VARCHAR(200), NOT NULL): Headline.
- `message` (TEXT, NOT NULL): Body.
- `notification_type` (VARCHAR(30), NOT NULL): `REMINDER`, `OVERDUE`, `ESCALATION`, `ASSIGNMENT`, `SYSTEM`.
- `is_read` (BOOLEAN, NOT NULL): Read receipt flag.
- `read_at` (TIMESTAMPTZ, NULL): Read timestamp.
- `sent_at` (TIMESTAMPTZ, NOT NULL): Dispatch timestamp.

## 19. `escalations`
- `id` (BIGINT, PK): Escalation incident ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Escalated task.
- `escalated_by_user_id` (BIGINT, FK -> `users.id`, NOT NULL): Sender.
- `escalated_to_user_id` (BIGINT, FK -> `users.id`, NOT NULL): Escalation handler.
- `escalation_level` (INTEGER, NOT NULL): Level (1, 2, 3).
- `reason` (TEXT, NOT NULL): Escalation reason.
- `status` (VARCHAR(30), NOT NULL): `OPEN`, `ACKNOWLEDGED`, `RESOLVED`.
- `resolved_at` (TIMESTAMPTZ, NULL): Resolution timestamp.
- `resolution_notes` (TEXT, NULL): Resolution details.
- `created_at` (TIMESTAMPTZ, NOT NULL): Escalation creation timestamp.

## 20. `task_snapshots`
- `id` (BIGINT, PK): Snapshot ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Monitored task.
- `snapshot_timestamp` (TIMESTAMPTZ, NOT NULL): Point in time.
- `task_category` (VARCHAR(40), NOT NULL): Category.
- `days_remaining` (INTEGER, NOT NULL): Days remaining to due date.
- `current_status` (VARCHAR(30), NOT NULL): Status at snapshot.
- `reminder_count` (INTEGER, NOT NULL): Prior reminders sent.
- `owner_previous_delay_rate` (NUMERIC(5,4), NOT NULL): Historical delay ratio.
- `owner_current_workload` (INTEGER, NOT NULL): Active open tasks assigned to owner.
- `dependency_status` (VARCHAR(30), NOT NULL): `NONE`, `ALL_RESOLVED`, `BLOCKED`.
- `task_priority` (VARCHAR(20), NOT NULL): Priority level.
- `is_eligible_for_prediction` (BOOLEAN, NOT NULL): Non-overdue eligibility flag.
- `created_at` (TIMESTAMPTZ, NOT NULL): Snapshot recording timestamp.

## 21. `ml_predictions`
- `id` (BIGINT, PK): Prediction ID.
- `task_snapshot_id` (BIGINT, FK -> `task_snapshots.id`, NOT NULL): Snapshot reference.
- `task_id` (BIGINT, FK -> `tasks.id`, NOT NULL): Task.
- `model_version` (VARCHAR(50), NOT NULL): Model tag.
- `predicted_delay_probability` (NUMERIC(5,4), NOT NULL): Probability score (0.0 - 1.0).
- `predicted_label` (INTEGER, NOT NULL): Binary (1 = delay risk, 0 = on track).
- `confidence_score` (NUMERIC(5,4), NOT NULL): Model confidence metric.
- `prediction_timestamp` (TIMESTAMPTZ, NOT NULL): Prediction calculation timestamp.
- `created_at` (TIMESTAMPTZ, NOT NULL): Insertion timestamp.

## 22. `ai_insights`
- `id` (BIGINT, PK): Insight ID.
- `task_id` (BIGINT, FK -> `tasks.id`, NULL): Task link.
- `employee_id` (BIGINT, FK -> `employees.id`, NULL): Employee link.
- `insight_category` (VARCHAR(40), NOT NULL): Category.
- `title` (VARCHAR(200), NOT NULL): Headline.
- `insight_text` (TEXT, NOT NULL): Narrative explanation.
- `recommended_action` (TEXT, NOT NULL): Recommended action.
- `supporting_data` (JSONB, NOT NULL): Grounded structured evidence.
- `review_status` (VARCHAR(30), NOT NULL): `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `IMPLEMENTED`.
- `reviewed_by_user_id` (BIGINT, FK -> `users.id`, NULL): Approver.
- `reviewed_at` (TIMESTAMPTZ, NULL): Approval timestamp.
- `created_at` (TIMESTAMPTZ, NOT NULL): Insight generation timestamp.

## 23. `activity_logs`
- `id` (BIGINT, PK): Audit entry ID.
- `user_id` (BIGINT, FK -> `users.id`, NULL): Actor ID.
- `entity_type` (VARCHAR(50), NOT NULL): Entity type (`TASK`, `EMPLOYEE`, `DOCUMENT`, etc.).
- `entity_id` (BIGINT, NULL): Entity PK.
- `action` (VARCHAR(50), NOT NULL): Action verb (`CREATE`, `UPDATE`, `STATUS_CHANGE`, etc.).
- `details` (JSONB, NOT NULL): Detailed payload and change log.
- `ip_address` (VARCHAR(50), NULL): Origin network address.
- `created_at` (TIMESTAMPTZ, NOT NULL): Event timestamp.

