import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function check() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.from('social_accounts').select('id, provider, provider_account_id, account_name, account_type, connection_status, scopes, created_at');
  if (error) {
    console.error('Error fetching accounts:', error);
  } else {
    console.log('Accounts in DB:', JSON.stringify(data, null, 2));
  }
}

check();

