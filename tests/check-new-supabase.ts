import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function checkUsersAndWorkspaces() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, key);

  console.log('Checking workspaces in database...');
  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('*');
  console.log('Workspaces:', workspaces, 'Error:', wsErr);

  console.log('Checking profiles in database...');
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  console.log('Profiles:', profiles, 'Error:', profErr);
}

checkUsersAndWorkspaces();
