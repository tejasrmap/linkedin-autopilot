import { config } from 'dotenv';
config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

async function seedAdminUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, key);

  const email = 'dev.lead.gtinnox@gmail.com';
  const password = 'Password@123!';
  const fullName = 'Lead Developer (GT InnoX)';

  console.log('Seeding initial workspace and user for:', email);

  // 1. Sign up user via Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (authErr && !authErr.message.includes('already registered')) {
    console.error('Auth signup note:', authErr.message);
  } else {
    console.log('User signed up successfully. User ID:', authData?.user?.id);
  }

  // Check profiles & workspaces
  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('*');
  console.log('Workspaces created:', workspaces);

  const { data: members, error: memErr } = await supabase.from('workspace_members').select('*');
  console.log('Workspace members:', members);
}

seedAdminUser();
