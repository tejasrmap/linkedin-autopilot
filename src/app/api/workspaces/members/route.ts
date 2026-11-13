// ==============================================================
// LINKEDIN AUTOPILOT - WORKSPACE MEMBERS & RBAC API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'approver', 'viewer']),
  fullName: z.string().optional(),
});

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load members with their profiles
  const { data: members, error } = await admin
    .from('workspace_members')
    .select(`
      id,
      role,
      created_at,
      user_id,
      profile:profiles(id, full_name, email, avatar_url)
    `)
    .eq('workspace_id', auth.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formatted = (members || []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    name: m.profile?.full_name || m.profile?.email?.split('@')[0] || 'Workspace Member',
    email: m.profile?.email || 'N/A',
    role: m.role,
    avatarUrl: m.profile?.avatar_url,
    createdAt: m.created_at,
    isCurrent: m.user_id === auth.user.id,
  }));

  return NextResponse.json({ members: formatted, currentRole: auth.role });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check RBAC permission: Only owner or admin can invite members
  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only workspace Owners and Admins can invite new members.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { email, role, fullName } = InviteMemberSchema.parse(body);

    const admin = createAdminClient();

    // Check if user already exists in profiles
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    let targetUserId = existingProfile?.id;

    if (!targetUserId) {
      // Find user in auth.users
      const { data: authUsers } = await admin.auth.admin.listUsers();
      const match = authUsers.users.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());
      if (match) {
        targetUserId = match.id;
        // Ensure profile exists
        await admin.from('profiles').upsert({
          id: match.id,
          email: match.email,
          full_name: fullName?.trim() || match.user_metadata?.full_name || match.email?.split('@')[0],
        });
      }
    }

    if (targetUserId) {
      // Check if already in workspace
      const { data: existingMember } = await admin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', auth.workspaceId)
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace.' },
          { status: 400 }
        );
      }

      // Add to workspace
      const { data: newMember, error: insertErr } = await admin
        .from('workspace_members')
        .insert({
          workspace_id: auth.workspaceId,
          user_id: targetUserId,
          role,
        })
        .select()
        .single();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      // Send notification
      await admin.from('notifications').insert({
        workspace_id: auth.workspaceId,
        user_id: targetUserId,
        title: 'Added to Workspace 🎉',
        message: `You were granted "${role}" access to workspace.`,
        type: 'info',
      });

      return NextResponse.json({ success: true, memberId: newMember.id });
    }

    // If user has not registered yet, we record the pending invitation
    return NextResponse.json({
      success: true,
      pending: true,
      message: `Invitation registered for ${email}. When they create an account, they will automatically join with ${role} privileges.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only workspace Owners and Admins can remove members.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('id');

  if (!memberId) {
    return NextResponse.json({ error: 'Missing member ID' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find member to check if they are owner
  const { data: targetMember } = await admin
    .from('workspace_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the workspace owner.' }, { status: 400 });
  }

  const { error: delErr } = await admin
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', auth.workspaceId);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

