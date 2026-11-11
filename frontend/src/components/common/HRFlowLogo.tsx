import React from 'react';
import { cn } from '../../utils/cn';

export interface HRFlowLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  showText?: boolean;
}

export const HRFlowLogo: React.FC<HRFlowLogoProps> = ({
  className,
  size = 'md',
  variant = 'dark',
  showText = true,
}) => {
  const isLight = variant === 'light';

  const sizeClasses = {
    sm: {
      icon: 'w-7 h-7',
      text: 'text-lg',
      aiBadge: 'text-[10px] px-1.5 py-0.5',
    },
    md: {
      icon: 'w-9 h-9',
      text: 'text-2xl',
      aiBadge: 'text-xs px-2 py-0.5',
    },
    lg: {
      icon: 'w-11 h-11',
      text: 'text-3xl',
      aiBadge: 'text-sm px-2.5 py-0.5',
    },
  }[size];

  return (
    <div className={cn('inline-flex items-center gap-3 select-none', className)}>
      {/* 
        Clean Geometric Emblem:
        Interconnected fluid arc & person node representing employee lifecycle and continuous HR workflow.
        Solid Primary Violet (#6938EF) rounded squircle with crisp white geometric path.
      */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl bg-[#6938EF] text-white shadow-sm transition-transform duration-200 hover:scale-105 shrink-0',
          sizeClasses.icon
        )}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[62%] h-[62%]"
        >
          {/* Person Head Node */}
          <circle cx="11.5" cy="11.5" r="3.2" fill="#FFFFFF" />

          {/* Interconnected Flowing Process Loop (People to Journey) */}
          <path
            d="M6.5 22C6.5 17.5 9 16 12 16C15 16 16.5 17.5 18 19.5C19.5 21.5 21 22.5 23.5 22.5C26 22.5 27.5 20.5 27.5 17.5C27.5 14 25.5 11 22 11"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Secondary Process Node */}
          <circle cx="22" cy="11" r="2.2" fill="#EDE7FF" />
        </svg>
      </div>

      {/* Elegant Typography Wordmark */}
      {showText && (
        <div className="flex items-center gap-1.5 leading-none whitespace-nowrap">
          <span
            className={cn(
              'font-bold tracking-tight whitespace-nowrap',
              sizeClasses.text,
              isLight ? 'text-white' : 'text-[#24212E]'
            )}
          >
            HR Flow
          </span>
          <span
            className={cn(
              'font-semibold rounded-md uppercase tracking-wide whitespace-nowrap',
              sizeClasses.aiBadge,
              isLight
                ? 'bg-white/20 text-white backdrop-blur-sm'
                : 'bg-[#EDE7FF] text-[#6938EF]'
            )}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
};
