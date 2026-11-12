'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PenSquare,
  Sparkles,
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
  ShieldCheck,
} from 'lucide-react';

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Create Post', href: '/composer', icon: PenSquare, highlight: true },
  { name: 'AI Studio', href: '/ai-studio', icon: Sparkles, badge: 'AI' },
  { name: 'Content Calendar', href: '/calendar', icon: Calendar },
  { name: 'Scheduled Posts', href: '/posts?tab=scheduled', icon: Clock },
  { name: 'Drafts', href: '/posts?tab=draft', icon: FileText },
  { name: 'Published Posts', href: '/posts?tab=published', icon: CheckCircle2 },
  { name: 'Content Library', href: '/library', icon: FolderOpen },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const managementNavigation = [
  { name: 'LinkedIn Accounts', href: '/accounts', icon: Linkedin },
  { name: 'Team Workspace', href: '/team', icon: Users },
  { name: 'Templates', href: '/templates', icon: Bookmark },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Billing', href: '/billing', icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-xl h-screen sticky top-0 select-none z-30 transition-colors">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200/80 dark:border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-md shadow-blue-500/25 ring-2 ring-white/10">
          LP
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <span className="truncate">LinkedIn Autopilot</span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex-shrink-0">
              PRO
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">by GT InnoX LLP</div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
            <span>Publishing Engine</span>
          </div>
          <nav className="space-y-1">
            {mainNavigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href.includes('?') && pathname === item.href.split('?')[0]);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                      : item.highlight
                      ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : item.highlight ? 'text-blue-500' : 'text-slate-400'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.badge && !isActive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Workspace &amp; Settings
          </div>
          <nav className="space-y-1">
            {managementNavigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Security Badge */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 shadow-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-semibold text-slate-700 dark:text-slate-300 truncate">OAuth 2.0 &amp; RLS</div>
            <div className="text-[10px] text-slate-400 truncate">AES-256 Token Encryption</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
