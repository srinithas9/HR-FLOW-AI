export type RoleCode = 'ADMIN' | 'HR_EXECUTIVE' | 'HR_MANAGER' | 'REPORTING_MANAGER';

export interface Role {
  id: number;
  role_code: RoleCode;
  role_name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  role: Role;
  employee_id?: number | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user: AuthUser;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

