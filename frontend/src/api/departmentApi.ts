import { axiosClient } from './axiosClient';
import { Department } from '../types/department';

export const departmentApi = {
  async listDepartments(): Promise<Department[]> {
    const response = await axiosClient.get<Department[]>('/api/v1/departments');
    return response.data;
  },

  async getDepartment(id: number): Promise<Department> {
    const response = await axiosClient.get<Department>(`/api/v1/departments/${id}`);
    return response.data;
  },
};

