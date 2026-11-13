'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SupportModal } from '@/components/support/support-modal';
import {
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Building,
  User,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Plus,
  Check,
  Settings,
  Users,
  CreditCard,
  Loader2,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { AppNotification } from '@/types';

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'all' | 'unread'>('all');

  const [workspaces, setWorkspaces] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_workspaces');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [currentWs, setCurrentWs] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_current_ws');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return { name: "Lead Developer (GT InnoX)'s Workspace", id: '3af1cc83-b7e7-4ce6-b422-d84d326aaf31' };
  });
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showCreateWsModal, setShowCreateWsModal] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);

  const [userProfile, setUserProfile] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return { full_name: 'Teja Ganugula', email: 'tejag.vijay@gmail.com' };
  });
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Parallelize non-blocking profile and notifications revalidation
    Promise.allSettled([fetchProfileAndWorkspaces(), fetchNotifications()]);

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

  const fetchProfileAndWorkspaces = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
        setWorkspaces(data.workspaces || []);
        const active = (data.workspaces || []).find((w: any) => w.id === data.currentWorkspaceId) || data.workspaces?.[0];
        const resolvedWs = active || { name: "Lead Developer (GT InnoX)'s Workspace", id: '3af1cc83-b7e7-4ce6-b422-d84d326aaf31' };
        setCurrentWs(resolvedWs);

        // Cache for 0ms instant display on subsequent refreshes
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_workspaces', JSON.stringify(data.workspaces || []));
          sessionStorage.setItem('autopilot_current_ws', JSON.stringify(resolvedWs));
          sessionStorage.setItem('autopilot_user', JSON.stringify(data.user || {}));
        }
      }
    } catch {
      // Retain existing state
    }
  };

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
      await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: 'POST' })));
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
      await fetchProfileAndWorkspaces();
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

  return (
    <header
      ref={navRef}
      className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors"
    >
      {/* Left: Workspace Selector & Menu */}
      <div className="relative">
        <button
          onClick={() => {
            setShowWorkspaceMenu(!showWorkspaceMenu);
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800/90 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition-all"
        >
          <div className="w-5 h-5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Building className="w-3 h-3" />
          </div>
          <span className="max-w-[130px] sm:max-w-[200px] truncate">{currentWs?.name || 'Main Workspace'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              showWorkspaceMenu ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Workspace Dropdown */}
        {showWorkspaceMenu && (
          <div className="absolute left-0 top-11 w-64 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Workspaces
            </div>

            <div className="space-y-1 max-h-52 overflow-y-auto py-1">
              {workspaces.length === 0 ? (
                <div className="px-3 py-2 text-slate-400 text-[11px]">No other workspaces</div>
              ) : (
                workspaces.map((ws) => {
                  const isActive = ws.id === currentWs?.id;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => handleSwitchWorkspace(ws)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{ws.name}</span>
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1 space-y-1">
              <button
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowCreateWsModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
              <Link
                href="/settings"
                onClick={() => setShowWorkspaceMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Workspace Settings</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 relative">
        {/* Quick Post Button */}
        <Link
          href="/composer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>New Post</span>
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Support & Feedback Trigger */}
        <button
          onClick={() => {
            setShowSupport(true);
            setShowNotifications(false);
            setShowWorkspaceMenu(false);
            setShowUserMenu(false);
          }}
          aria-label="Help & Support"
          title="Customer Support & Feedback"
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Notifications Popover Toggle */}
        <button
          onClick={() => {
            setShowNotifications(!showNotifications);
            setShowWorkspaceMenu(false);
            setShowUserMenu(false);
          }}
          aria-label="Notifications"
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-blue-600 text-white text-[10px] font-bold px-1 flex items-center justify-center shadow-md shadow-blue-500/30 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown Card */}
        {showNotifications && (
          <div className="absolute top-12 right-12 w-80 sm:w-96 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-2 pb-1">
              <button
                onClick={() => setActiveNotifTab('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeNotifTab === 'all'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveNotifTab('unread')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeNotifTab === 'unread'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto py-2 space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <Bell className="w-5 h-5 mx-auto opacity-30" />
                  <p>No notifications found.</p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const isUnread = !n.read_at;
                  return (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-3 rounded-xl text-xs cursor-pointer transition-all border ${
                        isUnread
                          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-900/60 shadow-sm'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'error' && <XCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                            <span className="truncate">{n.title}</span>
                            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0"></span>}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowWorkspaceMenu(false);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-blue-500/20">
              {userProfile?.full_name ? userProfile.full_name[0].toUpperCase() : 'T'}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 hidden md:inline max-w-[110px] truncate">
              {userProfile?.full_name || 'Teja Ganugula'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                showUserMenu ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-11 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
              {/* User Bio Header */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 mb-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {userProfile?.full_name || 'Teja Ganugula'}
                  </div>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Owner
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {userProfile?.email || 'tejag.vijay@gmail.com'}
                </div>
              </div>

              {/* Menu Links */}
              <div className="space-y-0.5 py-1">
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Settings</span>
                </Link>

                <Link
                  href="/team"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Team &amp; Roles</span>
                </Link>

                <Link
                  href="/billing"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  <span>Billing &amp; Plan</span>
                </Link>
              </div>

              {/* Sign Out */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Workspace Modal */}
      <Modal
        isOpen={showCreateWsModal}
        onClose={() => setShowCreateWsModal(false)}
        title="Create New Workspace"
        description="Organize posts, permissions, and LinkedIn destinations in an isolated team space."
        icon={<Building className="w-5 h-5" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreateWsModal(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateWorkspace}
              disabled={creatingWs || !newWsName.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {creatingWs && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Workspace
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateWorkspace} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Workspace Name *
            </label>
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="e.g. Acme Marketing, Enterprise Social..."
              required
              autoFocus
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-xs"
            />
          </div>
        </form>
      </Modal>

      <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
    </header>
  );
}
