import { axiosClient } from './axiosClient';
import {
  MLIntelligenceOverview,
  MLTasksListResponse,
  MLIntelligenceTaskAssessment,
  MLIntelligenceBottlenecksResponse,
  MLTasksFilterParams,
} from '../types/mlIntelligence';

export const mlIntelligenceApi = {
  getOverview: async (departmentId?: number): Promise<MLIntelligenceOverview> => {
    const res = await axiosClient.get<MLIntelligenceOverview>('/api/v1/ml-intelligence/overview', {
      params: departmentId ? { department_id: departmentId } : undefined,
    });
    return res.data;
  },

  listTasks: async (params?: MLTasksFilterParams): Promise<MLTasksListResponse> => {
    const res = await axiosClient.get<MLTasksListResponse>('/api/v1/ml-intelligence/tasks', {
      params,
    });
    return res.data;
  },

  getTaskAssessment: async (taskId: number): Promise<MLIntelligenceTaskAssessment> => {
    const res = await axiosClient.get<MLIntelligenceTaskAssessment>(
      `/api/v1/ml-intelligence/tasks/${taskId}/assessment`
    );
    return res.data;
  },

  getBottlenecks: async (departmentId?: number): Promise<MLIntelligenceBottlenecksResponse> => {
    const res = await axiosClient.get<MLIntelligenceBottlenecksResponse>(
      '/api/v1/ml-intelligence/bottlenecks',
      {
        params: departmentId ? { department_id: departmentId } : undefined,
      }
    );
    return res.data;
  },

  updateTaskPriority: async (taskId: number, priority: string): Promise<any> => {
    const res = await axiosClient.put(`/api/v1/tasks/${taskId}`, { priority });
    return res.data;
  },
};

