// ==============================================================
// LINKEDIN AUTOPILOT - SERVER AUTHENTICATION & WORKSPACE HELPER
// BY GT INNOX LLP
// ==============================================================

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { WorkspaceRole } from '@/types';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    full_name?: string;
  };
  workspaceId: string;
  role: WorkspaceRole;
  isPlatformAdmin?: boolean;
}

/**
 * Checks whether an email belongs to an authorized GT InnoX platform administrator.
 * FAIL-CLOSED: If ADMIN_EMAILS is not configured or empty, platform superadmin access is completely disabled.
 */
export function isPlatformAdmin(userEmail?: string | null): boolean {
  if (!userEmail || typeof userEmail !== 'string') return false;

  const rawAdminEmails = process.env.ADMIN_EMAILS;
  // Strict fail-closed: No implicit administrator emails are accepted in any environment
  if (!rawAdminEmails || typeof rawAdminEmails !== 'string' || !rawAdminEmails.trim()) {
    return false;
  }

  const normalizedUserEmail = userEmail.trim().toLowerCase();
  if (!normalizedUserEmail || !normalizedUserEmail.includes('@')) {
    return false;
  }

  const adminEmails = rawAdminEmails
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'));

  return adminEmails.includes(normalizedUserEmail);
}

/**
 * Resolves authenticated user and workspace membership context for API Route Handlers
 */
export async function getAuthContext(requestWorkspaceId?: string | null): Promise<AuthContext | null> {
  const supabase = createServerSupabaseClient();
  let user: any = null;

  // Fast-path: Read session claims directly from local cookie without network round-trip
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    user = session.user;
  } else {
    const { data: { user: remoteUser } } = await supabase.auth.getUser();
    user = remoteUser;
  }

  if (!user || !user.id) {
    // STRICT PRODUCTION SAFEGUARD:
    // Development authentication is strictly forbidden in production environments.
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH === 'true') {
      const admin = createAdminClient();
      let devWsId = requestWorkspaceId;
      let devUserId = '3f722c4d-c224-4431-a0dc-28249bd79c37';
      const devEmail = 'tejag.vijay@gmail.com';

      try {
        if (!devWsId) {
          const { data: firstWs } = await admin.from('workspaces').select('id, owner_id').limit(1).single();
          if (firstWs) {
            devWsId = firstWs.id;
            if (firstWs.owner_id) devUserId = firstWs.owner_id;
          }
        } else {
          const { data: ws } = await admin.from('workspaces').select('owner_id').eq('id', devWsId).single();
          if (ws?.owner_id) devUserId = ws.owner_id;
        }
      } catch (e) {
        // Fallback
      }

      devWsId = devWsId || '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';

      return {
        user: { id: devUserId, email: devEmail, full_name: 'Teja Ganugula' },
        workspaceId: devWsId,
        role: 'owner',
        isPlatformAdmin: isPlatformAdmin(devEmail),
      };
    }
    return null;
  }

  const admin = createAdminClient();

  // Find user's workspaces
  const { data: memberships, error } = await admin
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, slug)')
    .eq('user_id', user.id);

  if (error || !memberships || memberships.length === 0) {
    // If user has no workspace yet, auto-provision default workspace
    const wsName = `${user.user_metadata?.full_name || user.email?.split('@')[0] || 'My'}'s Workspace`;
    const { data: newWs } = await admin
      .from('workspaces')
      .insert({
        name: wsName,
        slug: `ws-${Date.now().toString(36)}`,
        owner_id: user.id,
      })
      .select()
      .single();

    if (newWs) {
      await admin.from('workspace_members').insert({
        workspace_id: newWs.id,
        user_id: user.id,
        role: 'owner',
      });

      return {
        user: { id: user.id, email: user.email!, full_name: user.user_metadata?.full_name },
        workspaceId: newWs.id,
        role: 'owner',
        isPlatformAdmin: isPlatformAdmin(user.email),
      };
    }

    return null;
  }

  // Check if requested workspace is among user's memberships
  let selectedMembership = memberships[0];
  if (requestWorkspaceId) {
    const found = memberships.find((m) => m.workspace_id === requestWorkspaceId);
    if (found) {
      selectedMembership = found;
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name,
    },
    workspaceId: selectedMembership.workspace_id,
    role: selectedMembership.role as WorkspaceRole,
    isPlatformAdmin: isPlatformAdmin(user.email),
  };
}

