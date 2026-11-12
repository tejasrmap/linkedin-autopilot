'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full ${maxWidthClass} rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 flex flex-col gap-4 max-h-[90vh]`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 truncate">
                {title}
              </h3>
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto text-xs leading-relaxed py-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

