'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title?: string; message: string; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      type = 'info',
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title = 'Success') => {
      addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, title = 'Error') => {
      addToast({ type: 'error', title, message, duration: 6000 });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, title = 'Note') => {
      addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const icon = {
            success: <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />,
            info: <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />,
          }[t.type];

          const borderColor = {
            success: 'border-emerald-500/20 bg-white/95 dark:bg-[#0f172a]/95 text-slate-800 dark:text-slate-100',
            error: 'border-rose-500/20 bg-white/95 dark:bg-[#0f172a]/95 text-slate-800 dark:text-slate-100',
            info: 'border-blue-500/20 bg-white/95 dark:bg-[#0f172a]/95 text-slate-800 dark:text-slate-100',
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-5 fade-in duration-200 flex items-start gap-3 ${borderColor}`}
            >
              {icon}
              <div className="flex-1 min-w-0 text-xs">
                {t.title && (
                  <div className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    {t.title}
                  </div>
                )}
                <div className="text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
                  {t.message}
                </div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="w-5 h-5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

