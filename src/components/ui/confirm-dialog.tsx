'use client';

import React from 'react';
import { Modal } from './modal';
import { AlertTriangle, Trash2, Info, Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const icon = {
    danger: <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
    info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
  }[variant];

  const confirmBtnClass = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/30',
    info: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/30',
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      maxWidth="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 ${confirmBtnClass}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
        {message}
      </p>
    </Modal>
  );
}

