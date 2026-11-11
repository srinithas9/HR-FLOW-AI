import { axiosClient } from './axiosClient';
import {
  FollowUpItem,
  FollowUpCreateParams,
  FollowUpAcknowledgeParams,
  EscalationItem,
  EscalationCreateParams,
  EscalationResolveParams,
  NotificationItem,
  ReminderTriggerResult,
  FollowUpOverviewMetrics,
} from '../types/sla';
import { PaginatedResponse } from '../types/common';

export const slaApi = {
  // Overview metrics
  getOverview: async (): Promise<FollowUpOverviewMetrics> => {
    const res = await axiosClient.get<FollowUpOverviewMetrics>('/api/v1/follow-ups/overview');
    return res.data;
  },

  // Follow-ups
  listFollowUps: async (params?: {
    page?: number;
    size?: number;
    task_id?: number;
    employee_id?: number;
    target_user_id?: number;
    status?: string;
    response_received?: boolean;
    date_from?: string;
    date_to?: string;
    search?: string;
    category?: string;
    view?: string;
  }): Promise<PaginatedResponse<FollowUpItem>> => {
    const res = await axiosClient.get<PaginatedResponse<FollowUpItem>>('/api/v1/follow-ups', { params });
    return res.data;
  },

  scheduleFollowUp: async (data: FollowUpCreateParams): Promise<FollowUpItem> => {
    const res = await axiosClient.post<FollowUpItem>('/api/v1/follow-ups', data);
    return res.data;
  },

  acknowledgeFollowUp: async (
    followUpId: number,
    data: FollowUpAcknowledgeParams
  ): Promise<FollowUpItem> => {
    const res = await axiosClient.patch<FollowUpItem>(`/api/v1/follow-ups/${followUpId}/acknowledge`, data);
    return res.data;
  },

  // Escalations
  listEscalations: async (params?: {
    page?: number;
    size?: number;
    task_id?: number;
    employee_id?: number;
    escalated_to_user_id?: number;
    status?: string;
    level?: number;
    search?: string;
    category?: string;
  }): Promise<PaginatedResponse<EscalationItem>> => {
    const res = await axiosClient.get<PaginatedResponse<EscalationItem>>('/api/v1/escalations', { params });
    return res.data;
  },

  createEscalation: async (data: EscalationCreateParams): Promise<EscalationItem> => {
    const res = await axiosClient.post<EscalationItem>('/api/v1/escalations', data);
    return res.data;
  },

  resolveEscalation: async (
    escalationId: number,
    data: EscalationResolveParams
  ): Promise<EscalationItem> => {
    const res = await axiosClient.patch<EscalationItem>(`/api/v1/escalations/${escalationId}/resolve`, data);
    return res.data;
  },

  // Notifications
  listNotifications: async (params?: {
    unread_only?: boolean;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<NotificationItem>> => {
    const res = await axiosClient.get<PaginatedResponse<NotificationItem>>('/api/v1/notifications', { params });
    return res.data;
  },

  markNotificationRead: async (notificationId: number): Promise<NotificationItem> => {
    const res = await axiosClient.patch<NotificationItem>(`/api/v1/notifications/${notificationId}/read`);
    return res.data;
  },

  markAllNotificationsRead: async (): Promise<void> => {
    await axiosClient.post('/api/v1/notifications/read-all');
  },

  // Reminders Trigger
  triggerReminders: async (): Promise<ReminderTriggerResult> => {
    const res = await axiosClient.post<ReminderTriggerResult>('/api/v1/reminders/trigger');
    return res.data;
  },
};
