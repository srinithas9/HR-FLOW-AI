import { axiosClient } from './axiosClient';
import { PaginatedResponse } from '../types/common';
import { RoleCode } from '../types/auth';

export interface UserItem {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  role: {
    id: number;
    role_code: RoleCode;
    role_name: string;
    description: string;
  };
  employee_id?: number | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListUsersParams {
  page?: number;
  size?: number;
  role_id?: number;
  is_active?: boolean;
  search?: string;
}

export const userApi = {
  listUsers: async (params?: ListUsersParams): Promise<PaginatedResponse<UserItem>> => {
    const res = await axiosClient.get<PaginatedResponse<UserItem>>('/api/v1/users', { params });
    return res.data;
  },
  getUser: async (id: number): Promise<UserItem> => {
    const res = await axiosClient.get<UserItem>(`/api/v1/users/${id}`);
    return res.data;
  },
};
