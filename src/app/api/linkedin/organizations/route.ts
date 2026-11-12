// ==============================================================
// LINKEDIN AUTOPILOT - ORGANIZATION DISCOVERY & MANAGEMENT API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkedInClient } from '@/lib/linkedin/client';
import { decryptToken } from '@/lib/encryption';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  const auth = await getAuthContext(workspaceId);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Fetch connected accounts for this workspace
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('workspace_id', auth.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const memberAccount = accounts?.find((a) => a.account_type === 'member');
  const orgAccounts = accounts?.filter((a) => a.account_type === 'organization') || [];

  if (!memberAccount) {
    return NextResponse.json({
      connected: false,
      status: 'no_member_account',
      message: 'No LinkedIn member account connected. Connect personal LinkedIn account first.',
      organizations: orgAccounts,
    });
  }

  // 2. Check live permissions via decrypted access token
  const token = decryptToken(memberAccount.encrypted_access_token);
  if (!token) {
    return NextResponse.json({
      connected: true,
      status: 'invalid_token',
      message: 'Connected account token could not be decrypted. Re-authorization required.',
      organizations: orgAccounts,
    });
  }

  const permStatus = await linkedInClient.checkOrganizationPermissions(token);

  return NextResponse.json({
    connected: true,
    hasOrganizationSocialScope: permStatus.hasOrganizationSocialScope,
    communityManagementActive: permStatus.communityManagementActive,
    status: permStatus.status,
    message: permStatus.message,
    discoveredOrganizations: permStatus.organizations,
    existingOrganizations: orgAccounts.map((org) => ({
      id: org.id,
      provider_account_id: org.provider_account_id,
      account_name: org.account_name,
      account_type: org.account_type,
      connection_status: org.connection_status,
      metadata: org.metadata,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { organizationId, organizationName, vanityName } = body;

    if (!organizationId || !organizationName) {
      return NextResponse.json(
        { error: 'Missing organizationId or organizationName' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Look for active member account to inherit encrypted token
    const { data: memberAcc } = await admin
      .from('social_accounts')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .eq('account_type', 'member')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!memberAcc) {
      return NextResponse.json(
        { error: 'Please connect an authorized LinkedIn member account first.' },
        { status: 400 }
      );
    }

    // Upsert company page destination
    const cleanOrgId = organizationId.toString().replace(/\D/g, '') || organizationId.trim();
    const { data: newOrg, error: upsertErr } = await admin
      .from('social_accounts')
      .upsert(
        {
          workspace_id: auth.workspaceId,
          provider: 'linkedin',
          provider_account_id: cleanOrgId,
          account_name: organizationName.trim(),
          account_type: 'organization',
          encrypted_access_token: memberAcc.encrypted_access_token,
          token_expires_at: memberAcc.token_expires_at,
          scopes: memberAcc.scopes || [],
          connection_status: 'active',
          metadata: {
            organization_urn: `urn:li:organization:${cleanOrgId}`,
            vanity_name: vanityName || null,
            linked_by_member: memberAcc.provider_account_id,
            manual_connection: true,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'workspace_id,provider,provider_account_id',
        }
      )
      .select()
      .single();

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      organization: newOrg,
      authorUrn: `urn:li:organization:${cleanOrgId}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

