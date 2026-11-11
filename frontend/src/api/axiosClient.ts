import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Obtain base URL from Vite environment variables with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: attach JWT bearer token if present
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s and standardize error extraction
axiosClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token if unauthorized / session expired
      localStorage.removeItem('access_token');
      // Dispatch a storage event or custom event for auth listeners
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

/**
 * Standard utility to parse FastAPI error details into a clean human-readable message.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      // Pydantic validation errors list
      return detail.map((d: { msg?: string; loc?: string[] }) => d.msg || JSON.stringify(d)).join(', ');
    }
    if (detail && typeof detail === 'object') {
      return (detail as { message?: string }).message || JSON.stringify(detail);
    }
    if (error.response?.data?.message) {
      return String(error.response.data.message);
    }
    if (error.message) {
      if (error.message.includes('Network Error')) {
        return 'Unable to connect to the backend server. Please verify the API is running.';
      }
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

