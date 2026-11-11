import { axiosClient } from './axiosClient';
import { AuthUser, LoginCredentials, TokenResponse } from '../types/auth';

export const authApi = {
  /**
   * Authenticate with email & password against POST /api/v1/auth/login
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const response = await axiosClient.post<TokenResponse>('/api/v1/auth/login', credentials);
    return response.data;
  },

  /**
   * Retrieve current authenticated user profile against GET /api/v1/auth/me
   */
  async getCurrentUser(): Promise<AuthUser> {
    const response = await axiosClient.get<AuthUser>('/api/v1/auth/me');
    return response.data;
  },
};

