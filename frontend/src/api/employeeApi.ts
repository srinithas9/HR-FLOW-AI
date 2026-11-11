import { axiosClient } from './axiosClient';
import {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeProfile,
  EmployeeFilterOptions,
  EmployeeFilterParams,
} from '../types/employee';
import { PaginatedResponse } from '../types/common';

export type { EmployeeFilterParams };

export const employeeApi = {
  async listEmployees(params: EmployeeFilterParams = {}): Promise<PaginatedResponse<Employee>> {
    const response = await axiosClient.get<PaginatedResponse<Employee>>('/api/v1/employees', { params });
    return response.data;
  },

  async getFilterOptions(): Promise<EmployeeFilterOptions> {
    const response = await axiosClient.get<EmployeeFilterOptions>('/api/v1/employees/filters/options');
    return response.data;
  },

  async getEmployee(id: number): Promise<Employee> {
    const response = await axiosClient.get<Employee>(`/api/v1/employees/${id}`);
    return response.data;
  },

  async createEmployee(data: EmployeeCreate): Promise<Employee> {
    const response = await axiosClient.post<Employee>('/api/v1/employees', data);
    return response.data;
  },

  async updateEmployee(id: number, data: EmployeeUpdate): Promise<Employee> {
    const response = await axiosClient.put<Employee>(`/api/v1/employees/${id}`, data);
    return response.data;
  },

  async getEmployeeProfile(id: number): Promise<EmployeeProfile> {
    const response = await axiosClient.get<EmployeeProfile>(`/api/v1/employees/${id}/profile`);
    return response.data;
  },
};
