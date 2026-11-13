// ==============================================================
// LINKEDIN AUTOPILOT - POST RECONCILIATION API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkedInClient } from '@/lib/linkedin/client';
import { SocialAccount } from '@/types';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const postId = params.id;
  const admin = createAdminClient();

  // Load post
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('*, social_account:social_accounts(*)')
    .eq('id', postId)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
  }

  const socialAccount = post.social_account as (SocialAccount & { encrypted_access_token?: string }) | null;
  if (!socialAccount || !socialAccount.encrypted_access_token) {
    return NextResponse.json(
      { error: 'No valid LinkedIn account linked to this post for reconciliation.' },
      { status: 400 }
    );
  }

  const authorUrn =
    socialAccount.account_type === 'organization'
      ? `urn:li:organization:${socialAccount.provider_account_id}`
      : `urn:li:person:${socialAccount.provider_account_id}`;

  const recon = await linkedInClient.reconcileRecentAuthorPost({
    encryptedAccessToken: socialAccount.encrypted_access_token,
    authorUrn,
    expectedCommentarySnippet: post.content,
  });

  if (recon.reconciled && recon.providerPostId) {
    const nowIso = new Date().toISOString();
    await admin
      .from('posts')
      .update({
        status: 'published',
        published_at: nowIso,
        provider_post_id: recon.providerPostId,
        error_message: null,
        updated_at: nowIso,
      })
      .eq('id', postId);

    await admin.from('post_publish_attempts').insert({
      post_id: postId,
      attempt_number: 99,
      status: 'succeeded',
      provider_response: { manualReconciled: true, providerPostId: recon.providerPostId },
    });

    return NextResponse.json({
      success: true,
      reconciled: true,
      providerPostId: recon.providerPostId,
      message: 'Post successfully reconciled with live LinkedIn publication!',
    });
  }

  return NextResponse.json({
    success: false,
    reconciled: false,
    message: 'Could not find a matching live post on LinkedIn. You may safely retry publishing.',
  });
}
