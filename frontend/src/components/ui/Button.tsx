import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6938EF]/30 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none rounded-xl whitespace-nowrap cursor-pointer active:scale-[0.99] shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-[#431DA7] active:bg-[#341487] shadow-sm hover:shadow-md border border-transparent',
        action: 'bg-[#6938EF] text-white hover:bg-[#5425CB] active:bg-[#431DA7] shadow-sm border border-transparent',
        secondary: 'bg-[#EDE7FF] text-[#5425CB] hover:bg-[#DCD0FF] hover:text-[#431DA7] active:bg-[#C5B2FF] border border-[#DCD0FF]/60',
        outline: 'border border-[#DCD5E8] bg-white text-[#1E162B] hover:bg-[#FAF8FE] hover:text-[#5425CB] hover:border-[#C5B2FF] active:bg-[#EDE7FF] shadow-xs',
        ghost: 'text-[#5C5270] hover:text-[#1E162B] hover:bg-[#EDE7FF]/60 active:bg-[#DCD0FF]/50 border border-transparent',
        danger: 'bg-status-danger text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm border border-transparent',
        'danger-outline': 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-400 active:bg-rose-100',
      },
      size: {
        sm: 'h-10 px-4 text-[14px] sm:text-[15px] gap-2 rounded-xl min-w-[84px]',
        md: 'h-11 sm:h-12 px-5 sm:px-6 text-[15px] sm:text-[16px] gap-2.5 rounded-xl min-w-[104px]',
        lg: 'h-13 px-7 text-[16px] sm:text-[17px] gap-3 rounded-xl min-w-[124px]',
        icon: 'h-11 w-11 p-0 rounded-xl',
        'icon-sm': 'h-10 w-10 p-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, icon, children, disabled, ...props }, ref) => {
    const effectiveLeftIcon = leftIcon || icon;
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          effectiveLeftIcon && <span className="shrink-0 flex items-center justify-center">{effectiveLeftIcon}</span>
        )}
        {children && <span className="truncate">{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center justify-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

