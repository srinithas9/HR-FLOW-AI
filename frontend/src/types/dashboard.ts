export interface DashboardKPIs {
  total_employees: number;
  new_joiners_this_month: number;
  exits_this_month: number;
  pending_hr_actions: number;
  // Legacy / backward-compatible properties
  active_employees?: number;
  open_tasks?: number;
  overdue_tasks?: number;
  tasks_due_next_7_days?: number;
}

export interface DashboardLifecycleStages {
  onboarding_active: number;
  probation_active: number;
  confirmation_pending: number;
  documentation_pending: number;
  performance_reviews_in_progress: number;
  offboarding_in_progress: number;
}

export interface AttentionItem {
  id: string;
  entity_id: number;
  category: 'OVERDUE_TASK' | 'OVERDUE_REVIEW' | 'OVERDUE_DECISION' | 'PENDING_CLEARANCE' | 'UNVERIFIED_DOCUMENT' | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department_name: string;
  owner_id?: number | null;
  owner_name?: string | null;
  workflow_status: string;
  due_date?: string | null;
  days_overdue: number;
  action_required: string;
  link_path: string;
}

export interface MilestoneItem {
  id: string;
  milestone_type: 'ONBOARDING_COMPLETION' | 'PROBATION_END' | 'CONFIRMATION_DUE' | 'PERFORMANCE_DEADLINE' | 'OFFBOARDING_EXIT' | string;
  title: string;
  employee_id: number;
  employee_name: string;
  employee_code: string;
  department_name: string;
  target_date: string;
  days_remaining: number;
  status: string;
  owner_name?: string | null;
  link_path: string;
}

export interface ActivityItem {
  id: number;
  entity_type: string;
  entity_id?: number | null;
  action: string;
  action_label: string;
  actor_id?: number | null;
  actor_name: string;
  employee_name?: string | null;
  details: Record<string, any>;
  created_at: string;
  formatted_time: string;
}

export interface BriefingItem {
  id: string;
  headline: string;
  description: string;
  process: string;
  action_label: string;
  link_path: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | string;
}

export interface DashboardOverviewResponse {
  operational_date: string;
  user_role: string;
  department_id?: number | null;
  kpis: DashboardKPIs;
  lifecycle: DashboardLifecycleStages;
  attention_required: AttentionItem[];
  total_attention_count: number;
  daily_briefing?: BriefingItem[];
}

export interface CopilotOperationalSummary {
  id: number;
  title: string;
  summary_type: string;
  target_role: string;
  period_start: string;
  period_end: string;
  executive_summary: string;
  key_metrics: Record<string, any>;
  critical_bottlenecks: (string | { bottleneck?: string; impact?: string; [key: string]: any })[];
  action_items: (string | { action?: string; owner?: string; [key: string]: any })[];
  generated_at: string;
}

