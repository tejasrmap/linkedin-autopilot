import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function testSignedIn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, key);

  console.log('Signing in with dev.lead.gtinnox@gmail.com...');
  const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: 'dev.lead.gtinnox@gmail.com',
    password: 'Password@123!',
  });

  if (signInErr) {
    console.error('Sign in error:', signInErr.message);
    return;
  }

  console.log('✅ Sign in successful! Session user:', authData.user.id);

  // Check profiles
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*');
  console.log('User profile:', profile, profErr);

  // Check workspaces
  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('*');
  console.log('User workspaces:', workspaces, wsErr);

  const { data: members, error: memErr } = await supabase.from('workspace_members').select('*');
  console.log('Workspace members:', members, memErr);
}

testSignedIn();

