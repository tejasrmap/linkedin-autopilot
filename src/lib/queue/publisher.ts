// ==============================================================
// LINKEDIN AUTOPILOT - PUBLISHING & QUEUE SCHEDULER ENGINE
// BY GT INNOX LLP
// ==============================================================

import { Queue } from 'bullmq';
import { getRedisConnection } from './redis';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkedInClient } from '@/lib/linkedin/client';
import { Post, SocialAccount } from '@/types';

export const LINKEDIN_PUBLISH_QUEUE_NAME = 'linkedin-publish-queue';

export interface PublishJobData {
  postId: string;
  workspaceId: string;
  attemptNumber: number;
}

let publishQueue: Queue<PublishJobData> | null = null;

export function getPublishQueue(): Queue<PublishJobData> | null {
  try {
    if (!publishQueue) {
      const connection = getRedisConnection();
      publishQueue = new Queue<PublishJobData>(LINKEDIN_PUBLISH_QUEUE_NAME, {
        connection: connection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
    }
    return publishQueue;
  } catch (err) {
    console.warn('[Queue] Redis connection not available, queue offline:', err);
    return null;
  }
}

/**
 * Enqueues or schedules a post for publishing
 */
export async function schedulePostPublishJob(
  postId: string,
  workspaceId: string,
  scheduledAt: Date | null
): Promise<{ queueJobId: string | null; success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const queue = getPublishQueue();

  const now = Date.now();
  const targetTime = scheduledAt ? scheduledAt.getTime() : now;
  const delayMs = Math.max(0, targetTime - now);

  const jobId = `post-${postId}-${Date.now()}`;

  // Update post status in database
  const targetStatus = delayMs > 0 ? 'scheduled' : 'processing';
  const { error: updateErr } = await supabase
    .from('posts')
    .update({
      status: targetStatus,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (updateErr) {
    return { queueJobId: null, success: false, error: updateErr.message };
  }

  // Create or update scheduled_jobs record
  await supabase.from('scheduled_jobs').insert({
    post_id: postId,
    queue_job_id: jobId,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : new Date().toISOString(),
    status: delayMs > 0 ? 'scheduled' : 'queued',
    attempts: 0,
  });

  // If BullMQ / Redis is enabled, add job to Redis queue
  if (process.env.REDIS_URL) {
    try {
      const queue = getPublishQueue();
      if (queue) {
        const job = await queue.add(
          'publish-linkedin-post',
          { postId, workspaceId, attemptNumber: 1 },
          {
            jobId,
            delay: delayMs,
          }
        );
        return { queueJobId: job.id ?? jobId, success: true };
      }
    } catch (err: any) {
      console.warn('[Queue] Failed to enqueue to Redis, fallback directly:', err.message);
    }
  }

  // If immediate publish and queue is offline, execute in-process
  if (delayMs <= 0) {
    const res = await executePublishPipeline(postId);
    return { queueJobId: jobId, success: res.success, error: res.error };
  }

  return { queueJobId: jobId, success: true };
}

/**
 * Cancels a scheduled publishing job
 */
export async function cancelScheduledJob(postId: string): Promise<boolean> {
  const supabase = createAdminClient();

  // Update post status
  await supabase
    .from('posts')
    .update({
      status: 'draft',
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId);

  // Update scheduled_jobs table
  await supabase
    .from('scheduled_jobs')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('post_id', postId)
    .eq('status', 'scheduled');

  const queue = getPublishQueue();
  if (queue) {
    try {
      // Find and remove job from queue
      const delayed = await queue.getDelayed();
      for (const j of delayed) {
        if (j.data?.postId === postId) {
          await j.remove();
        }
      }
    } catch (e) {
      console.warn('[Queue] Cancel in Redis error:', e);
    }
  }

  return true;
}

/**
 * The core publishing pipeline that executes the actual LinkedIn post creation
 */
export async function executePublishPipeline(
  postId: string,
  options?: { claimToken?: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const claimToken = options?.claimToken || crypto.randomUUID();
  const leaseDurationSeconds = 300; // 5-minute lease duration
  const nowIso = new Date().toISOString();

  // 1. Atomic Claim with UUID Execution Lease Token (RPC with CAS fallback)
  let post: any = null;
  const { data: claimData, error: rpcErr } = await supabase.rpc('claim_post_for_publishing', {
    target_post_id: postId,
    new_claim_token: claimToken,
    lease_duration_seconds: leaseDurationSeconds,
  });

  if (!rpcErr && claimData) {
    if (!claimData.success) {
      return { success: false, error: 'Post is already processing or has already been published.' };
    }
    const { data: fetchedPost, error: fetchErr } = await supabase
      .from('posts')
      .select('*, social_account:social_accounts(*)')
      .eq('id', postId)
      .eq('claim_token', claimToken)
      .single();

    if (fetchErr || !fetchedPost) {
      return { success: false, error: 'Failed to retrieve claimed post record.' };
    }
    post = fetchedPost;
  } else {
    // Fallback if RPC is not yet applied: conditional CAS update
    const { data: casPost, error: lockErr } = await supabase
      .from('posts')
      .update({
        status: 'processing',
        claim_token: claimToken,
        lease_expires_at: new Date(Date.now() + leaseDurationSeconds * 1000).toISOString(),
        updated_at: nowIso,
      })
      .eq('id', postId)
      .in('status', ['scheduled', 'approved', 'draft'])
      .select('*, social_account:social_accounts(*)')
      .single();

    if (lockErr || !casPost) {
      return { success: false, error: 'Post is already processing or has already been published.' };
    }
    post = casPost;
  }

  // 3. Count attempt number
  const { count } = await supabase
    .from('post_publish_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  const attemptNumber = (count || 0) + 1;

  // Insert initial attempt row
  await supabase.from('post_publish_attempts').insert({
    post_id: postId,
    attempt_number: attemptNumber,
    status: 'started',
  });

  // 4. Verify social account
  const socialAccount = post.social_account as SocialAccount | null;
  if (!socialAccount) {
    const errorMsg = 'No LinkedIn account linked to this post. Please select an active account.';
    await markPostFailed(supabase, post, errorMsg, attemptNumber, undefined, claimToken);
    return { success: false, error: errorMsg };
  }

  // Multi-workspace security safeguard: strictly prevent cross-workspace publishing
  if (socialAccount.workspace_id !== post.workspace_id) {
    const errorMsg = 'Security violation: Assigned LinkedIn account does not belong to the post workspace.';
    await markPostFailed(supabase, post, errorMsg, attemptNumber, undefined, claimToken);
    return { success: false, error: errorMsg };
  }

  if (socialAccount.connection_status !== 'active') {
    const errorMsg = `LinkedIn account "${socialAccount.account_name}" is currently ${socialAccount.connection_status}. Please reconnect.`;
    await markPostFailed(supabase, post, errorMsg, attemptNumber, undefined, claimToken);
    return { success: false, error: errorMsg };
  }

  // 5. Construct author URN
  const authorUrn =
    socialAccount.account_type === 'organization'
      ? `urn:li:organization:${socialAccount.provider_account_id}`
      : `urn:li:person:${socialAccount.provider_account_id}`;

  // 5b. Pre-publish reconciliation: If previous attempt had an ambiguous timeout, check LinkedIn first to prevent duplicates
  if (post.error_message && (post.error_message.includes('Ambiguous') || post.error_message.includes('timeout'))) {
    console.info(`[Publisher] Post ${postId} previously had an ambiguous timeout. Checking if already live on LinkedIn...`);
    try {
      const preRecon = await linkedInClient.reconcileRecentAuthorPost({
        encryptedAccessToken: (socialAccount as any).encrypted_access_token,
        authorUrn,
        expectedCommentarySnippet: post.content,
      });

      if (preRecon.reconciled && preRecon.providerPostId) {
        console.info(`[Publisher] Post ${postId} was already published during ambiguous timeout (id: ${preRecon.providerPostId}). Finalizing without re-publishing.`);
        return await finalizePublishSuccess(
          supabase,
          postId,
          claimToken,
          preRecon.providerPostId,
          { reconciledPriorToRetry: true, providerPostId: preRecon.providerPostId },
          post,
          socialAccount,
          attemptNumber,
          true
        );
      }
    } catch (reconErr) {
      console.warn(`[Publisher] Pre-retry reconciliation check failed for post ${postId}:`, reconErr);
    }
  }

  // 6. Call LinkedIn REST API
  const publishResult = await linkedInClient.publishPost({
    encryptedAccessToken: (socialAccount as any).encrypted_access_token,
    authorUrn,
    content: post.content,
    postType: post.post_type,
    mediaAssets: post.media_assets,
  });

  // 7. Handle response
  if (publishResult.success && publishResult.providerPostId) {
    return await finalizePublishSuccess(
      supabase,
      postId,
      claimToken,
      publishResult.providerPostId,
      publishResult.rawResponse || { providerPostId: publishResult.providerPostId },
      post,
      socialAccount,
      attemptNumber,
      false
    );
  } else {
    // 7b. Check for ambiguous publishing outcome (network timeout after transmission)
    if (publishResult.isAmbiguous) {
      console.warn(`[Publisher] Ambiguous timeout for post ${postId}. Initiating live author reconciliation...`);
      const recon = await linkedInClient.reconcileRecentAuthorPost({
        encryptedAccessToken: (socialAccount as any).encrypted_access_token,
        authorUrn,
        expectedCommentarySnippet: post.content,
      });

      if (recon.reconciled && recon.providerPostId) {
        console.log(`[Publisher] Post ${postId} successfully reconciled with live LinkedIn post ${recon.providerPostId}!`);
        return await finalizePublishSuccess(
          supabase,
          postId,
          claimToken,
          recon.providerPostId,
          { reconciled: true, providerPostId: recon.providerPostId },
          post,
          socialAccount,
          attemptNumber,
          true
        );
      }
    }

    const errorMsg = publishResult.error || 'LinkedIn API returned an unhandled error.';

    // Graceful handling of revoked or expired tokens:
    if (
      errorMsg.includes('401') ||
      errorMsg.toLowerCase().includes('revoked') ||
      errorMsg.toLowerCase().includes('expired') ||
      errorMsg.toLowerCase().includes('empty_access_token') ||
      errorMsg.toLowerCase().includes('invalid access token')
    ) {
      await supabase
        .from('social_accounts')
        .update({ connection_status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', socialAccount.id);

      await supabase.from('notifications').insert({
        workspace_id: post.workspace_id,
        user_id: post.created_by,
        title: 'Action Required: LinkedIn Token Expired or Revoked ⚠️',
        message: `Your connected account "${socialAccount.account_name}" has an invalid or expired token. Please reconnect in LinkedIn Accounts.`,
        type: 'warning',
      });
    }

    await markPostFailed(supabase, post, errorMsg, attemptNumber, publishResult.rawResponse, claimToken);
    return { success: false, error: errorMsg };
  }
}

/**
 * Atomically finalizes a successfully published post via PostgreSQL RPC or strict CAS fallback
 */
async function finalizePublishSuccess(
  supabase: any,
  postId: string,
  claimToken: string,
  providerPostId: string,
  rawResponse: any,
  post: any,
  socialAccount: SocialAccount,
  attemptNumber: number,
  isReconciled: boolean
): Promise<{ success: boolean; error?: string }> {
  const publishTs = new Date().toISOString();

  // Try atomic finalize RPC first
  const { data: finalizeData, error: finalizeErr } = await supabase.rpc('finalize_post_publishing', {
    target_post_id: postId,
    expected_claim_token: claimToken,
    provider_post_id: providerPostId,
    raw_response: rawResponse || null,
  });

  if (!finalizeErr && finalizeData) {
    if (!finalizeData.success) {
      console.warn(`[Publisher] Finalization rejected for post ${postId}: ${finalizeData.reason}`);
      return { success: false, error: `Publish finalization rejected: ${finalizeData.reason}` };
    }
  } else {
    // Fallback only if RPC function does not exist: CAS update validating claim_token ownership
    const { data: updatedPost, error: postUpdateErr } = await supabase
      .from('posts')
      .update({
        status: 'published',
        published_at: publishTs,
        provider_post_id: providerPostId,
        claim_token: null,
        lease_expires_at: null,
        error_message: null,
        updated_at: publishTs,
      })
      .eq('id', postId)
      .eq('claim_token', claimToken)
      .select('id');

    if (postUpdateErr || !updatedPost || updatedPost.length === 0) {
      console.warn(`[Publisher] Fallback finalization failed for post ${postId}: lease ownership lost`);
      return { success: false, error: 'Publish finalization failed: lease ownership lost' };
    }

    // Synchronize scheduled_jobs conditionally
    await supabase
      .from('scheduled_jobs')
      .update({
        status: 'completed',
        claim_token: null,
        lease_expires_at: null,
        updated_at: publishTs,
      })
      .eq('post_id', postId)
      .in('status', ['processing', 'scheduled', 'queued']);
  }

  // Record succeeded attempt
  await supabase.from('post_publish_attempts').insert({
    post_id: postId,
    attempt_number: attemptNumber,
    status: 'succeeded',
    provider_response: rawResponse || { providerPostId },
  });

  // Notify user
  await supabase.from('notifications').insert({
    workspace_id: post.workspace_id,
    user_id: post.created_by,
    title: isReconciled ? 'Post Published (Reconciled After Timeout) 🚀' : 'Post Published Successfully! 🚀',
    message: isReconciled
      ? `Your post "${post.content.slice(0, 50)}..." was confirmed live on LinkedIn via automated reconciliation.`
      : `Your post "${post.content.slice(0, 50)}..." was published to LinkedIn (${socialAccount.account_name}).`,
    type: 'success',
  });

  return { success: true };
}

async function markPostFailed(
  supabase: any,
  post: any,
  errorMsg: string,
  attemptNumber: number,
  rawResponse?: any,
  claimToken?: string
) {
  const activeClaimToken = claimToken || post.claim_token;
  if (!activeClaimToken) {
    console.warn(`[Publisher] Cannot fail/retry post ${post.id}: missing claim token (unowned post)`);
    return;
  }

  const nowIso = new Date().toISOString();

  // Atomic retry state transition via PostgreSQL RPC
  const { data: retryData, error: rpcErr } = await supabase.rpc('handle_publishing_failure_and_retry', {
    target_post_id: post.id,
    expected_claim_token: activeClaimToken,
    error_message: errorMsg,
    max_attempts: 3,
  });

  if (!rpcErr && retryData) {
    if (!retryData.success) {
      console.warn(`[Publisher] Retry RPC rejected for post ${post.id}: ${retryData.reason}`);
      // Lease was lost, expired, or post was already published!
      // Do NOT mutate post or scheduled_jobs - the winning worker or final state owns the row!
      return;
    }
  } else {
    // Fallback ONLY IF RPC does not exist (rpcErr)
    // Even in fallback, STRICTLY enforce claim_token match to prevent overwriting winning worker!
    const { data: updatedPost } = await supabase
      .from('posts')
      .update({
        status: 'failed',
        claim_token: null,
        lease_expires_at: null,
        error_message: errorMsg,
        updated_at: nowIso,
      })
      .eq('id', post.id)
      .eq('claim_token', activeClaimToken)
      .select('id');

    if (!updatedPost || updatedPost.length === 0) {
      console.warn(`[Publisher] Fallback markPostFailed aborted: claim token lost for post ${post.id}`);
      return;
    }

    await supabase
      .from('scheduled_jobs')
      .update({
        status: 'failed',
        claim_token: null,
        lease_expires_at: null,
        last_error: errorMsg,
        updated_at: nowIso,
      })
      .eq('post_id', post.id)
      .eq('claim_token', activeClaimToken);
  }

  await supabase.from('post_publish_attempts').insert({
    post_id: post.id,
    attempt_number: attemptNumber,
    status: 'failed',
    error_message: errorMsg,
    provider_response: rawResponse || {},
  });

  await supabase.from('notifications').insert({
    workspace_id: post.workspace_id,
    user_id: post.created_by,
    title: 'LinkedIn Publishing Failed ⚠️',
    message: `Failed to publish post: ${errorMsg}`,
    type: 'error',
  });
}

