export interface TaskAssigneeInfo {
  id: number;
  full_name: string;
  email: string;
  role?: string | null;
  department?: string | null;
}

export interface TaskEmployeeInfo {
  id: number;
  full_name: string;
  employee_code: string;
  department?: string | null;
}

export interface PrerequisiteDetail {
  id: number;
  task_code: string;
  title: string;
  status: string;
  owner_name: string;
}

export interface FollowUpDetail {
  id: number;
  follow_up_date: string;
  notes: string;
  response_received: boolean;
  response_notes?: string | null;
}

export interface EscalationDetail {
  id: number;
  escalation_level: number;
  reason: string;
  status: string;
  escalated_to_name: string;
}

export interface WorkloadDetail {
  active_tasks_count: number;
  historical_delay_rate: number;
}

export interface ContributingFactorInfo {
  factor: string;
  effect: string;
  impact: number;
}

export interface ModelPredictionDetails {
  delay_probability: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  model_version: string;
  advisory_note: string;
  contributing_factors: ContributingFactorInfo[];
}

export interface MLIntelligenceOverview {
  high_risk_tasks: number;
  medium_risk_tasks?: number;
  low_risk_tasks?: number;
  needs_attention: number;
  overdue_tasks: number;
  upcoming_at_risk_deadlines: number;
  total_active_tasks: number;
  last_updated: string;
}

export interface MLIntelligenceTaskItem {
  task_id: number;
  task_code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  due_date: string;
  days_remaining: number;
  is_overdue: boolean;
  overdue_days: number;
  assignee: TaskAssigneeInfo;
  employee?: TaskEmployeeInfo | null;
  delay_probability: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  hr_attention_priority: 'CRITICAL' | 'NEEDS_ATTENTION' | 'MONITOR';
  main_concern: string;
  bottlenecks: string[];
  active_blockers_count: number;
  follow_ups_count: number;
  escalations_count: number;
}

export interface MLIntelligenceTaskAssessment {
  task_id: number;
  task_code: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  due_date: string;
  days_remaining: number;
  is_overdue: boolean;
  overdue_days: number;
  assignee: TaskAssigneeInfo;
  employee?: TaskEmployeeInfo | null;
  model_prediction: ModelPredictionDetails;
  hr_attention_priority: 'CRITICAL' | 'NEEDS_ATTENTION' | 'MONITOR';
  hr_attention_rule: string;
  main_concern: string;
  operational_facts: {
    dependencies: PrerequisiteDetail[];
    follow_ups: FollowUpDetail[];
    escalations: EscalationDetail[];
    owner_workload: WorkloadDetail;
  };
  observations: string[];
  suggested_next_steps: string[];
  available_actions: {
    task_url: string;
    follow_ups_url: string;
    employee_url?: string | null;
    can_escalate: boolean;
    can_prioritise: boolean;
  };
  prerequisites?: PrerequisiteDetail[];
  assignee_workload?: WorkloadDetail;
  recent_follow_ups?: FollowUpDetail[];
  escalations?: EscalationDetail[];
  suggested_action?: string;
}

export interface BottleneckCategorySummary {
  id: string;
  name: string;
  count: number;
  description: string;
  filter_key: string;
}

export interface MLIntelligenceBottlenecksResponse {
  categories: BottleneckCategorySummary[];
  total_bottlenecked_tasks: number;
}

export interface MLTasksListResponse {
  items: MLIntelligenceTaskItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface MLTasksFilterParams {
  risk_level?: string;
  attention_priority?: string;
  process?: string;
  department_id?: number;
  owner_id?: number;
  bottleneck?: string;
  overdue_only?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  size?: number;
}

