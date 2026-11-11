import { axiosClient } from './axiosClient';
import {
  LifecycleOverview,
  OnboardingRecord,
  ProbationRecord,
  ConfirmationRecord,
  EmployeeDocument,
  PerformanceReview,
  OffboardingRecord,
  TaskTemplate,
  TemplateExecutionPreview,
  TemplateExecutionRequest,
  TemplateExecutionResult,
  LifecycleCalendarEvent,
  EligibleEmployee,
  OnboardingInitiateRequest,
  ConfirmationRecommendationRequest,
  ConfirmationDecisionRequest,
  PerformanceCycleCreate,
  OffboardingInitiateRequest,
  OffboardingCompleteRequest,
} from '../types/lifecycle';
import { PaginatedResponse } from '../types/common';

export const lifecycleApi = {
  async getOverview(): Promise<LifecycleOverview> {
    const response = await axiosClient.get<LifecycleOverview>('/api/v1/lifecycle/overview');
    return response.data;
  },

  // 1. Onboarding
  async listOnboarding(params: { page?: number; size?: number; status?: string; it_asset_status?: string; bgv_status?: string; orientation_completed?: boolean } = {}): Promise<PaginatedResponse<OnboardingRecord>> {
    const response = await axiosClient.get<PaginatedResponse<OnboardingRecord>>('/api/v1/lifecycle/onboarding', { params });
    return response.data;
  },

  async updateOnboarding(id: number, data: Partial<OnboardingRecord>): Promise<OnboardingRecord> {
    const response = await axiosClient.patch<OnboardingRecord>(`/api/v1/lifecycle/onboarding/${id}`, data);
    return response.data;
  },

  async initiateOnboarding(data: OnboardingInitiateRequest): Promise<OnboardingRecord> {
    const response = await axiosClient.post<OnboardingRecord>('/api/v1/lifecycle/onboarding', data);
    return response.data;
  },

  async getEligibleEmployeesForOnboarding(): Promise<EligibleEmployee[]> {
    const response = await axiosClient.get<EligibleEmployee[]>('/api/v1/lifecycle/onboarding/eligible-employees');
    return response.data;
  },

  // 2. Probation
  async listProbation(params: { page?: number; size?: number; status?: string } = {}): Promise<PaginatedResponse<ProbationRecord>> {
    const response = await axiosClient.get<PaginatedResponse<ProbationRecord>>('/api/v1/lifecycle/probation', { params });
    return response.data;
  },

  async updateProbation(id: number, data: Partial<ProbationRecord>): Promise<ProbationRecord> {
    const response = await axiosClient.patch<ProbationRecord>(`/api/v1/lifecycle/probation/${id}`, data);
    return response.data;
  },

  // 3. Confirmation
  async listConfirmation(params: { page?: number; size?: number; status?: string } = {}): Promise<PaginatedResponse<ConfirmationRecord>> {
    const response = await axiosClient.get<PaginatedResponse<ConfirmationRecord>>('/api/v1/lifecycle/confirmation', { params });
    return response.data;
  },

  async approveConfirmation(id: number, data: { effective_confirmation_date?: string; confirmation_letter_issued?: boolean; notes?: string }): Promise<ConfirmationRecord> {
    const response = await axiosClient.post<ConfirmationRecord>(`/api/v1/lifecycle/confirmation/${id}/approve`, data);
    return response.data;
  },

  async recommendConfirmation(id: number, data: ConfirmationRecommendationRequest): Promise<ConfirmationRecord> {
    const response = await axiosClient.post<ConfirmationRecord>(`/api/v1/lifecycle/confirmation/${id}/recommend`, data);
    return response.data;
  },

  async decideConfirmation(id: number, data: ConfirmationDecisionRequest): Promise<ConfirmationRecord> {
    const response = await axiosClient.post<ConfirmationRecord>(`/api/v1/lifecycle/confirmation/${id}/decision`, data);
    return response.data;
  },

  // 4. Documents
  async listDocuments(params: { page?: number; size?: number; status?: string; employee_id?: number } = {}): Promise<PaginatedResponse<EmployeeDocument>> {
    const response = await axiosClient.get<PaginatedResponse<EmployeeDocument>>('/api/v1/lifecycle/documents', { params });
    return response.data;
  },

  async verifyDocument(id: number, data: { status: 'VERIFIED' | 'REJECTED'; verification_notes?: string }): Promise<EmployeeDocument> {
    const response = await axiosClient.patch<EmployeeDocument>(`/api/v1/lifecycle/documents/${id}/verify`, data);
    return response.data;
  },

  // 5. Performance Reviews
  async listPerformanceReviews(params: { page?: number; size?: number; cycle?: string; status?: string } = {}): Promise<PaginatedResponse<PerformanceReview>> {
    const response = await axiosClient.get<PaginatedResponse<PerformanceReview>>('/api/v1/lifecycle/performance-reviews', { params });
    return response.data;
  },

  async updatePerformanceReview(id: number, data: Partial<PerformanceReview>): Promise<PerformanceReview> {
    const response = await axiosClient.patch<PerformanceReview>(`/api/v1/lifecycle/performance-reviews/${id}`, data);
    return response.data;
  },

  async listPerformanceCycles(): Promise<string[]> {
    const response = await axiosClient.get<string[]>('/api/v1/lifecycle/performance-reviews/cycles');
    return response.data;
  },

  async createPerformanceCycle(data: PerformanceCycleCreate): Promise<{ cycle_name: string; submission_deadline: string; reviews_created: number }> {
    const response = await axiosClient.post<{ cycle_name: string; submission_deadline: string; reviews_created: number }>('/api/v1/lifecycle/performance-reviews/cycle', data);
    return response.data;
  },

  // 6. Offboarding
  async listOffboarding(params: { page?: number; size?: number; status?: string } = {}): Promise<PaginatedResponse<OffboardingRecord>> {
    const response = await axiosClient.get<PaginatedResponse<OffboardingRecord>>('/api/v1/lifecycle/offboarding', { params });
    return response.data;
  },

  async updateOffboarding(id: number, data: Partial<OffboardingRecord>): Promise<OffboardingRecord> {
    const response = await axiosClient.patch<OffboardingRecord>(`/api/v1/lifecycle/offboarding/${id}`, data);
    return response.data;
  },

  async initiateOffboarding(data: OffboardingInitiateRequest): Promise<OffboardingRecord> {
    const response = await axiosClient.post<OffboardingRecord>('/api/v1/lifecycle/offboarding', data);
    return response.data;
  },

  async completeOffboarding(id: number, data: OffboardingCompleteRequest = {}): Promise<OffboardingRecord> {
    const response = await axiosClient.post<OffboardingRecord>(`/api/v1/lifecycle/offboarding/${id}/complete`, data);
    return response.data;
  },

  async getEligibleEmployeesForOffboarding(): Promise<EligibleEmployee[]> {
    const response = await axiosClient.get<EligibleEmployee[]>('/api/v1/lifecycle/offboarding/eligible-employees');
    return response.data;
  },

  // 7. Lifecycle Templates
  async listTemplates(params: { category?: string; is_active?: boolean } = {}): Promise<TaskTemplate[]> {
    const response = await axiosClient.get<TaskTemplate[]>('/api/v1/lifecycle/templates', { params });
    return response.data;
  },

  async createTemplate(data: Partial<TaskTemplate>): Promise<TaskTemplate> {
    const response = await axiosClient.post<TaskTemplate>('/api/v1/lifecycle/templates', data);
    return response.data;
  },

  async updateTemplate(id: number, data: Partial<TaskTemplate>): Promise<TaskTemplate> {
    const response = await axiosClient.patch<TaskTemplate>(`/api/v1/lifecycle/templates/${id}`, data);
    return response.data;
  },

  async toggleActiveTemplate(id: number): Promise<TaskTemplate> {
    const response = await axiosClient.post<TaskTemplate>(`/api/v1/lifecycle/templates/${id}/toggle-active`);
    return response.data;
  },

  async previewTemplates(employeeId: number, templateIds: number[], startDate?: string): Promise<TemplateExecutionPreview> {
    const query = new URLSearchParams();
    query.set('employee_id', String(employeeId));
    templateIds.forEach((id) => query.append('template_ids', String(id)));
    if (startDate) query.set('start_date', startDate);
    const response = await axiosClient.post<TemplateExecutionPreview>(`/api/v1/lifecycle/templates/preview?${query.toString()}`);
    return response.data;
  },

  async executeTemplates(data: TemplateExecutionRequest): Promise<TemplateExecutionResult> {
    const response = await axiosClient.post<TemplateExecutionResult>('/api/v1/lifecycle/templates/execute', data);
    return response.data;
  },

  // 8. Lifecycle Calendar
  async getCalendarEvents(params: { start_date?: string; end_date?: string; category?: string; department_id?: number } = {}): Promise<LifecycleCalendarEvent[]> {
    const response = await axiosClient.get<LifecycleCalendarEvent[]>('/api/v1/lifecycle/calendar', { params });
    return response.data;
  },
};


