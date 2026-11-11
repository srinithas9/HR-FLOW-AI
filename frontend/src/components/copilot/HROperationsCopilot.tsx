import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Layers,
  FileCheck,
  TrendingUp,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { copilotApi } from '../../api/copilotApi';
import {
  ChatMessage,
  CopilotChatResponse,
} from '../../types/copilot';
import { useAuth } from '../../hooks/useAuth';

export const HROperationsCopilot: React.FC = () => {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Adjust textarea height automatically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Get user's first name
  const getUserFirstName = (): string => {
    if (!user?.full_name) return 'HR Team Member';
    return user.full_name.trim().split(' ')[0];
  };

  // Dynamic greeting based on time of day
  const getGreetingTime = (): string => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Hello';
  };

  // Handle sending message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const response: CopilotChatResponse = await copilotApi.sendMessage(
        text,
        conversationId || undefined
      );

      setConversationId(response.conversation_id);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        content: response.assistant_message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        related_records: response.related_records,
        source_metadata: response.source_metadata,
        suggested_next_actions: response.suggested_next_actions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Copilot request failed:', err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        content:
          err?.response?.data?.detail ||
          err?.message ||
          'Unable to reach HR Operations Copilot service. Please ensure the backend is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: 'Network or Service Error',
      };
      setMessages((prev) => [...prev, errorMessage]);
      // Preserve typed input on error so user doesn't lose text
      if (!textToSend) {
        setInputValue(text);
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleRetryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content);
    }
  };

  // Grouped suggested prompts
  const promptGroups = [
    {
      category: 'My Tasks',
      icon: Clock,
      prompts: [
        { label: 'What needs my attention today?', query: 'What needs my attention today?' },
        { label: 'What are my tasks?', query: 'What are my tasks?' },
        { label: 'Show my overdue tasks', query: 'Show my overdue tasks' },
      ],
    },
    {
      category: 'Employee Lifecycle',
      icon: Layers,
      prompts: [
        { label: 'Which probation reviews are due this week?', query: 'Which probation reviews are due this week?' },
        { label: 'Show delayed onboarding activities', query: 'Show delayed onboarding activities' },
        { label: 'Are there any pending confirmation approvals?', query: 'Are there any pending confirmation approvals?' },
      ],
    },
    {
      category: 'HR Operations',
      icon: FileCheck,
      prompts: [
        { label: 'Which follow-ups are waiting for a response?', query: 'Are any follow-ups waiting for a response?' },
        { label: 'Are there any unresolved escalations?', query: 'Are there any unresolved escalations?' },
        { label: 'Which tasks are blocked, and why?', query: 'Which tasks are blocked, and why?' },
      ],
    },
    {
      category: 'Intelligence & Insights',
      icon: TrendingUp,
      prompts: [
        { label: 'What are the biggest operational bottlenecks?', query: 'What are the biggest operational bottlenecks?' },
        { label: 'Which tasks have high predicted delay risk?', query: 'Which tasks have high predicted delay risk?' },
        { label: 'Which lifecycle process has the most overdue activities?', query: 'Which lifecycle process currently has the most overdue activities?' },
      ],
    },
    {
      category: 'Assistance',
      icon: MessageSquare,
      prompts: [
        { label: 'Draft a reminder for task TSK-00001', query: 'Draft a reminder for task TSK-00001' },
        { label: 'What is the onboarding status of our employees?', query: 'What is the onboarding status of our employees?' },
        { label: 'Explain why task TSK-00001 is delayed', query: 'Why is task TSK-00001 delayed?' },
      ],
    },
  ];

  // Markdown formatter
  const renderFormattedMessage = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-[13.5px] sm:text-[14px] leading-relaxed text-[#201A2C]">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          if (line.startsWith('### ') || line.startsWith('## ')) {
            return (
              <h4 key={idx} className="font-bold text-[14.5px] sm:text-[15.5px] text-[#1E162B] pt-2 pb-0.5 border-b border-[#EAE5F3]">
                {line.replace(/^#+\s*/, '')}
              </h4>
            );
          }

          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const bulletText = line.trim().replace(/^[-*]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6938EF] mt-2 shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(bulletText) }} />
              </div>
            );
          }

          if (/^\d+\.\s+/.test(line.trim())) {
            const listText = line.trim().replace(/^\d+\.\s+/, '');
            const numberMatch = line.trim().match(/^(\d+)\./);
            const num = numberMatch ? numberMatch[1] : '•';
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="text-[12px] font-bold text-[#5425CB] mt-0.5 shrink-0">{num}.</span>
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(listText) }} />
              </div>
            );
          }

          return (
            <p
              key={idx}
              dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
            />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string): string => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-[#181124]">$1</strong>');
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-purple-50 text-[#5425CB] text-[12px] font-mono border border-purple-200">$1</code>'
    );
    return formatted;
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* Slim Header Bar for Active Conversations */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-[#E1DBEA] bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#EDE7F7] border border-[#DCD5E8] text-[#5425CB] flex items-center justify-center shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#292238]">
              HR Operations Copilot
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#5425CB] bg-white border border-[#DCD5E8] hover:border-[#6938EF] hover:bg-[#EDE7F7] rounded-xl transition-all shadow-2xs cursor-pointer"
            title="Start a new conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-4 pb-2 space-y-4 bg-[#FCFBFD]">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="max-w-5xl mx-auto py-4 sm:py-5 space-y-5 animate-in fade-in-50 duration-300">
            {/* Greeting Header: Logo beside the text */}
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#EDE7F7] border border-[#DCD5E8] text-[#5425CB] flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6938EF]">
                    Welcome to HR Operations Copilot.
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#1E162B] tracking-tight">
                    {getGreetingTime()}, {getUserFirstName()}.
                  </h1>
                </div>
              </div>

              <div className="pt-1 pl-0.5">
                <p className="text-base sm:text-lg font-semibold text-[#201A2C]">
                  How can I help you with your HR operations today?
                </p>
              </div>
            </div>

            {/* Categorized Suggested Inquiries Card */}
            <div className="bg-white border border-[#E1DBEA] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#F0EBF8]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#6938EF]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4E4166]">
                    Suggested Operational Inquiries
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#7A708A]">
                  Select an inquiry to begin
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {promptGroups.map((group, gIdx) => {
                  const GroupIcon = group.icon;
                  const isWide = gIdx === 4;
                  return (
                    <div
                      key={gIdx}
                      className={`space-y-2 rounded-xl bg-[#FAF9FD] border border-[#ECE6F5] p-3.5 ${
                        isWide ? 'md:col-span-2' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-[#3B2F52]">
                        <GroupIcon className="w-3.5 h-3.5 text-[#6938EF]" />
                        <span>{group.category}</span>
                      </div>
                      <div className={`grid gap-2 ${isWide ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
                        {group.prompts.map((p, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => handleSendMessage(p.query)}
                            className="w-full p-2.5 text-left bg-white border border-[#E3DAEF] hover:border-[#6938EF] hover:bg-[#F6F1FD] rounded-xl transition-all shadow-2xs group flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <span className="text-xs font-medium text-[#292238] group-hover:text-[#5425CB] transition-colors line-clamp-2">
                              {p.label}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#9A8DAA] group-hover:text-[#5425CB] group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Message History Thread */
          <div className="max-w-5xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[#EDE7F7] border border-[#DCD5E8] text-[#5425CB] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`flex flex-col space-y-2 ${
                    msg.sender === 'user'
                      ? 'items-end max-w-xl'
                      : 'items-start max-w-3xl w-full'
                  }`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-4 shadow-2xs ${
                      msg.sender === 'user'
                        ? 'bg-[#6938EF] text-white rounded-tr-xs text-[14px] leading-relaxed'
                        : 'bg-white border border-[#E1DBEA] rounded-tl-xs w-full'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderFormattedMessage(msg.content)
                    )}
                  </div>

                  {/* Deep Record Link Badges */}
                  {msg.related_records && msg.related_records.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#796E89] self-center mr-1">
                        Verified Records:
                      </span>
                      {msg.related_records.slice(0, 6).map((rec, rIdx) => (
                        <Link
                          key={rIdx}
                          to={rec.link_path}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-[#D8CFE6] hover:border-[#6938EF] hover:bg-[#F4EFFB] text-[#5425CB] shadow-2xs transition-all"
                        >
                          <span>{rec.title}</span>
                          <ExternalLink className="w-3 h-3 text-[#796E89]" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Follow-up Suggested Actions */}
                  {msg.suggested_next_actions && msg.suggested_next_actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 px-1">
                      {msg.suggested_next_actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleSendMessage(act)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F3EEFA] border border-[#D8CCE9] hover:border-[#6938EF] hover:bg-[#E9E0F6] text-[#5425CB] transition-all cursor-pointer"
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message Footer / Controls */}
                  <div className="flex items-center gap-3 text-[11px] text-[#7A708A] px-1">
                    <span>{msg.timestamp}</span>

                    {msg.sender === 'assistant' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          className="inline-flex items-center gap-1 hover:text-[#5425CB] transition-colors cursor-pointer"
                          title="Copy response"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {msg.error && (
                          <button
                            type="button"
                            onClick={handleRetryLastMessage}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Thinking / Tool Execution State */}
            {isLoading && (
              <div className="flex gap-3 justify-start animate-in fade-in-50 duration-200">
                <div className="w-8 h-8 rounded-xl bg-[#EDE7F7] border border-[#DCD5E8] text-[#5425CB] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-[#E1DBEA] rounded-2xl rounded-tl-xs p-4 shadow-2xs flex items-center gap-3 text-xs text-[#5425CB] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#6938EF] animate-ping" />
                  <span>Checking HR records and compiling operational insights...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Composer Area */}
      <div className="px-4 pt-2 pb-5 bg-[#FCFBFD] shrink-0 border-t border-[#E1DBEA]/60">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-[#D0C5E0] focus-within:border-[#6938EF] focus-within:ring-2 focus-within:ring-[#6938EF]/20 bg-white shadow-xs transition-all flex items-end p-3 gap-3">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Ask anything about your HR operations..."
              className="flex-1 max-h-36 min-h-[48px] p-2.5 text-[15px] sm:text-[16px] text-[#201A2C] placeholder-[#8C839C] resize-none focus:outline-hidden disabled:bg-transparent leading-relaxed"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className={`h-11 w-11 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center ${
                inputValue.trim() && !isLoading
                  ? 'bg-[#6938EF] hover:bg-[#5425CB] text-white shadow-xs'
                  : 'bg-[#EDE8F5] text-[#9A90AA] cursor-not-allowed'
              }`}
              title="Send message (Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-[12px] sm:text-[13px] text-[#7E748E] mt-2 px-2">
            <span>Press <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-[#5425CB] font-bold">Enter</kbd> to send, <kbd className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-[#5425CB] font-bold">Shift + Enter</kbd> for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HROperationsCopilot;
