import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  FileCheck2,
  Clock,
  Award,
  TrendingUp,
  UserMinus,
  ChevronRight,
} from 'lucide-react';
import { DashboardLifecycleStages } from '../../types/dashboard';

interface LifecyclePipelineProps {
  lifecycle: DashboardLifecycleStages;
  isLoading?: boolean;
}

export const LifecyclePipeline: React.FC<LifecyclePipelineProps> = ({ lifecycle, isLoading }) => {
  const navigate = useNavigate();

  // Logical employee lifecycle sequence:
  // Onboarding -> Documentation -> Probation -> Confirmation -> Performance Reviews -> Offboarding
  const stages = [
    {
      id: 'onboarding',
      name: 'Onboarding',
      count: lifecycle.onboarding_active,
      statusLabel: 'In Progress',
      icon: UserPlus,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      link: '/lifecycle/onboarding',
    },
    {
      id: 'documentation',
      name: 'Documentation',
      count: lifecycle.documentation_pending,
      statusLabel: lifecycle.documentation_pending === 0 ? 'All Verified' : 'Pending',
      icon: FileCheck2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      link: '/lifecycle/documentation',
    },
    {
      id: 'probation',
      name: 'Probation',
      count: lifecycle.probation_active,
      statusLabel: 'Under Review',
      icon: Clock,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      link: '/lifecycle/probation',
    },
    {
      id: 'confirmation',
      name: 'Confirmation',
      count: lifecycle.confirmation_pending,
      statusLabel: 'Pending Sign-off',
      icon: Award,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      link: '/lifecycle/confirmation',
    },
    {
      id: 'performance',
      name: 'Performance Reviews',
      count: lifecycle.performance_reviews_in_progress,
      statusLabel: lifecycle.performance_reviews_in_progress === 0 ? 'Concluded' : 'Active Cycle',
      icon: TrendingUp,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      link: '/lifecycle/performance-reviews',
    },
    {
      id: 'offboarding',
      name: 'Offboarding',
      count: lifecycle.offboarding_in_progress,
      statusLabel: 'In Progress',
      icon: UserMinus,
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      link: '/lifecycle/offboarding',
    },
  ];

  return (
    <div className="bg-white border border-[#E2DBEB] rounded-2xl p-6 sm:p-7 shadow-2xs space-y-5 w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-xl sm:text-[22px] font-extrabold text-[#1E162B] tracking-tight">
            Employee Lifecycle Pipeline
          </h2>
          <p className="text-[14px] sm:text-[15px] text-[#5C5270] font-medium mt-0.5">
            Active employee progression across all six operational lifecycle stages
          </p>
        </div>
      </div>

      {/* 6 Stage Responsive Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              onClick={() => navigate(stage.link)}
              className="group bg-[#FAF8FE]/80 hover:bg-white rounded-2xl border border-[#E2DBEB] hover:border-[#5425CB]/50 p-5 min-h-[156px] flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <div>
                {/* Top: Icon Badge on left & Prominent Count on right */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${stage.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-2xl sm:text-[28px] font-extrabold font-mono text-[#1E162B]">
                    {isLoading ? '—' : stage.count}
                  </div>
                </div>

                {/* Middle: Full-width Stage Name (never squished by icon) */}
                <div className="min-h-[38px] flex items-center">
                  <span className="text-[13.5px] sm:text-[14px] font-bold text-[#1E162B] group-hover:text-[#5425CB] transition-colors leading-snug line-clamp-2" title={stage.name}>
                    {stage.name}
                  </span>
                </div>
              </div>

              {/* Bottom: Status Subtext & Link Indicator */}
              <div className="mt-3 pt-2.5 border-t border-[#E2DBEB] flex items-center justify-between text-[12px] sm:text-[12.5px] gap-1.5">
                <span className="text-[#5C5270] font-semibold truncate">
                  {stage.statusLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#5425CB] whitespace-nowrap group-hover:translate-x-0.5 transition-transform shrink-0">
                  <ChevronRight className="w-4 h-4 text-[#5425CB]" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
