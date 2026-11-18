'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Workspace {
  id: string;
  name: string;
  role?: string;
  owner_id?: string;
}

interface UserProfile {
  id?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
}

interface WorkspaceContextType {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  workspaces: Workspace[];
  currentWs: Workspace | null;
  setCurrentWs: (ws: Workspace) => void;
  userProfile: UserProfile;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_workspaces');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });

  const [currentWs, setCurrentWsState] = useState<Workspace | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_current_ws');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {
      name: "Lead Developer (GT InnoX)'s Workspace",
      id: '3af1cc83-b7e7-4ce6-b422-d84d326aaf31',
    };
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_user');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return { full_name: 'Teja Ganugula', email: 'teja@gtinnox.com' };
  });

  const setCurrentWs = (ws: Workspace) => {
    setCurrentWsState(ws);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('autopilot_current_ws', JSON.stringify(ws));
    }
  };

  const refreshWorkspaces = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) setUserProfile(data.user);
        if (data.workspaces) setWorkspaces(data.workspaces);
        const active =
          (data.workspaces || []).find((w: any) => w.id === data.currentWorkspaceId) ||
          data.workspaces?.[0];
        const resolvedWs =
          active || {
            name: "Lead Developer (GT InnoX)'s Workspace",
            id: '3af1cc83-b7e7-4ce6-b422-d84d326aaf31',
          };
        setCurrentWs(resolvedWs);

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_workspaces', JSON.stringify(data.workspaces || []));
          sessionStorage.setItem('autopilot_current_ws', JSON.stringify(resolvedWs));
          sessionStorage.setItem('autopilot_user', JSON.stringify(data.user || {}));
        }
      }
    } catch {
      // Keep existing state
    }
  };

  useEffect(() => {
    refreshWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapsed = () => setCollapsed((v) => !v);

  return (
    <WorkspaceContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleCollapsed,
        mobileOpen,
        setMobileOpen,
        workspaces,
        currentWs,
        setCurrentWs,
        userProfile,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}
