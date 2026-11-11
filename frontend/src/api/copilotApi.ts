import { axiosClient } from './axiosClient';
import {
  CopilotChatResponse,
  HRDailyBriefingResponse,
  SuggestedPromptItem,
} from '../types/copilot';

export const copilotApi = {
  /**
   * Send an operational query or instruction to the HR Operations Copilot.
   */
  sendMessage: async (message: string, conversationId?: string): Promise<CopilotChatResponse> => {
    const res = await axiosClient.post<CopilotChatResponse>('/api/v1/copilot/chat', {
      message,
      conversation_id: conversationId,
    });
    return res.data;
  },

  /**
   * Fetch context-aware suggested prompt pills tailored to user's role.
   */
  getSuggestedPrompts: async (): Promise<SuggestedPromptItem[]> => {
    const res = await axiosClient.get<SuggestedPromptItem[]>('/api/v1/copilot/suggested-prompts');
    return res.data;
  },

  /**
   * Fetch the Grounded HR Daily Briefing for the main dashboard.
   */
  getDailyBriefing: async (departmentId?: number): Promise<HRDailyBriefingResponse> => {
    const res = await axiosClient.get<HRDailyBriefingResponse>('/api/v1/copilot/daily-briefing', {
      params: departmentId ? { department_id: departmentId } : undefined,
    });
    return res.data;
  },

  /**
   * Fetch task delay-risk assessment synthesized by Copilot.
   */
  getTaskAssessment: async (taskId: number): Promise<any> => {
    const res = await axiosClient.get(`/api/v1/copilot/task-risk-assessment/${taskId}`);
    return res.data;
  },
};

