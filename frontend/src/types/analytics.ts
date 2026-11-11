export interface KPIPerformance {
  activities_completed: number;
  on_time_completion_rate: number;
  median_completion_time_days: number;
  late_completions: number;
  total_eligible: number;
}

export interface ProcessOnTimeMetric {
  process_key: string;
  process_name: string;
  completed_count: number;
  on_time_count: number;
  late_count: number;
  on_time_percentage: number;
}

export interface MonthlyCompletionTrendItem {
  month: string;
  month_label: string;
  completed: number;
  late: number;
  on_time: number;
  on_time_percentage: number;
}

export interface ProcessTurnaroundMetric {
  process_key: string;
  process_name: string;
  median_days: number;
  unit: string;
  sample_size: number;
}

export interface RecordedDelayReasonItem {
  reason: string;
  affected_activities: number;
  percentage: number;
}

export interface HROperationalObservation {
  id: string;
  category: string;
  title: string;
  observation: string;
  metric_or_process: string;
  why_it_matters: string;
  recommended_action: string;
  severity: 'critical' | 'warning' | 'info';
  action_filter?: Record<string, any> | null;
}

export interface AnalyticsPerformanceResponse {
  reporting_period: string;
  period_start: string;
  period_end: string;
  last_refreshed_at: string;
  kpis: KPIPerformance;
  on_time_by_process: ProcessOnTimeMetric[];
  monthly_trend: MonthlyCompletionTrendItem[];
  turnaround_by_process: ProcessTurnaroundMetric[];
  delay_reasons: RecordedDelayReasonItem[];
  observations: HROperationalObservation[];
}

export interface ActivityRecordItem {
  task_id: number;
  task_code: string;
  title: string;
  category: string;
  process_name: string;
  status: string;
  due_date: string;
  completed_at?: string | null;
  start_date?: string | null;
  duration_days?: number | null;
  is_late: boolean;
  assignee_name: string;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  delay_reason?: string | null;
}

export interface ActivityRecordsResponse {
  items: ActivityRecordItem[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface AnalyticsFilterParams {
  period?: string;
  department_id?: number;
  process?: string;
}

export interface ActivityFilterParams {
  process?: string;
  status?: string;
  month?: string;
  delay_reason?: string;
  department_id?: number;
  search?: string;
  page?: number;
  size?: number;
}

