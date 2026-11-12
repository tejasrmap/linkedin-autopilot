'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-provider';
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
} from 'lucide-react';
import { AppNotification } from '@/types';

export function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [currentWs, setCurrentWs] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetchProfileAndWorkspaces();
    fetchNotifications();
  }, []);

  const fetchProfileAndWorkspaces = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
        setWorkspaces(data.workspaces || []);
        const active = (data.workspaces || []).find((w: any) => w.id === data.currentWorkspaceId) || data.workspaces?.[0];
        setCurrentWs(active || { name: 'Main Workspace' });
      }
    } catch {
      // Offline or initial state
      setCurrentWs({ name: 'Default Workspace' });
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0e1424]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Workspace Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <Building className="w-4 h-4 text-blue-500" />
          <span>{currentWs?.name || 'Workspace'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 relative">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notifications Button */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label="Notifications"
          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {showNotifications && (
          <div className="absolute top-12 right-12 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto py-2 space-y-2">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.read_at;
                  return (
                    <div
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors border ${
                        isUnread
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'error' && <XCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{n.title}</div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</div>
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

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
              {userProfile?.full_name ? userProfile.full_name[0].toUpperCase() : 'U'}
            </div>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:inline max-w-[100px] truncate">
              {userProfile?.full_name || userProfile?.email || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-11 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl py-1 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <div className="font-semibold text-slate-800 dark:text-slate-200">{userProfile?.full_name || 'Member'}</div>
                <div className="text-slate-400 truncate">{userProfile?.email || 'admin@gtinnox.com'}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

