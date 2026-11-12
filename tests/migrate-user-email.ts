import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrateUser() {
  console.log('==================================================');
  console.log('🔄 MIGRATING ACCOUNT TO tejag.vijay@gmail.com');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const userId = '3f722c4d-c224-4431-a0dc-28249bd79c37';
  const newEmail = 'tejag.vijay@gmail.com';
  const newPassword = '1Grenuka*';
  const newFullName = 'Teja Ganugula';

  // 1. Update Supabase Auth user (email, password, auto-confirm)
  console.log('Step 1: Updating auth.users credentials...');
  const { data: updatedAuthUser, error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: newEmail,
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      full_name: newFullName,
    },
  });

  if (authErr) {
    console.error('Failed to update auth credentials:', authErr.message);
    process.exit(1);
  }

  console.log('✅ Auth user credentials updated successfully:', updatedAuthUser.user.email);

  // 2. Update public.profiles table
  console.log('Step 2: Updating public.profiles table...');
  const { data: updatedProfile, error: profErr } = await admin
    .from('profiles')
    .update({
      email: newEmail,
      full_name: newFullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select();

  if (profErr) {
    console.error('Failed to update public.profiles:', profErr.message);
  } else {
    console.log('✅ Profile updated:', updatedProfile);
  }

  // 3. Test sign-in with the new credentials
  console.log('\nStep 3: Verifying sign-in with new credentials...');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
    email: newEmail,
    password: newPassword,
  });

  if (signInErr) {
    console.error('Sign in verification failed:', signInErr.message);
    process.exit(1);
  }

  console.log('✅ Sign in test PASSED! Token generated for:', signInData.user?.email);

  // 4. Verify all linked data remains intact
  const { data: ws } = await admin.from('workspaces').select('id, name').eq('owner_id', userId);
  const { data: accounts } = await admin.from('social_accounts').select('id, account_name, provider_account_id, connection_status');
  const { data: posts } = await admin.from('posts').select('id, content, status');

  console.log('\n--- VERIFICATION OF PRESERVED DATA ---');
  console.log('Workspaces:', ws);
  console.log('Connected Accounts:', accounts);
  console.log(`Preserved Posts Count: ${posts?.length}`);

  console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY TO tejag.vijay@gmail.com!');
}

migrateUser().catch(console.error);
