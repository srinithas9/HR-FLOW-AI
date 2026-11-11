import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-[15px] sm:text-[16px] font-bold text-[#1E162B]">
            {label}
            {props.required && <span className="text-rose-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-4 flex items-center pointer-events-none text-[#5C5270]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full h-12 px-4 py-3 text-[15px] sm:text-[16px] text-[#1E162B] bg-white border rounded-xl shadow-xs transition-all duration-150',
              'placeholder:text-[#9B94A6] placeholder:font-normal',
              'focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB]',
              'disabled:bg-slate-50 disabled:text-[#9B94A6] disabled:cursor-not-allowed',
              error ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500' : 'border-[#E2DBEB]',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 flex items-center text-[#5C5270]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-[14px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p className="text-[14px] text-[#5C5270] font-medium mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

