import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Target,
} from 'lucide-react';
import { BriefingItem } from '../../types/dashboard';
import { HRDailyBriefingResponse } from '../../types/copilot';

interface HRDailyBriefingProps {
  briefing?: HRDailyBriefingResponse | null;
  items?: BriefingItem[];
  isLoading?: boolean;
}

export const HRDailyBriefing: React.FC<HRDailyBriefingProps> = ({
  briefing,
  items = [],
  isLoading,
}) => {
  const navigate = useNavigate();

  // Normalize key updates from briefing or items
  const keyUpdates: Array<{
    id: string;
    category: string;
    headline: string;
    description: string;
    severity: string;
    action_label: string;
    link_path: string;
  }> = briefing?.key_updates
    ? briefing.key_updates.map((u, idx) => ({
        id: u.record_id || `update-${idx}`,
        category: u.category,
        headline: u.headline,
        description: u.description,
        severity: u.severity,
        action_label: u.action_label,
        link_path: u.link_path,
      }))
    : items.map((item) => ({
        id: item.id,
        category: item.process,
        headline: item.headline,
        description: item.description,
        severity: item.severity,
        action_label: item.action_label,
        link_path: item.link_path,
      }));

  const openingSummary =
    briefing?.opening_summary ||
    'Operational status summary across active lifecycle workflows and daily deadlines.';

  const recommendedFocus = briefing?.recommended_focus;

  // Responsive grid class based on update count:
  // 1-3 updates: vertical or 3-col
  // 4 updates: balanced 2x2
  // 5-6 updates: 3-col
  const getGridClass = (count: number) => {
    if (count <= 2) return 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    if (count === 3) return 'grid grid-cols-1 md:grid-cols-3 gap-4';
    if (count === 4) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4';
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  };

  return (
    <div className="bg-white border border-[#E1DBEA] rounded-2xl p-6 sm:p-7 shadow-xs space-y-5 transition-all w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E1DBEA]/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EDE7F7] border border-[#DCD5E8] flex items-center justify-center text-[#5425CB] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E162B] tracking-tight">
              HR Daily Briefing
            </h2>
          </div>
          <p className="text-[14px] sm:text-[15px] text-[#5C5270] pl-11">
            {openingSummary}
          </p>
        </div>

        {briefing?.data_as_of && (
          <div className="flex items-center gap-2 text-[13px] text-[#777387] shrink-0 pl-11 sm:pl-0 font-mono font-medium">
            <Clock className="w-4 h-4 text-[#5425CB]" />
            <span>As of {briefing.data_as_of}</span>
          </div>
        )}
      </div>

      {/* Recommended Focus Banner */}
      {recommendedFocus && !isLoading && (
        <div className="p-4.5 sm:p-5 rounded-xl bg-[#F4EFFB] border border-[#DDD1FA] flex items-start gap-3.5 text-[15px] text-[#1E162B]">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#C9BBEF] text-[#5425CB] flex items-center justify-center shrink-0 shadow-2xs">
            <Target className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[12px] sm:text-[13px] font-extrabold uppercase tracking-wider text-[#5425CB]">
              Recommended Focus Today
            </span>
            <p className="text-[#2A1F45] font-medium leading-relaxed text-[15px] sm:text-[16px]">
              {recommendedFocus}
            </p>
          </div>
        </div>
      )}

      {/* Key Operational Updates Content */}
      {isLoading ? (
        <div className="py-10 text-center text-[15px] text-[#5C5270] space-y-2">
          <Clock className="w-6 h-6 mx-auto animate-spin text-[#5425CB]" />
          <p>Compiling daily operational updates...</p>
        </div>
      ) : keyUpdates.length === 0 ? (
        <div className="py-7 px-5 bg-[#FAF8FE] border border-[#E1DBEA] rounded-xl flex items-center gap-3 text-[15px] text-[#5C5270]">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>No additional HR insights at the moment. Your current HR activities are shown above.</span>
        </div>
      ) : (
        <div className={getGridClass(keyUpdates.length)}>
          {keyUpdates.map((item) => (
            <div
              key={item.id}
              className="p-5 sm:p-6 rounded-xl border border-[#E1DBEA] bg-[#FAF8FE]/80 hover:bg-white hover:border-[#C9BBEF] hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-purple-100 text-[#5425CB] border border-purple-200 font-mono">
                    {item.category}
                  </span>
                  {(item.severity === 'CRITICAL' || item.severity === 'HIGH') && (
                    <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                      Priority
                    </span>
                  )}
                </div>

                <h3 className="text-[15px] sm:text-[16px] font-bold text-[#1E162B] pt-1 leading-snug">
                  {item.headline}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-[#5C5270] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#E1DBEA]/70 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => navigate(item.link_path)}
                  className="text-[14px] sm:text-[15px] font-bold text-[#5425CB] hover:text-[#3B1599] inline-flex items-center gap-2 transition-colors cursor-pointer group"
                >
                  <span>{item.action_label}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
