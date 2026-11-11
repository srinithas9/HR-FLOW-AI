export interface FollowUpItem {
  id: number;
  task_id: number;
  initiator_user_id: number;
  target_user_id: number;
  follow_up_date: string;
  notes: string;
  response_received: boolean;
  response_notes?: string;
  created_at: string;

  initiator_name?: string;
  initiator_role_name?: string;
  target_name?: string;
  target_role_name?: string;
  task_code?: string;
  task_title?: string;
  category?: string;
  employee_id?: number;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  status: string;
  is_overdue: boolean;
}

export interface FollowUpCreateParams {
  task_id: number;
  target_user_id?: number;
  follow_up_date: string;
  notes: string;
  reminder_timing?: string;
}

export interface FollowUpAcknowledgeParams {
  action: 'ACKNOWLEDGE' | 'RESCHEDULE' | 'CANCEL' | 'COMPLETE';
  response_notes: string;
  rescheduled_date?: string;
}

export interface EscalationItem {
  id: number;
  task_id: number;
  escalated_by_user_id: number;
  escalated_to_user_id: number;
  escalation_level: number;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'ACKNOWLEDGED';
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;

  task_code?: string;
  task_title?: string;
  category?: string;
  escalated_by_name?: string;
  escalated_to_name?: string;
  escalated_to_role_name?: string;
  employee_id?: number;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
}

export interface FollowUpOverviewMetrics {
  total_follow_ups: number;
  awaiting_response: number;
  overdue: number;
  response_received: number;
  completed: number;
  total_escalations: number;
  open_escalations: number;
  acknowledged_escalations: number;
  resolved_escalations: number;
}

export interface EscalationCreateParams {
  task_id: number;
  escalated_to_user_id: number;
  escalation_level: number;
  reason: string;
}

export interface EscalationResolveParams {
  status: 'RESOLVED' | 'ACKNOWLEDGED';
  resolution_notes: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  task_id?: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  read_at?: string;
  sent_at: string;
  task_code?: string;
}

export interface ReminderTriggerResult {
  tasks_scanned: number;
  notifications_created: number;
  escalations_created: number;
  summary: string;
}

