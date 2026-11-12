import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkUsers() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles } = await admin.from('profiles').select('*');
  console.log('Profiles in DB:', JSON.stringify(profiles, null, 2));

  const { data: authUsers, error } = await admin.auth.admin.listUsers();
  if (error) {
    console.log('List users note:', error.message);
  } else {
    console.log('Auth Users:', authUsers?.users?.map((u) => ({ id: u.id, email: u.email, confirmed_at: u.email_confirmed_at })));
  }
}

checkUsers().catch(console.error);

