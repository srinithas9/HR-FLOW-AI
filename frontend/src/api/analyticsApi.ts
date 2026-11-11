import { axiosClient } from './axiosClient';
import {
  AnalyticsPerformanceResponse,
  ActivityRecordsResponse,
  AnalyticsFilterParams,
  ActivityFilterParams,
} from '../types/analytics';

export const analyticsApi = {
  getPerformance: async (params?: AnalyticsFilterParams): Promise<AnalyticsPerformanceResponse> => {
    const res = await axiosClient.get<AnalyticsPerformanceResponse>('/api/v1/analytics/performance', {
      params,
    });
    return res.data;
  },

  listActivities: async (params?: ActivityFilterParams): Promise<ActivityRecordsResponse> => {
    const res = await axiosClient.get<ActivityRecordsResponse>('/api/v1/analytics/activities', {
      params,
    });
    return res.data;
  },
};

