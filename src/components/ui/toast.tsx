'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Icon } from '@/components/magicpath/icons';

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
      duration = 3200,
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
      addToast({ type: 'error', title, message, duration: 5000 });
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
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', zIndex: 9999, left: '50%', bottom: '24px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', pointerEvents: 'none' }}>
          {toasts.map((t) => {
            const isError = t.type === 'error';
            const isSuccess = t.type === 'success';

            return (
              <div
                key={t.id}
                className="toast-message"
                style={{ position: 'relative', left: 'auto', bottom: 'auto', transform: 'none', pointerEvents: 'auto' }}
              >
                <span className={isError ? 'toast-error' : isSuccess ? 'toast-check' : 'toast-info'}>
                  <Icon name={isError ? 'close' : isSuccess ? 'check' : 'info'} size={12} strokeWidth={2.2} />
                </span>
                <span>{t.message}</span>
              </div>
            );
          })}
        </div>
      )}
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
