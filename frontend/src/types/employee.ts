export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  department_id: number;
  designation: string;
  location: string;
  employment_status: string;
  date_of_joining: string;
  manager_id?: number | null;
  department_name?: string | null;
  manager_name?: string | null;
  current_lifecycle_stage?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  department_id: number;
  designation: string;
  location: string;
  employment_status: string;
  date_of_joining: string;
  manager_id?: number | null;
}

export interface EmployeeUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  department_id?: number;
  designation?: string;
  location?: string;
  employment_status?: string;
  date_of_joining?: string;
  manager_id?: number | null;
}

export interface EmployeeTaskItem {
  id: number;
  task_code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  due_date?: string | null;
  completed_at?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
  is_subject?: boolean;
  link_path: string;
}

export interface EmployeeActivityItem {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  user_id?: number | null;
  user_name?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

export interface PendingActionItem {
  id: string;
  category: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string | null;
  responsible_party?: string | null;
  link_path: string;
}

export interface EmployeeProfile {
  employee: Employee;
  current_lifecycle_stage?: string | null;
  lifecycle_history: Array<{
    id: number;
    employee_id: number;
    current_stage: string;
    stage_start_date: string;
    stage_target_date: string;
    stage_status: string;
    completed_at?: string | null;
    notes?: string | null;
    created_at: string;
  }>;
  onboarding?: {
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
  } | null;
  onboarding_checklist: EmployeeTaskItem[];
  probation?: {
    id: number;
    employee_id: number;
    probation_start_date: string;
    probation_end_date: string;
    extended_end_date?: string | null;
    extension_reason?: string | null;
    manager_feedback?: string | null;
    hr_evaluation?: string | null;
    status: string;
  } | null;
  confirmation?: {
    id: number;
    probation_record_id: number;
    employee_id: number;
    confirmation_due_date?: string;
    scheduled_confirmation_date?: string;
    effective_confirmation_date?: string | null;
    approved_by_manager_id?: number | null;
    approved_by_hr_id?: number | null;
    confirmation_letter_issued: boolean;
    status: string;
  } | null;
  documents: Array<{
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
  }>;
  performance_reviews: Array<{
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
  }>;
  offboarding?: {
    id: number;
    employee_id: number;
    resignation_date: string;
    last_working_day: string;
    exit_interview_completed: boolean;
    asset_recovery_status: string;
    kt_status: string;
    clearance_status: string;
    overall_status: string;
  } | null;
  hr_tasks: EmployeeTaskItem[];
  assigned_tasks: EmployeeTaskItem[];
  tasks: EmployeeTaskItem[];
  pending_actions: PendingActionItem[];
  activity_history: EmployeeActivityItem[];
  can_edit?: boolean;
}

export interface EmployeeFilterOptions {
  designations: string[];
  managers: Array<{
    id: number;
    name: string;
    designation: string;
  }>;
  departments: Array<{
    id: number;
    name: string;
  }>;
  employment_statuses: string[];
}

export interface EmployeeFilterParams {
  page?: number;
  size?: number;
  search?: string;
  department_id?: number;
  employment_status?: string;
  manager_id?: number;
  location?: string;
  designation?: string;
  joining_date_from?: string;
  joining_date_to?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
