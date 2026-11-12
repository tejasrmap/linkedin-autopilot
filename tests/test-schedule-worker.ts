import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { schedulePostPublishJob } from '../src/lib/queue/publisher';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runSchedulingTest() {
  console.log('==================================================');
  console.log('⏰ TESTING POST SCHEDULING (PHASE 3.2 TASK 15)');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];

  const now = Date.now();
  const fiveMinutesAhead = new Date(now + 5 * 60 * 1000);

  const testContent = `⏰ LinkedIn Autopilot Scheduled Post by GT InnoX LLP.\n\nVerified background worker execution at ${fiveMinutesAhead.toISOString()}.\n#GTInnoX #Automation #Scheduling`;

  // 1. Insert post record with draft status
  const { data: post, error: pErr } = await admin.from('posts').insert({
    workspace_id: account.workspace_id,
    created_by: '3f722c4d-c224-4431-a0dc-28249bd79c37',
    social_account_id: account.id,
    content: testContent,
    post_type: 'text',
    status: 'draft',
  }).select().single();

  if (pErr || !post) {
    console.error('Failed to create post record:', pErr);
    process.exit(1);
  }

  console.log(`Created Post ID: ${post.id}`);
  console.log(`Scheduled Time (5 min ahead): ${fiveMinutesAhead.toISOString()}`);

  // 2. Schedule the post
  const scheduleRes = await schedulePostPublishJob(post.id, account.workspace_id, fiveMinutesAhead);
  console.log('Scheduling result:', scheduleRes);

  // 3. Verify in database
  const { data: scheduledPost } = await admin.from('posts').select('*').eq('id', post.id).single();
  const { data: jobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', post.id);

  console.log('\n--- VERIFICATION IN DATABASE ---');
  console.log(`Post Status: ${scheduledPost?.status}`);
  console.log(`Post Scheduled At: ${scheduledPost?.scheduled_at}`);
  console.log(`Scheduled Jobs Count: ${jobs?.length}`);
  console.log(`Job Status: ${jobs?.[0]?.status}`);
  console.log(`Job Scheduled At: ${jobs?.[0]?.scheduled_at}`);

  if (scheduledPost?.status === 'scheduled' && jobs?.[0]?.status === 'scheduled') {
    console.log('\n✅ Task 15 PASSED: Post scheduled 5 minutes ahead in database & queue!');
  } else {
    console.error('❌ Task 15 verification failed.');
    process.exit(1);
  }
}

runSchedulingTest().catch(console.error);

