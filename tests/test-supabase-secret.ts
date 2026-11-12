import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyRealWorkspace() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get existing workspace
  const { data: ws, error: wsErr } = await admin.from('workspaces').select('*').limit(1).single();
  if (wsErr) {
    console.error('Error fetching workspace:', wsErr);
    return;
  }
  console.log('Real workspace found:', ws);

  // Test inserting into social_accounts with real workspace
  const testAccId = 'urn:li:person:real-test-id';
  const { error: saErr } = await admin.from('social_accounts').upsert({
    workspace_id: ws.id,
    provider: 'linkedin',
    provider_account_id: testAccId,
    account_name: 'Lead Developer GT InnoX',
    account_type: 'member',
    encrypted_access_token: 'dummy-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    scopes: ['openid', 'profile'],
    connection_status: 'active',
  }, { onConflict: 'workspace_id,provider,provider_account_id' });

  if (saErr) {
    console.error('FAILED upserting social_account:', saErr);
  } else {
    console.log('SUCCESS! Real workspace social_account upsert passed with 0 errors!');
    await admin.from('social_accounts').delete().eq('provider_account_id', testAccId);
    console.log('Cleaned up test row.');
  }
}

verifyRealWorkspace().catch(console.error);
