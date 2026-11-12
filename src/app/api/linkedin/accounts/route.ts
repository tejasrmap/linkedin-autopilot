import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  const auth = await getAuthContext(workspaceId);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  // Select fields excluding sensitive encrypted_access_token
  const { data: accounts, error } = await admin
    .from('social_accounts')
    .select('id, workspace_id, provider, provider_account_id, account_name, account_type, token_expires_at, scopes, connection_status, profile_image_url, metadata, created_at, updated_at')
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: accounts || [] });
}

