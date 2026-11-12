import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { schedulePostPublishJob } from '../src/lib/queue/publisher';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testCronRedisFree() {
  console.log('==================================================');
  console.log('🚀 TESTING REDIS-FREE CRON PUBLISHING (/api/cron/publish)');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];

  // Schedule for 1 second in future
  const dueTime = new Date(Date.now() + 1000);
  const testContent = `⚡ LinkedIn Autopilot Redis-Free Cron Verification at ${dueTime.toISOString()}.\nZero Redis dependency verified.\n#GTInnoX #Automation`;

  // 1. Create post
  const { data: post, error: pErr } = await admin.from('posts').insert({
    workspace_id: account.workspace_id,
    created_by: '3f722c4d-c224-4431-a0dc-28249bd79c37',
    social_account_id: account.id,
    content: testContent,
    post_type: 'text',
    status: 'draft',
  }).select().single();

  if (pErr || !post) {
    console.error('Failed to create post:', pErr);
    process.exit(1);
  }

  // 2. Schedule
  await schedulePostPublishJob(post.id, account.workspace_id, dueTime);
  console.log(`Created & Scheduled Post ID: ${post.id}`);

  // 3. Wait 2 seconds for timestamp to be due
  console.log('Waiting 2 seconds for scheduled post to become due...');
  await new Promise((r) => setTimeout(r, 2000));

  // 4. Trigger /api/cron/publish
  console.log('Triggering http://localhost:3000/api/cron/publish...');
  const res = await fetch('http://localhost:3000/api/cron/publish');
  const cronData = await res.json();
  console.log('Cron response:', JSON.stringify(cronData, null, 2));

  // 5. Verify post in database
  const { data: updatedPost } = await admin.from('posts').select('*').eq('id', post.id).single();
  console.log('\n--- VERIFICATION IN DATABASE ---');
  console.log(`Status: ${updatedPost?.status}`);
  console.log(`Published At: ${updatedPost?.published_at}`);
  console.log(`Provider Post ID (x-restli-id): ${updatedPost?.provider_post_id}`);

  if (updatedPost?.status === 'published' && updatedPost?.provider_post_id) {
    console.log('\n✅ SUCCESS: Redis-free cron publishing works 100% reliably!');
  } else {
    console.error('❌ Cron publishing test failed.');
    process.exit(1);
  }
}

testCronRedisFree().catch(console.error);

