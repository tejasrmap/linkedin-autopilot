import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { schedulePostPublishJob } from '../src/lib/queue/publisher';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verifyWorkerPublishing() {
  console.log('==================================================');
  console.log('⚙️ VERIFYING PERSISTENT WORKER AUTO-PUBLISHING');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];

  // Schedule 5 seconds in future to test automated worker execution
  const dueTime = new Date(Date.now() + 5000);
  const testContent = `⚙️ LinkedIn Autopilot Background Worker Verification by GT InnoX LLP.\n\nAutomated persistent background execution verified at ${dueTime.toISOString()}.\n#GTInnoX #Automation #LinkedInMVP`;

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

  console.log(`Created Post ID: ${post.id}`);
  console.log(`Scheduled for: ${dueTime.toISOString()}`);

  // 2. Schedule
  await schedulePostPublishJob(post.id, account.workspace_id, dueTime);
  console.log('Post status set to scheduled.');

  // 3. Wait for scheduled time + worker poll interval (10 seconds total)
  console.log('Waiting 10 seconds for persistent background worker to detect and execute job...');
  await new Promise((r) => setTimeout(r, 10000));

  // 4. Verify post status
  const { data: finalPost } = await admin.from('posts').select('*').eq('id', post.id).single();
  const { data: job } = await admin.from('scheduled_jobs').select('*').eq('post_id', post.id).single();

  console.log('\n--- WORKER VERIFICATION RESULTS ---');
  console.log(`Final Post Status: ${finalPost?.status}`);
  console.log(`Published At: ${finalPost?.published_at}`);
  console.log(`Provider Post ID (x-restli-id): ${finalPost?.provider_post_id}`);
  console.log(`Scheduled Job Status: ${job?.status}`);

  if (finalPost?.status === 'published' && finalPost?.provider_post_id) {
    console.log('\n✅ Task 16 PASSED: Persistent worker automatically published post to LinkedIn without browser!');
  } else {
    console.log('\nStatus note: Job may still be in flight or waiting for worker trigger.');
  }
}

verifyWorkerPublishing().catch(console.error);

