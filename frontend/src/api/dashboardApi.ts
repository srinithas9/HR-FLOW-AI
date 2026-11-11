import { axiosClient } from './axiosClient';
import {
  DashboardOverviewResponse,
  MilestoneItem,
  ActivityItem,
  CopilotOperationalSummary,
} from '../types/dashboard';

export const dashboardApi = {
  getOverview: async (departmentId?: number): Promise<DashboardOverviewResponse> => {
    const params: Record<string, any> = {};
    if (departmentId) {
      params.department_id = departmentId;
    }
    const response = await axiosClient.get<DashboardOverviewResponse>('/api/v1/dashboard/overview', { params });
    return response.data;
  },

  getUpcomingMilestones: async (departmentId?: number, daysAhead: number = 30): Promise<MilestoneItem[]> => {
    const params: Record<string, any> = { days_ahead: daysAhead };
    if (departmentId) {
      params.department_id = departmentId;
    }
    const response = await axiosClient.get<MilestoneItem[]>('/api/v1/dashboard/milestones', { params });
    return response.data;
  },

  getRecentActivities: async (limit: number = 10, departmentId?: number): Promise<ActivityItem[]> => {
    const params: Record<string, any> = { limit };
    if (departmentId) {
      params.department_id = departmentId;
    }
    const response = await axiosClient.get<ActivityItem[]>('/api/v1/dashboard/activities', {
      params,
    });
    return response.data;
  },

  getCopilotSummary: async (): Promise<CopilotOperationalSummary | null> => {
    const response = await axiosClient.get<CopilotOperationalSummary | null>('/api/v1/copilot/operational-summary');
    return response.data;
  },
};

