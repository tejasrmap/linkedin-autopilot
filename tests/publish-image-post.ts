import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decryptToken } from '../src/lib/encryption';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function publishApprovedImagePost() {
  console.log('==================================================');
  console.log('📸 PUBLISHING APPROVED IMAGE POST TO LINKEDIN');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];
  const token = decryptToken(account.encrypted_access_token);
  const authorUrn = `urn:li:person:${account.provider_account_id}`;
  const apiVersion = process.env.LINKEDIN_API_VERSION || '202610';
  const imageUrn = 'urn:li:image:D5610AQF5WVEDi3ewnQ';

  const testContent = `📸 LinkedIn Autopilot Image Publishing Verification by GT InnoX LLP.\n\nMedia upload and multi-format publishing verified at ${new Date().toISOString()}.\n#LinkedInAutomation #GTInnoX`;

  // 1. Create post record in DB
  const { data: post, error: pErr } = await admin.from('posts').insert({
    workspace_id: account.workspace_id,
    created_by: '3f722c4d-c224-4431-a0dc-28249bd79c37',
    social_account_id: account.id,
    content: testContent,
    post_type: 'image',
    media_assets: [{ urn: imageUrn, title: 'LinkedIn Autopilot Verification' }],
    status: 'approved',
  }).select().single();

  if (pErr) {
    console.error('Failed to create post record:', pErr);
    process.exit(1);
  }

  // 2. Call LinkedIn Posts API with media attachment
  const response = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary: testContent,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: imageUrn,
          title: 'LinkedIn Autopilot Verification',
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  console.log(`LinkedIn Image Post API Response: HTTP ${response.status}`);
  if (response.status === 201) {
    const providerPostId = response.headers.get('x-restli-id') || response.headers.get('location');
    console.log('✅ Image Post Published Successfully!');
    console.log('Provider Post ID (x-restli-id):', providerPostId);

    // Update database
    await admin.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      provider_post_id: providerPostId,
    }).eq('id', post.id);

    await admin.from('post_publish_attempts').insert({
      post_id: post.id,
      attempt_number: 1,
      status: 'succeeded',
      provider_response: { status: 201, headers: Object.fromEntries(response.headers.entries()) },
    });

    console.log('Database updated: post marked as published!');
  } else {
    const errText = await response.text();
    console.error('LinkedIn Image Post failed:', errText);
    process.exit(1);
  }
}

publishApprovedImagePost().catch(console.error);

