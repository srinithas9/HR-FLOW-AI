export interface TaskTemplate {
  id: number;
  template_code: string;
  name: string;
  category: string;
  default_priority: string;
  estimated_duration_days: number;
  default_role_code: string;
  description?: string;
  is_active: boolean;
}

export interface ContributingFactorItem {
  factor: string;
  effect: string;
  impact: number;
}

export interface MLShadowPrediction {
  task_id?: number;
  delay_probability: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  model_version: string;
  is_experimental: boolean;
  prediction_timestamp: string;
  contributing_factors: ContributingFactorItem[];
  features_used: Record<string, any>;
  disclaimer: string;
}

export interface MLPredictionInfo {
  id?: number;
  model_version: string;
  predicted_delay_probability: number;
  predicted_label: number;
  confidence_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  prediction_timestamp: string;
}

export interface TaskItem {
  id: number;
  task_code: string;
  template_id?: number;
  employee_id: number;
  owner_id: number;
  category: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  due_date: string;
  start_date?: string;
  completed_at?: string;
  deadline_extension_count: number;
  last_deadline_change_reason?: string;
  created_at: string;
  updated_at: string;

  // Joined display helpers
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  owner_name?: string;
  template_name?: string;
  is_overdue: boolean;
  last_follow_up_date?: string;

  // ML Risk
  ml_risk_score?: number;
  ml_risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ml_confidence_score?: number;
}

export interface TaskDependency {
  id: number;
  task_id: number;
  prerequisite_task_id: number;
  dependency_type: string;
  created_at: string;

  prerequisite_task_code?: string;
  prerequisite_title?: string;
  prerequisite_status?: string;
  prerequisite_due_date?: string;
  prerequisite_owner_name?: string;

  dependent_task_code?: string;
  dependent_title?: string;
  dependent_status?: string;
}

export interface TaskStatusHistoryItem {
  id: number;
  task_id: number;
  old_status: string;
  new_status: string;
  old_owner_id?: number;
  new_owner_id?: number;
  old_due_date?: string;
  new_due_date?: string;
  changed_by_user_id: number;
  change_reason?: string;
  changed_at: string;

  changed_by_name?: string;
  old_owner_name?: string;
  new_owner_name?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface TaskDetail extends TaskItem {
  prerequisites: TaskDependency[];
  successors: TaskDependency[];
  status_history: TaskStatusHistoryItem[];
  comments?: TaskComment[];
  latest_prediction?: MLPredictionInfo;
  shadow_prediction?: MLShadowPrediction;
  is_blocked: boolean;
  blocking_prerequisites: Array<{
    task_id: number;
    task_code: string;
    title: string;
    status: string;
  }>;
}

export interface TaskOverviewMetrics {
  total_tasks: number;
  pending_tasks: number;
  in_progress_tasks: number;
  blocked_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  high_risk_tasks: number;
  active_tasks?: number;
  total_active_tasks?: number;
  delayed_tasks?: number;
  due_in_7_days?: number;
}

export interface TaskCreateParams {
  employee_id: number;
  category: string;
  title: string;
  description?: string;
  priority: string;
  due_date: string;
  start_date?: string;
  template_id?: number;
  owner_id?: number;
  prerequisite_task_ids?: number[];
}

export interface TaskStatusUpdateParams {
  status: string;
  reason?: string;
  override_dependencies?: boolean;
  override_reason?: string;
}

export interface TaskReassignParams {
  new_owner_id: number;
  reason?: string;
}

export interface TaskDeadlineParams {
  new_due_date: string;
  reason: string;
}

