'use client';

import React from 'react';
import Link from 'next/link';
import { Icon, IconName } from './icons';

export type Screen =
  | 'overview'
  | 'ai'
  | 'certificate'
  | 'composer'
  | 'calendar'
  | 'scheduled'
  | 'drafts'
  | 'published'
  | 'analytics'
  | 'library'
  | 'accounts'
  | 'team'
  | 'templates'
  | 'settings'
  | 'billing'
  | 'admin'
  | 'legal'
  | 'login'
  | 'register';

export const pageCopy: Record<
  Screen,
  {
    title: string;
    subtitle: string;
  }
> = {
  overview: {
    title: 'Overview',
    subtitle: 'Your LinkedIn workspace, at a glance.',
  },
  ai: {
    title: 'AI Studio',
    subtitle: 'Turn a rough thought into a post that sounds like you.',
  },
  certificate: {
    title: 'Certificate announcement',
    subtitle: 'Turn a credential into a thoughtful, editable LinkedIn post.',
  },
  composer: {
    title: 'Create a post',
    subtitle: 'Write, review, and schedule your next LinkedIn update.',
  },
  calendar: {
    title: 'Content calendar',
    subtitle: 'Plan a steady rhythm for your LinkedIn presence.',
  },
  scheduled: {
    title: 'Scheduled posts',
    subtitle: 'Everything queued for the days ahead.',
  },
  drafts: {
    title: 'Drafts',
    subtitle: 'Ideas in progress, ready when you are.',
  },
  published: {
    title: 'Published posts',
    subtitle: 'A history of what you’ve shared.',
  },
  analytics: {
    title: 'Analytics',
    subtitle: 'Understand what resonates with your audience.',
  },
  library: {
    title: 'Media library',
    subtitle: 'Images and assets for your next story.',
  },
  accounts: {
    title: 'LinkedIn accounts',
    subtitle: 'Manage where your content gets published.',
  },
  team: {
    title: 'Team workspace',
    subtitle: 'Create together and keep reviews moving.',
  },
  templates: {
    title: 'Templates',
    subtitle: 'A few thoughtful starting points for your next post.',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Make your workspace feel like yours.',
  },
  billing: {
    title: 'Plan & billing',
    subtitle: 'Your plan, usage, and payment details.',
  },
  admin: {
    title: 'Workspace admin',
    subtitle: 'A clear view of workspace health and publishing activity.',
  },
  legal: {
    title: 'Privacy & terms',
    subtitle: 'Understand how your workspace and content are handled.',
  },
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to continue to your LinkedIn workspace.',
  },
  register: {
    title: 'Create your workspace',
    subtitle: 'Start planning a more consistent LinkedIn presence.',
  },
};

export function ActionButton({
  children,
  kind = 'primary',
  onClick,
  disabled = false,
  className = '',
  type = 'button',
}: {
  children: React.ReactNode;
  kind?: 'primary' | 'secondary' | 'quiet';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) {
  return (
    <button
      type={type}
      className={`btn btn-${kind} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function IdeaCard({
  title,
  hook,
  onUse,
}: {
  title: string;
  hook: string;
  onUse: () => void;
}) {
  return (
    <article className="idea-result-card">
      <div>
        <b>{title}</b>
        <p>{hook}</p>
      </div>
      <button type="button" className="text-button" onClick={onUse}>
        Use idea <Icon name="arrow" size={14} />
      </button>
    </article>
  );
}

export function StatusPill({ children }: { children: string }) {
  const statusLower = children.toLowerCase();
  return (
    <span className={`status-pill status-${statusLower}`}>
      <i />
      {children}
    </span>
  );
}

export function PageHeader({
  screen,
  title,
  subtitle,
  action,
  actionHref,
  onAction,
  actionIcon = 'plus',
  children,
}: {
  screen?: Screen;
  title?: string;
  subtitle?: string;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
  actionIcon?: IconName;
  children?: React.ReactNode;
}) {
  const meta = screen ? pageCopy[screen] : null;
  const resolvedTitle = title || meta?.title || '';
  const resolvedSubtitle = subtitle || meta?.subtitle || '';
  const eyebrowLabel =
    screen === 'overview'
      ? 'WORKSPACE'
      : (screen ? meta?.title.toUpperCase() : resolvedTitle.toUpperCase());

  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          LINKEDIN AUTOPILOT <span> / </span> {eyebrowLabel}
        </div>
        <h1>{resolvedTitle}</h1>
        {resolvedSubtitle && <p>{resolvedSubtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {children}
        {action &&
          (actionHref ? (
            <Link href={actionHref} className="btn btn-primary" style={{ textDecoration: 'none' }}>
              <Icon name={actionIcon} size={16} />
              {action}
            </Link>
          ) : (
            <ActionButton onClick={onAction}>
              <Icon name={actionIcon} size={16} />
              {action}
            </ActionButton>
          ))}
      </div>
    </div>
  );
}

export interface PostItem {
  id?: string;
  title: string;
  status: string;
  time: string;
  type: string;
  color?: string;
}

export function PostRow({
  post,
  onClick,
  href,
}: {
  post: PostItem;
  onClick?: () => void;
  href?: string;
}) {
  const statusLower = post.status.toLowerCase();
  const iconName: IconName =
    statusLower === 'published' ? 'check' : statusLower === 'scheduled' ? 'clock' : 'file';
  const colorClass =
    post.color ||
    (statusLower === 'published'
      ? 'blue'
      : statusLower === 'scheduled'
      ? 'violet'
      : 'mint');

  const content = (
    <>
      <span className={`post-mark mark-${colorClass}`}>
        <Icon name={iconName} size={16} />
      </span>
      <span className="post-copy">
        <strong>{post.title}</strong>
        <small>
          {post.time} <span>·</span> {post.type}
        </small>
      </span>
      <StatusPill>{post.status}</StatusPill>
      <Icon name="chevron" size={16} />
    </>
  );

  if (href) {
    return (
      <Link href={href} className="post-row" style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="post-row" onClick={onClick}>
      {content}
    </button>
  );
}
