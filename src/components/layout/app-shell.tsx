'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { TopNav } from './top-nav';
import { usePathname } from 'next/navigation';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');

  if (isAuthPage) {
    return <main className="min-h-screen bg-slate-50 dark:bg-[#0b0f19]">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0b0f19]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

