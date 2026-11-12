import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { executePublishPipeline } from '../src/lib/queue/publisher';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function publishApprovedTestPost() {
  console.log('==================================================');
  console.log('🚀 LIVE LINKEDIN PUBLISHING TEST (PHASE 3.2)');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Fetch connected LinkedIn account
  const { data: accounts, error: accErr } = await admin
    .from('social_accounts')
    .select('*')
    .eq('provider', 'linkedin')
    .eq('connection_status', 'active');

  if (accErr || !accounts || accounts.length === 0) {
    console.error('No active LinkedIn account found:', accErr);
    process.exit(1);
  }

  const account = accounts[0];
  console.log(`Found authorized account: ${account.account_name} (${account.account_type})`);
  console.log(`Account ID: ${account.id}, Provider Account ID: ${account.provider_account_id}`);

  // 2. Insert test post
  const testContent = `🚀 Testing LinkedIn Autopilot MVP by GT InnoX LLP.\n\nAutomated publishing pipeline verified at ${new Date().toISOString()}.\n#GTInnoX #LinkedInAutomation #BuildInPublic`;
  
  const { data: post, error: postErr } = await admin
    .from('posts')
    .insert({
      workspace_id: account.workspace_id,
      created_by: '3f722c4d-c224-4431-a0dc-28249bd79c37',
      social_account_id: account.id,
      content: testContent,
      post_type: 'text',
      status: 'approved',
    })
    .select()
    .single();

  if (postErr || !post) {
    console.error('Failed to create post record:', postErr);
    process.exit(1);
  }

  console.log(`Created Post in database with ID: ${post.id}`);
  console.log(`Content:\n"${testContent}"\n`);
  console.log('Invoking executePublishPipeline()...');

  // 3. Execute live publish pipeline
  const result = await executePublishPipeline(post.id);
  console.log('Publish result:', JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error('❌ Publishing failed:', result.error);
    process.exit(1);
  }

  // 4. Verify post record after publish
  const { data: updatedPost } = await admin
    .from('posts')
    .select('*')
    .eq('id', post.id)
    .single();

  console.log('\n==================================================');
  console.log('✅ LIVE PUBLISHING VERIFICATION REPORT');
  console.log('==================================================');
  console.log(`Status: ${updatedPost?.status}`);
  console.log(`Published At: ${updatedPost?.published_at}`);
  console.log(`Provider Post ID (x-restli-id): ${updatedPost?.provider_post_id}`);

  // 5. Verify publish attempt log
  const { data: attempts } = await admin
    .from('post_publish_attempts')
    .select('*')
    .eq('post_id', post.id);

  console.log('Publish Attempts Log:', JSON.stringify(attempts, null, 2));
}

publishApprovedTestPost().catch(console.error);

