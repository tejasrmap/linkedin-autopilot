'use client';

import React from 'react';
import { Modal } from './modal';
import { Icon } from '@/components/magicpath/icons';

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
  const icon = variant === 'danger' ? (
    <span style={{ color: '#e05252', display: 'grid', placeItems: 'center' }}>
      <Icon name="shield" size={18} />
    </span>
  ) : (
    <span style={{ color: 'var(--brand)', display: 'grid', placeItems: 'center' }}>
      <Icon name="info" size={18} />
    </span>
  );

  const confirmBtnClass = variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary';

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
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmBtnClass}
          >
            {loading ? 'Please wait...' : confirmText}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
    </Modal>
  );
}
