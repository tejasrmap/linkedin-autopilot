'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Icon, IconName } from '@/components/magicpath/icons';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import { useWorkspace } from './workspace-context';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  badge?: string;
}

const navGroups: {
  label: string;
  items: NavItem[];
}[] = [
  {
    label: 'WORKSPACE',
    items: [
      { id: 'overview', label: 'Overview', icon: 'home', href: '/dashboard' },
      { id: 'ai', label: 'AI Studio', icon: 'sparkles', href: '/ai-studio' },
      { id: 'certificate', label: 'Certificate post', icon: 'award', href: '/ai-studio/certificate' },
      { id: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar' },
      { id: 'analytics', label: 'Analytics', icon: 'chart', href: '/analytics' },
    ],
  },
  {
    label: 'YOUR CONTENT',
    items: [
      { id: 'scheduled', label: 'Scheduled', icon: 'clock', href: '/posts?tab=scheduled' },
      { id: 'drafts', label: 'Drafts', icon: 'file', href: '/posts?tab=draft' },
      { id: 'published', label: 'Published', icon: 'check', href: '/posts?tab=published' },
      { id: 'library', label: 'Media library', icon: 'folder', href: '/library' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { id: 'accounts', label: 'LinkedIn accounts', icon: 'linkedin', href: '/accounts' },
      { id: 'team', label: 'Team', icon: 'users', href: '/team' },
      { id: 'templates', label: 'Templates', icon: 'bookmark', href: '/templates' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
      { id: 'billing', label: 'Plan & billing', icon: 'credit', href: '/billing' },
      { id: 'admin', label: 'Admin console', icon: 'shield', href: '/admin' },
      { id: 'legal', label: 'Privacy & terms', icon: 'file', href: '/privacy' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, userProfile, currentWs } =
    useWorkspace();
  const [profileMenu, setProfileMenu] = useState(false);

  const checkIsActive = (href: string) => {
    if (href.includes('?')) {
      const [itemPath, query] = href.split('?');
      if (pathname !== itemPath) return false;
      const params = new URLSearchParams(query);
      return currentTab === params.get('tab');
    }
    if (pathname === href) {
      if (href === '/posts' && currentTab) return false;
      return true;
    }
    return false;
  };

  const getInitials = (name?: string) => {
    if (!name) return 'TG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <aside
        className={`la-sidebar ${collapsed ? 'is-collapsed' : ''} ${
          mobileOpen ? 'mobile-open' : ''
        }`}
      >
        <div className="brand-row">
          <div
            className="brand-mark"
            style={{
              background: '#ffffff',
              border: '1px solid var(--line)',
              padding: '2px',
              borderRadius: '9px',
            }}
          >
            <GTInnoXLogo width={25} height={16} />
          </div>
          <div className="brand-text">
            <b>autopilot</b>
            <small>BY GT INNOX</small>
          </div>
          <button
            type="button"
            className="collapse-button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="panel" size={17} />
          </button>
        </div>

        <Link
          href="/composer"
          className="new-post-button"
          onClick={() => setMobileOpen(false)}
          style={{ textDecoration: 'none' }}
        >
          <Icon name="plus" size={17} />
          <span>New post</span>
          <kbd>N</kbd>
        </Link>

        <div className="sidebar-scroll">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = checkIsActive(item.href);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`nav-item ${active ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                    style={{ textDecoration: 'none' }}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                    {item.badge && <em>{item.badge}</em>}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="sidebar-footnote">
            <Icon name="shield" size={15} />
            <span>Your account is securely connected</span>
          </div>
        </div>

        {profileMenu && (
          <div className="profile-menu">
            <Link
              href="/settings"
              onClick={() => setProfileMenu(false)}
              style={{ textDecoration: 'none' }}
            >
              <button type="button">
                <Icon name="settings" size={15} /> Workspace settings
              </button>
            </Link>
            <Link
              href="/team"
              onClick={() => setProfileMenu(false)}
              style={{ textDecoration: 'none' }}
            >
              <button type="button">
                <Icon name="users" size={15} /> Team members
              </button>
            </Link>
            <Link
              href="/billing"
              onClick={() => setProfileMenu(false)}
              style={{ textDecoration: 'none' }}
            >
              <button type="button">
                <Icon name="credit" size={15} /> Billing &amp; plans
              </button>
            </Link>
            <button type="button" onClick={handleLogout} style={{ color: '#e05252' }}>
              <Icon name="close" size={15} /> Sign out
            </button>
          </div>
        )}

        <div className="sidebar-profile">
          <div className="profile-avatar small" style={{ overflow: 'hidden' }}>
            {userProfile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userProfile.avatar_url}
                alt={userProfile.full_name || 'Profile'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              getInitials(userProfile?.full_name)
            )}
          </div>
          <div className="profile-user">
            <b>{userProfile?.full_name || userProfile?.email?.split('@')[0] || 'My Account'}</b>
            <small>{currentWs?.name || 'Workspace'}</small>
          </div>
          <button
            type="button"
            className="plain-icon"
            onClick={() => setProfileMenu((v) => !v)}
            aria-label="Profile menu"
          >
            <Icon name="more" size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}
