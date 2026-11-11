import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, helperText, id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-2">
        {label && (
          <label htmlFor={selectId} className="block text-[15px] sm:text-[16px] font-bold text-[#1E162B]">
            {label}
            {props.required && <span className="text-rose-600 ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full h-12 pl-4 pr-11 py-3 text-[15px] sm:text-[16px] font-medium text-[#1E162B] bg-white border rounded-xl shadow-xs appearance-none transition-all duration-150 cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-[#5425CB]/20 focus:border-[#5425CB]',
              'disabled:bg-slate-50 disabled:text-[#9B94A6] disabled:cursor-not-allowed',
              error ? 'border-rose-400 focus:ring-rose-500/20' : 'border-[#E2DBEB]',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 flex items-center pointer-events-none text-[#5C5270]">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
        {error && <p className="text-[14px] text-rose-600 font-semibold mt-1">{error}</p>}
        {!error && helperText && <p className="text-[14px] text-[#5C5270] font-medium mt-1">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

