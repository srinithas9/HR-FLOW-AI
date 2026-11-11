import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-2xl border border-[#E2DBEB] z-10 overflow-hidden transform transition-all',
          maxWidthClasses[maxWidth]
        )}
      >
        <div className="flex items-center justify-between p-6 sm:p-7 border-b border-[#E2DBEB] bg-[#FAF8FE]">
          <div>
            <h3 id="modal-title" className="text-2xl sm:text-[26px] font-extrabold text-[#1E162B] tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-[15px] sm:text-[16px] text-[#5C5270] mt-1 font-medium">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#5C5270] hover:text-[#1E162B] hover:bg-[#EDE7FF] transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 sm:p-7 max-h-[calc(100vh-180px)] overflow-y-auto text-[15px] sm:text-[16px] leading-relaxed text-[#1E162B]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3.5 p-5 sm:p-6 bg-[#FAF8FE] border-t border-[#E2DBEB]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

