import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className,
  onClose,
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-status-warning shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-status-danger shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-status-info shrink-0" />;
    }
  };

  const getStyle = () => {
    switch (variant) {
      case 'success':
        return 'bg-status-success-bg border-status-success-border text-emerald-950';
      case 'warning':
        return 'bg-status-warning-bg border-status-warning-border text-amber-950';
      case 'error':
        return 'bg-status-danger-bg border-status-danger-border text-rose-950';
      case 'info':
      default:
        return 'bg-status-info-bg border-status-info-border text-sky-950';
    }
  };

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3.5 p-4 border rounded-xl text-[14px] shadow-xs transition-all duration-150',
        getStyle(),
        className
      )}
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-bold text-[15px] leading-tight mb-1">{title}</h5>}
        <div className="text-[14px] leading-relaxed text-[#292238]">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

