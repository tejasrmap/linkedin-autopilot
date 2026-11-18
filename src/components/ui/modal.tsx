'use client';

import React, { useEffect } from 'react';
import { Icon } from '@/components/magicpath/icons';

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

  const sizeClass = {
    sm: 'modal-sm',
    md: '',
    lg: 'modal-lg',
    xl: 'modal-xl',
    '2xl': 'modal-xl',
  }[maxWidth] || '';

  return (
    <div
      className="magicpath-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`magicpath-modal ${sizeClass}`}>
        {/* Header */}
        <div className="magicpath-modal-header">
          <div className="magicpath-modal-title">
            {icon && <span style={{ display: 'grid', placeItems: 'center' }}>{icon}</span>}
            <div>
              <h3>{title}</h3>
              {description && <p>{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="plain-icon"
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="magicpath-modal-body">{children}</div>

        {/* Footer */}
        {footer && <div className="magicpath-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
