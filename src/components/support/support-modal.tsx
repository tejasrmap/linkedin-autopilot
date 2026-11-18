'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/magicpath/icons';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const toast = useToast();
  const [category, setCategory] = useState<'publishing' | 'ai_generation' | 'scheduling' | 'accounts' | 'billing' | 'general'>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both the subject and message.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, message, priority }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit ticket');

      toast.success('Support ticket sent to GT InnoX Engineering!');
      setSubject('');
      setMessage('');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="GT InnoX Support & Feedback"
      description="Need assistance or have feedback? Our team responds within 24 hours."
      icon={<Icon name="info" size={18} />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label className="field-label" htmlFor="ticket-category">Category</label>
            <select
              id="ticket-category"
              className="ai-text-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              <option value="general">General Inquiry</option>
              <option value="ai_generation">AI Content Studio</option>
              <option value="publishing">LinkedIn Publishing</option>
              <option value="scheduling">Calendar &amp; Scheduling</option>
              <option value="accounts">LinkedIn Accounts &amp; OAuth</option>
              <option value="billing">Plan &amp; Billing</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ticket-priority">Priority</label>
            <select
              id="ticket-priority"
              className="ai-text-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="ticket-subject">Subject</label>
          <input
            id="ticket-subject"
            type="text"
            className="ai-text-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your question or issue"
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="ticket-message">Description</label>
          <textarea
            id="ticket-message"
            className="large-textarea"
            style={{ minHeight: '110px' }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Please describe what you are experiencing in detail..."
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !subject.trim() || !message.trim()}
          >
            <Icon name="send" size={14} />
            <span>{submitting ? 'Sending...' : 'Submit ticket'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
