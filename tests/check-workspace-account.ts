import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function check() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: accounts } = await admin.from('social_accounts').select('id, workspace_id, account_name, provider_account_id');
  console.log('Accounts:', accounts);

  const { data: workspaces } = await admin.from('workspaces').select('id, name, owner_id');
  console.log('Workspaces:', workspaces);

  const { data: members } = await admin.from('workspace_members').select('*');
  console.log('Members:', members);
}

check();
