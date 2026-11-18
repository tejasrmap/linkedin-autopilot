'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import {
  LayoutDashboard,
  PenSquare,
  Sparkles,
  Award,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  FolderOpen,
  BarChart3,
  Linkedin,
  Users,
  Bookmark,
  Settings,
  CreditCard,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const mainNavigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Studio', href: '/ai-studio', icon: Sparkles },
  { name: 'Certificate Post', href: '/ai-studio/certificate', icon: Award },
  { name: 'Content Calendar', href: '/calendar', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const contentNavigation = [
  { name: 'Scheduled', href: '/posts?tab=scheduled', icon: Clock },
  { name: 'Drafts', href: '/posts?tab=draft', icon: FileText },
  { name: 'Published', href: '/posts?tab=published', icon: CheckCircle2 },
  { name: 'Media Library', href: '/library', icon: FolderOpen },
];

const managementNavigation = [
  { name: 'LinkedIn Accounts', href: '/accounts', icon: Linkedin },
  { name: 'Team Workspace', href: '/team', icon: Users },
  { name: 'Templates', href: '/templates', icon: Bookmark },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Billing', href: '/billing', icon: CreditCard },
];

function NavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

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

  return (
    <>
      <nav className="space-y-1">
        {mainNavigation.map((item) => {
          const isActive = checkIsActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`app-nav-link group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'app-nav-active'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0 ${
                  isActive ? 'text-current' : 'text-slate-400'
                }`}
              />
              <span className="app-nav-label flex-1 truncate">{item.name}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 animate-in fade-in" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="pt-4">
        <div className="app-section-label text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
          <span>Your Content</span>
        </div>
        <nav className="space-y-1">
          {contentNavigation.map((item) => {
            const isActive = checkIsActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                className={`app-nav-link group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'app-nav-active'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-current' : 'text-slate-400'}`} />
                <span className="app-nav-label flex-1 truncate">{item.name}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 animate-in fade-in" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4">
        <div className="app-section-label text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
          <span>Manage</span>
        </div>
        <nav className="space-y-1">
          {managementNavigation.map((item) => {
            const isActive = checkIsActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`app-nav-link group flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'app-nav-active'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0 ${
                    isActive ? 'text-current' : 'text-slate-400'
                  }`}
                />
                <span className="flex-1 truncate">{item.name}</span>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-white/70 animate-in fade-in" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside className={`app-sidebar w-64 flex-shrink-0 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-xl h-screen sticky top-0 select-none z-30 transition-colors ${collapsed ? "is-collapsed" : ""}`}>
      {/* Brand Header */}
      <div className="app-brand h-16 flex items-center px-4 border-b border-slate-200/80 dark:border-slate-800/80 gap-3">
        <div className="app-brand-mark w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0">
          <GTInnoXLogo className="w-full h-full" />
        </div>
        <div className="app-brand-copy min-w-0 flex-1">
          <div className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-100">autopilot</div>
          <div className="text-[9px] font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">LinkedIn workspace</div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="app-sidebar-toggle hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      <Link href="/composer" title="New post" className="app-new-post">
        <PenSquare className="w-4 h-4 flex-shrink-0" />
        <span>New post</span>
        <kbd>N</kbd>
      </Link>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        <div>
          <div className="app-section-label text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-1.5 flex items-center justify-between">
            <span>Workspace</span>
          </div>
          <Suspense fallback={<div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800/40 rounded-xl" />}>
            <NavLinks />
          </Suspense>
        </div>
      </div>

      {/* Account footer */}
      <div className="app-sidebar-footer p-3 border-t border-slate-200/80 dark:border-slate-800/80">
        <Link href="/settings" className="app-profile-card flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
          <span className="app-profile-avatar grid place-items-center w-9 h-9 rounded-full bg-[#e8e7ff] text-[#5046a5] text-xs font-semibold">TG</span>
          <span className="app-profile-copy min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">Teja Ganugula</span>
            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">Pro workspace</span>
          </span>
          <Settings className="app-profile-settings w-4 h-4 text-slate-400" />
        </Link>
      </div>
    </aside>
  );
}
