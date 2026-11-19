'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SupportModal } from '@/components/support/support-modal';
import { Icon } from '@/components/magicpath/icons';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import { useWorkspace } from './workspace-context';
import { AppNotification } from '@/types';

export function TopNav() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const {
    setMobileOpen,
    workspaces,
    currentWs,
    setCurrentWs,
    userProfile,
    refreshWorkspaces,
  } = useWorkspace();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'all' | 'unread'>('all');

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Silent catch
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read_at);
      await Promise.all(
        unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }))
      );
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      toast.success('All notifications marked as read');
    } catch {
      // Silent
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setCreatingWs(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newWsName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create workspace');
      }

      const data = await res.json();
      toast.success(`Workspace "${newWsName}" created successfully!`);
      setNewWsName('');
      setShowCreateWsModal(false);
      await refreshWorkspaces();
      if (data.workspace) {
        setCurrentWs(data.workspace);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingWs(false);
    }
  };

  const handleSwitchWorkspace = (ws: any) => {
    setCurrentWs(ws);
    setShowWorkspaceMenu(false);
    toast.info(`Switched to ${ws.name}`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const filteredNotifications =
    activeNotifTab === 'unread' ? notifications.filter((n) => !n.read_at) : notifications;

  const getContextLabel = () => {
    if (pathname.startsWith('/dashboard')) return 'Overview';
    if (pathname.startsWith('/ai-studio/certificate')) return 'Certificate announcement';
    if (pathname.startsWith('/ai-studio')) return 'AI Studio';
    if (pathname.startsWith('/composer')) return 'Composer';
    if (pathname.startsWith('/calendar')) return 'Content calendar';
    if (pathname.startsWith('/posts')) return 'Your content';
    if (pathname.startsWith('/library')) return 'Media library';
    if (pathname.startsWith('/analytics')) return 'Analytics';
    if (pathname.startsWith('/accounts')) return 'LinkedIn accounts';
    if (pathname.startsWith('/team')) return 'Team workspace';
    if (pathname.startsWith('/templates')) return 'Templates';
    if (pathname.startsWith('/settings')) return 'Settings';
    if (pathname.startsWith('/billing')) return 'Plan & billing';
    if (pathname.startsWith('/admin')) return 'Admin console';
    if (pathname.startsWith('/privacy') || pathname.startsWith('/terms')) return 'Legal & Privacy';
    return 'LinkedIn content workspace';
  };

  const getInitials = (name?: string) => {
    if (!name) return 'TG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const wsDotLetter = (currentWs?.name?.[0] || 'G').toUpperCase();

  return (
    <header className="la-topbar" ref={navRef}>
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Icon name="menu" size={19} />
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="workspace-switch"
            onClick={() => {
              setShowWorkspaceMenu(!showWorkspaceMenu);
              setShowNotifications(false);
              setShowUserMenu(false);
            }}
          >
            <span
              className="workspace-dot"
              style={{
                background: '#ffffff',
                border: '1px solid var(--line)',
                overflow: 'hidden',
                padding: '2px',
              }}
            >
              <GTInnoXLogo width={16} height={11} />
            </span>
            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentWs?.name || 'GT InnoX'}
            </span>
            <Icon name="chevron" size={14} />
          </button>

          {showWorkspaceMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                width: '260px',
                zIndex: 40,
                padding: '6px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'var(--muted)',
                  letterSpacing: '.1em',
                  padding: '6px 8px',
                  textTransform: 'uppercase',
                }}
              >
                Workspaces
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => handleSwitchWorkspace(ws)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      background: currentWs?.id === ws.id ? 'var(--sidebar)' : 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: 'var(--ink)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.name}
                    </span>
                    {currentWs?.id === ws.id && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowWorkspaceMenu(false);
                    setShowCreateWsModal(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: 'var(--brand)',
                    fontWeight: 600,
                  }}
                >
                  <Icon name="plus" size={14} /> Create workspace
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="topbar-divider" />
        <span className="topbar-context">{getContextLabel()}</span>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="topbar-icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-icon notification-button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowWorkspaceMenu(false);
              setShowUserMenu(false);
            }}
            aria-label="Notifications"
          >
            <Icon name="bell" size={17} />
            {unreadCount > 0 && <i />}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '320px',
                zIndex: 40,
                padding: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px 10px',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <b style={{ fontSize: '12px' }}>Notifications</b>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'var(--brand)',
                      fontSize: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '4px', padding: '6px 8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('all')}
                  style={{
                    border: 0,
                    borderRadius: '5px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    background: activeNotifTab === 'all' ? 'var(--sidebar)' : 'transparent',
                    color: 'var(--ink)',
                    fontWeight: activeNotifTab === 'all' ? 600 : 400,
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNotifTab('unread')}
                  style={{
                    border: 0,
                    borderRadius: '5px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    background: activeNotifTab === 'unread' ? 'var(--sidebar)' : 'transparent',
                    color: 'var(--ink)',
                    fontWeight: activeNotifTab === 'unread' ? 600 : 400,
                  }}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {filteredNotifications.length === 0 ? (
                  <div
                    style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: 'var(--muted)',
                      fontSize: '11px',
                    }}
                  >
                    You’re all caught up.
                  </div>
                ) : (
                  filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read_at && markAsRead(n.id)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        background: n.read_at ? 'transparent' : 'var(--brand-soft)',
                        marginBottom: '4px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{n.title}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '10px', marginTop: '2px' }}>
                        {n.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-avatar"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowWorkspaceMenu(false);
              setShowNotifications(false);
            }}
            style={{ border: 0, cursor: 'pointer', overflow: 'hidden', padding: 0 }}
          >
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
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '210px',
                zIndex: 40,
                padding: '6px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid var(--line)' }}>
                <b style={{ fontSize: '11px', display: 'block' }}>
                  {userProfile?.full_name || userProfile?.email?.split('@')[0] || 'My Account'}
                </b>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                  {userProfile?.email || ''}
                </small>
              </div>
              <div style={{ paddingTop: '4px' }}>
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--ink)',
                    textDecoration: 'none',
                  }}
                >
                  <Icon name="settings" size={14} /> Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowSupport(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'transparent',
                    fontSize: '11px',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Icon name="info" size={14} /> Help &amp; Support
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'transparent',
                    fontSize: '11px',
                    color: '#e05252',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <Icon name="close" size={14} /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />

      <Modal
        isOpen={showCreateWsModal}
        onClose={() => setShowCreateWsModal(false)}
        title="Create New Workspace"
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="new-ws-name">
              Workspace Name
            </label>
            <input
              id="new-ws-name"
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="e.g. Acme Marketing, Personal Brand"
              className="ai-text-input"
              required
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreateWsModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingWs || !newWsName.trim()}
            >
              {creatingWs ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </Modal>
    </header>
  );
}
