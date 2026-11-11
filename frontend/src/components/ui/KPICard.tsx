import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  indicator?: string;
  indicatorColor?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  unit?: string;
  className?: string;
  onClick?: () => void;
  accent?: 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'neutral';
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  indicator,
  indicatorColor,
  icon: Icon,
  trend,
  unit,
  className,
  onClick,
  accent = 'neutral',
}) => {
  const accentStyles = {
    violet: 'border-l-4 border-l-[#6938EF]',
    emerald: 'border-l-4 border-l-emerald-600',
    amber: 'border-l-4 border-l-amber-500',
    rose: 'border-l-4 border-l-rose-500',
    blue: 'border-l-4 border-l-blue-600',
    neutral: '',
  }[accent];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative min-h-[156px] sm:min-h-[164px] p-6 rounded-2xl bg-white border border-[#E2DBEB] shadow-xs hover:border-[#C5B2FF] hover:shadow-card-refined transition-all duration-200 flex flex-col justify-between overflow-hidden',
        onClick && 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0',
        accentStyles,
        className
      )}
    >
      {/* Top Row: Short uppercase label + Restrained Icon / Indicator */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] sm:text-[15px] font-bold uppercase tracking-wider text-[#5C5270] truncate">
          {title}
        </span>
        {Icon ? (
          <div className="w-10 h-10 rounded-xl bg-[#EDE7FF] border border-[#DCD0FF] flex items-center justify-center text-[#5425CB] shrink-0 group-hover:bg-[#DDD1FA] transition-colors">
            <Icon className="w-5 h-5" />
          </div>
        ) : indicator ? (
          <span
            className={cn(
              'text-[13px] font-bold px-3 py-0.5 rounded-full shrink-0 border select-none',
              indicatorColor || 'bg-[#EDE7FF] text-[#5425CB] border-[#DCD0FF]'
            )}
          >
            {indicator}
          </span>
        ) : null}
      </div>

      {/* Middle Row: Large, bold numeric value + Optional unit */}
      <div className="my-auto pt-3 flex items-baseline gap-2.5">
        <span className="text-3xl sm:text-[36px] font-extrabold tracking-tight text-[#1E162B] font-mono leading-none">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-bold text-[#827799] uppercase tracking-wide">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Row: Restrained status or trend indicator (no bloated paragraphs) */}
      <div className="pt-2 flex items-center justify-between text-sm text-[#5C5270] min-h-[22px]">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-bold text-[13px] sm:text-[14px]',
              trend.isPositive ? 'text-emerald-700' : 'text-rose-700'
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : (
              <TrendingDown className="w-4 h-4 shrink-0" />
            )}
            <span>{trend.value}</span>
            {trend.label && <span className="text-[#827799] font-medium">{trend.label}</span>}
          </span>
        )}
        {!trend && indicator && Icon && (
          <span
            className={cn(
              'text-[13px] font-bold px-2.5 py-0.5 rounded-md border',
              indicatorColor || 'bg-[#F5F1FF] text-[#5425CB] border-[#E2DBEB]'
            )}
          >
            {indicator}
          </span>
        )}
        {!trend && !indicator && subtitle && (
          <span className="text-[13px] sm:text-[14px] text-[#827799] font-medium truncate">{subtitle}</span>
        )}
      </div>
    </div>
  );
};

