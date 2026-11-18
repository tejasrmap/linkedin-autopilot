'use client';

import React, { Suspense } from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { WorkspaceProvider } from './workspace-context';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/components/theme-provider';

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth');

  if (isAuthPage) {
    return <main className={`auth-screen ${theme === 'dark' ? 'is-dark' : ''}`}>{children}</main>;
  }

  return (
    <div className={`la-app ${theme === 'dark' ? 'is-dark' : ''}`}>
      <Suspense fallback={<div className="la-sidebar" />}>
        <Sidebar />
      </Suspense>
      <div className="la-main">
        <TopNav />
        <main className="la-content">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShellInner>{children}</AppShellInner>
    </WorkspaceProvider>
  );
}
