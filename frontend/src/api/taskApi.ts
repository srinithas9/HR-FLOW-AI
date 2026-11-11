import { axiosClient } from './axiosClient';
import {
  TaskItem,
  TaskDetail,
  TaskOverviewMetrics,
  TaskTemplate,
  TaskCreateParams,
  TaskStatusUpdateParams,
  TaskReassignParams,
  TaskDeadlineParams,
  TaskDependency,
  MLShadowPrediction,
} from '../types/task';
import { PaginatedResponse } from '../types/common';

export interface TaskFilterParams {
  page?: number;
  size?: number;
  category?: string;
  department_id?: number;
  owner_id?: number;
  employee_id?: number;
  priority?: string;
  status?: string;
  due_date_from?: string;
  due_date_to?: string;
  overdue?: boolean;
  risk_level?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  active_only?: boolean;
  due_in_next_days?: number;
  view?: string;
  due_window?: string;
}

export const taskApi = {
  getOverview: async (): Promise<TaskOverviewMetrics> => {
    const res = await axiosClient.get<TaskOverviewMetrics>('/api/v1/tasks/overview');
    return res.data;
  },

  listTasks: async (params?: TaskFilterParams): Promise<PaginatedResponse<TaskItem>> => {
    const res = await axiosClient.get<PaginatedResponse<TaskItem>>('/api/v1/tasks', { params });
    return res.data;
  },

  getTaskDetail: async (taskId: number): Promise<TaskDetail> => {
    const res = await axiosClient.get<TaskDetail>(`/api/v1/tasks/${taskId}`);
    return res.data;
  },

  listTemplates: async (category?: string): Promise<TaskTemplate[]> => {
    const res = await axiosClient.get<TaskTemplate[]>('/api/v1/tasks/templates', {
      params: category ? { category } : undefined,
    });
    return res.data;
  },

  createTask: async (data: TaskCreateParams): Promise<TaskDetail> => {
    const res = await axiosClient.post<TaskDetail>('/api/v1/tasks', data);
    return res.data;
  },

  updateTask: async (taskId: number, data: Partial<TaskCreateParams>): Promise<TaskDetail> => {
    const res = await axiosClient.put<TaskDetail>(`/api/v1/tasks/${taskId}`, data);
    return res.data;
  },

  updateStatus: async (taskId: number, data: TaskStatusUpdateParams): Promise<TaskDetail> => {
    const res = await axiosClient.patch<TaskDetail>(`/api/v1/tasks/${taskId}/status`, data);
    return res.data;
  },

  reassignOwner: async (taskId: number, data: TaskReassignParams): Promise<TaskDetail> => {
    const res = await axiosClient.post<TaskDetail>(`/api/v1/tasks/${taskId}/reassign`, data);
    return res.data;
  },

  extendDeadline: async (taskId: number, data: TaskDeadlineParams): Promise<TaskDetail> => {
    const res = await axiosClient.post<TaskDetail>(`/api/v1/tasks/${taskId}/extend-deadline`, data);
    return res.data;
  },

  addDependency: async (
    taskId: number,
    data: { prerequisite_task_id: number; dependency_type?: string }
  ): Promise<TaskDependency> => {
    const res = await axiosClient.post<TaskDependency>(`/api/v1/tasks/${taskId}/dependencies`, data);
    return res.data;
  },

  removeDependency: async (taskId: number, dependencyId: number): Promise<void> => {
    await axiosClient.delete(`/api/v1/tasks/${taskId}/dependencies/${dependencyId}`);
  },

  getTaskRiskPrediction: async (taskId: number): Promise<MLShadowPrediction> => {
    const res = await axiosClient.get<MLShadowPrediction>(`/api/v1/ml/tasks/${taskId}/prediction`);
    return res.data;
  },

  addComment: async (taskId: number, comment: string): Promise<any> => {
    const res = await axiosClient.post(`/api/v1/tasks/${taskId}/comments`, { comment });
    return res.data;
  },

  reopenTask: async (taskId: number, reason: string): Promise<TaskDetail> => {
    const res = await axiosClient.post<TaskDetail>(`/api/v1/tasks/${taskId}/reopen`, { reason });
    return res.data;
  },

  deleteTask: async (taskId: number): Promise<void> => {
    await axiosClient.delete(`/api/v1/tasks/${taskId}`);
  },
};
