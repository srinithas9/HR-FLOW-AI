export interface RecordCitation {
  id: string;
  entity_type: string;
  entity_id: number;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  link_path: string;
}

export interface SourceMetadata {
  tools_called: string[];
  data_as_of: string;
  model_used: string;
  is_ai_generated: boolean;
  response_status: 'SUCCESS' | 'OFFLINE_FALLBACK' | 'AI_SERVICE_UNAVAILABLE' | 'ERROR';
  execution_time_seconds: number;
}

export interface CopilotChatResponse {
  conversation_id: string;
  assistant_message: string;
  response_status: 'SUCCESS' | 'OFFLINE_FALLBACK' | 'AI_SERVICE_UNAVAILABLE' | 'ERROR';
  related_records: RecordCitation[];
  source_metadata: SourceMetadata;
  suggested_next_actions: string[];
  generated_at: string;
}

export interface DailyBriefingKeyUpdate {
  category: string;
  headline: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  action_label: string;
  link_path: string;
  record_id?: string | null;
}

export interface HRDailyBriefingResponse {
  opening_summary: string;
  key_updates: DailyBriefingKeyUpdate[];
  recommended_focus: string;
  generated_at: string;
  data_as_of: string;
  is_ai_generated: boolean;
  source_status: 'AI_GENERATED' | 'DETERMINISTIC_FALLBACK';
}

export interface SuggestedPromptItem {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  related_records?: RecordCitation[];
  source_metadata?: SourceMetadata;
  suggested_next_actions?: string[];
  isLoading?: boolean;
  error?: string | null;
}

