import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-bold transition-colors select-none rounded-full shadow-2xs whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-slate-100 text-slate-800 border border-slate-200/80',
        brand: 'bg-[#EDE7FF] text-brand-900 border border-[#DCD0FF]',
        lavender: 'bg-[#DDD1FA] text-[#431DA7] border border-[#C5B2FF]',
        success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        warning: 'bg-amber-50 text-amber-900 border border-amber-200',
        danger: 'bg-rose-50 text-rose-800 border border-rose-200',
        info: 'bg-blue-50 text-blue-800 border border-blue-200',
      },
      size: {
        sm: 'text-[12px] sm:text-[13px] px-3 py-1 font-bold leading-tight',
        md: 'text-[13px] sm:text-[14px] px-3.5 py-1.5 font-bold leading-tight',
        lg: 'text-[14px] sm:text-[15px] px-4 py-2 font-bold leading-tight',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  dot,
  children,
  ...props
}) => {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success' && 'bg-status-success',
            variant === 'warning' && 'bg-status-warning',
            variant === 'danger' && 'bg-status-danger',
            variant === 'info' && 'bg-status-info',
            variant === 'brand' && 'bg-brand',
            variant === 'lavender' && 'bg-[#6938EF]',
            (!variant || variant === 'neutral') && 'bg-slate-500'
          )}
        />
      )}
      <span>{children}</span>
    </div>
  );
};

