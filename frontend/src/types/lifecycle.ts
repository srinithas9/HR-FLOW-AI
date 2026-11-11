export interface ProcessCardMetric {
  stage: string;
  title: string;
  description: string;
  primary_count: number;
  primary_label: string;
  secondary_count: number;
  secondary_label: string;
  action_required_count: number;
  action_required_label: string;
}

export interface LifecycleOverview {
  total_active_employees: number;
  onboarding_active: number;
  probation_active: number;
  confirmation_pending: number;
  performance_reviews_in_progress: number;
  offboarding_in_progress: number;
  confirmed_employees: number;
  process_cards?: ProcessCardMetric[];
}

export interface OnboardingRecord {
  id: number;
  employee_id: number;
  start_date: string;
  target_completion_date: string;
  actual_completion_date?: string | null;
  buddy_id?: number | null;
  it_asset_status: string;
  bgv_status: string;
  orientation_completed: boolean;
  overall_status: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  buddy_name?: string | null;
  created_at: string;
}

export interface ProbationRecord {
  id: number;
  employee_id: number;
  probation_start_date: string;
  probation_end_date: string;
  extended_end_date?: string | null;
  extension_reason?: string | null;
  manager_feedback?: string | null;
  hr_evaluation?: string | null;
  status: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  manager_name?: string | null;
  created_at: string;
}

export interface ConfirmationRecord {
  id: number;
  probation_record_id: number;
  employee_id: number;
  confirmation_due_date: string;
  effective_confirmation_date?: string | null;
  approved_by_manager_id?: number | null;
  approved_by_hr_id?: number | null;
  confirmation_letter_issued: boolean;
  status: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  manager_name?: string | null;
  approved_by_hr_name?: string | null;
  created_at: string;
}

export interface EmployeeDocument {
  id: number;
  employee_id: number;
  requirement_id: number;
  document_name: string;
  file_path: string;
  submission_date: string;
  status: string;
  verified_by_id?: number | null;
  verification_notes?: string | null;
  verified_at?: string | null;
  requirement_name?: string | null;
  created_at: string;
}

export interface PerformanceReview {
  id: number;
  employee_id: number;
  review_cycle: string;
  reviewer_id: number;
  self_review_status: string;
  manager_review_status: string;
  rating?: number | null;
  review_submission_deadline: string;
  completion_date?: string | null;
  status: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  reviewer_name?: string | null;
  created_at: string;
}

export interface OffboardingRecord {
  id: number;
  employee_id: number;
  resignation_date: string;
  last_working_day: string;
  exit_interview_completed: boolean;
  asset_recovery_status: string;
  kt_status: string;
  clearance_status: string;
  overall_status: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  created_at: string;
}

export interface TaskTemplate {
  id: number;
  template_code: string;
  name: string;
  category: string;
  default_priority: string;
  estimated_duration_days: number;
  default_role_code: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateTaskPreviewItem {
  template_id: number;
  template_code: string;
  title: string;
  category: string;
  priority: string;
  estimated_duration_days: number;
  calculated_due_date: string;
  target_role_code: string;
  target_assignee_name?: string | null;
  target_assignee_id?: number | null;
  is_duplicate: boolean;
  duplicate_task_id?: number | null;
}

export interface TemplateExecutionPreview {
  employee_id: number;
  employee_name: string;
  department_name?: string | null;
  template_tasks: TemplateTaskPreviewItem[];
  new_tasks_count: number;
  duplicate_tasks_count: number;
}

export interface TemplateExecutionRequest {
  employee_id: number;
  template_ids: number[];
  start_date?: string;
}

export interface TemplateExecutionResult {
  employee_id: number;
  created_task_ids: number[];
  skipped_duplicate_template_ids: number[];
  total_created: number;
}

export interface LifecycleCalendarEvent {
  id: string;
  category: string;
  event_type: string;
  title: string;
  date: string;
  employee_id: number;
  employee_name: string;
  employee_code?: string | null;
  department_name?: string | null;
  status: string;
  priority?: string;
  details_url?: string;
}

export interface EligibleEmployee {
  id: number;
  name: string;
  employee_code: string;
  department_name?: string | null;
}

export interface OnboardingInitiateRequest {
  employee_id: number;
  start_date: string;
  target_completion_date: string;
  buddy_id?: number | null;
  template_ids?: number[];
}

export interface ConfirmationRecommendationRequest {
  manager_recommendation: 'RECOMMENDED' | 'EXTEND_PROBATION' | 'NOT_RECOMMENDED';
  manager_feedback: string;
}

export interface ConfirmationDecisionRequest {
  decision: 'CONFIRMED' | 'EXTENDED' | 'REJECTED';
  effective_confirmation_date?: string;
  confirmation_letter_issued?: boolean;
  extension_months?: number;
  notes?: string;
}

export interface PerformanceCycleCreate {
  cycle_name: string;
  submission_deadline: string;
  department_id?: number | null;
}

export interface OffboardingInitiateRequest {
  employee_id: number;
  resignation_date: string;
  last_working_day: string;
  reason?: string;
  template_ids?: number[];
}

export interface OffboardingCompleteRequest {
  notes?: string;
}


