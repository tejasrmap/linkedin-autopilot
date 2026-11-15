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

/**
 * Determines whether an error returned by Supabase RPC indicates that the specific stored procedure
 * genuinely does not exist in the database schema (e.g. migration not yet applied).
 * Any other error (network timeout, connection drop, permission denied, locking failure,
 * SQL constraint violation, generic schema-cache reload timeout) MUST NOT trigger a fallback update.
 *
 * @param error - Supabase RPC error object
 * @param expectedFunctionName - Optional expected RPC function name to verify in error message
 */
export function isRpcFunctionMissingError(error: any, expectedFunctionName?: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '').trim();
  const rawMsg = String(error.message || '').trim().toLowerCase();
  const targetFn = expectedFunctionName ? expectedFunctionName.trim().toLowerCase() : null;

  // If a specific function name was provided and the error message contains function text,
  // ensure the error actually pertains to this function (not an unrelated one)
  if (targetFn && rawMsg && (rawMsg.includes('function') || rawMsg.includes('schema cache'))) {
    if (!rawMsg.includes(targetFn)) {
      return false;
    }
  }

  // 1. PostgREST code PGRST202: "Could not find the function <name> in the schema cache"
  if (code === 'PGRST202') {
    return true;
  }

  // 2. PostgreSQL code 42883: undefined_function
  if (code === '42883') {
    return true;
  }

  // 3. Fallback message inspection ONLY for explicit missing-function phrasing
  const isExplicitMissingMsg =
    rawMsg.includes('could not find the function') ||
    (rawMsg.includes('function') && rawMsg.includes('does not exist'));

  if (isExplicitMissingMsg) {
    return true;
  }

  return false;
}

/**
 * Safely rolls back a post's status to 'draft' when scheduled_job insertion fails,
 * using optimistic locking to prevent overwriting concurrent state transitions
 * (such as another worker claiming the post or the post already reaching 'published').
 */
export async function rollbackPostStatusOnJobFailure(
  supabase: any,
  postId: string,
  expectedStatuses: string[],
  errorMessage: string
): Promise<{ rolledBack: boolean; error?: string }> {
  try {
    let query = supabase
      .from('posts')
      .update({
        status: 'draft',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (expectedStatuses.length === 1) {
      query = query.eq('status', expectedStatuses[0]);
    } else {
      query = query.in('status', expectedStatuses);
    }

    const { data: rolledBackRows, error: rollbackErr } = await query.select('id');

    if (rollbackErr) {
      console.error(`[Queue] Failed to execute compensating rollback for post ${postId}:`, rollbackErr);
      return { rolledBack: false, error: rollbackErr.message || String(rollbackErr) };
    }

    if (!rolledBackRows || rolledBackRows.length === 0) {
      console.warn(
        `[Queue] Compensating rollback skipped for post ${postId}: post state transitioned away from expected status (${expectedStatuses.join(', ')})`
      );
      return { rolledBack: false, error: 'post_status_transitioned' };
    }

    return { rolledBack: true };
  } catch (err: any) {
    console.error(`[Queue] Unexpected exception during compensating rollback for post ${postId}:`, err);
    return { rolledBack: false, error: err.message || String(err) };
  }
}

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

  if (delayMs > 0) {
    // Future-scheduled post: update post to 'scheduled' and create scheduled_jobs row
    const targetStatus = 'scheduled';
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

    // Insert scheduled_jobs record for future cron processing
    const { error: jobInsertErr } = await supabase.from('scheduled_jobs').insert({
      post_id: postId,
      queue_job_id: jobId,
      scheduled_at: scheduledAt ? scheduledAt.toISOString() : new Date().toISOString(),
      status: 'scheduled',
      attempts: 0,
    });

    if (jobInsertErr) {
      console.error(`[Queue] Failed to persist scheduled_job for post ${postId}:`, jobInsertErr);
      // Revert post back to draft with optimistic lock to avoid orphaned post without a scheduler job
      await rollbackPostStatusOnJobFailure(
        supabase,
        postId,
        ['scheduled'],
        `Failed to persist scheduled job: ${jobInsertErr.message}`
      );

      return { queueJobId: null, success: false, error: `Failed to persist scheduled job: ${jobInsertErr.message}` };
    }

    // If BullMQ / Redis is enabled, add job to Redis queue with delay
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

    return { queueJobId: jobId, success: true };
  } else {
    // Immediate publishing ("Publish Now"):
    // Do NOT preemptively set posts.status to 'processing' here!
    // The post remains in 'draft' or 'scheduled' so executePublishPipeline's atomic claim RPC
    // (claim_post_for_publishing) solely owns the transition into 'processing' with a verified lease token.

    // Insert authoritative scheduled_jobs record with status 'scheduled'
    const { error: jobInsertErr } = await supabase.from('scheduled_jobs').insert({
      post_id: postId,
      queue_job_id: jobId,
      scheduled_at: new Date().toISOString(),
      status: 'scheduled',
      attempts: 0,
    });

    if (jobInsertErr) {
      console.error(`[Queue] Failed to persist scheduled_job for Publish Now post ${postId}:`, jobInsertErr);
      // Revert post back to draft with optimistic lock if post has not been claimed/transitioned
      await rollbackPostStatusOnJobFailure(
        supabase,
        postId,
        ['draft', 'scheduled'],
        `Failed to persist publishing execution record: ${jobInsertErr.message}`
      );

      return { queueJobId: null, success: false, error: `Failed to persist publishing execution record: ${jobInsertErr.message}` };
    }

    // Execute in-process through the atomic lease claim pipeline
    const res = await executePublishPipeline(postId);
    return { queueJobId: jobId, success: res.success, error: res.error };
  }
}

/**
 * Cancels a scheduled publishing job with status validation and optional workspace scoping.
 * Posts that are currently processing or already published are strictly immutable and cannot be cancelled.
 */
export async function cancelScheduledJob(postId: string, workspaceId?: string): Promise<boolean> {
  const supabase = createAdminClient();

  // Atomically update post status back to draft ONLY if it is currently scheduled or pending_approval.
  // Published or in-flight processing posts must never be cancelled or reverted to draft!
  let query = supabase
    .from('posts')
    .update({
      status: 'draft',
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .in('status', ['scheduled', 'pending_approval']);

  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data: cancelledPost, error: cancelErr } = await query.select('id');

  if (cancelErr || !cancelledPost || cancelledPost.length === 0) {
    return false;
  }

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
    p_target_post_id: postId,
    p_new_claim_token: claimToken,
    p_lease_duration_seconds: leaseDurationSeconds,
    // Dual compatibility with legacy RPC parameter names
    target_post_id: postId,
    new_claim_token: claimToken,
    lease_duration_seconds: leaseDurationSeconds,
  } as any);

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
  } else if (rpcErr && isRpcFunctionMissingError(rpcErr, 'claim_post_for_publishing')) {
    // Fallback ONLY if the RPC function genuinely does not exist in the database schema (e.g. unapplied migration)
    console.warn(`[Publisher] claim_post_for_publishing RPC missing (${rpcErr.code || rpcErr.message}); falling back to verified CAS update`);
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

    // Synchronize scheduled_jobs record conditionally
    await supabase
      .from('scheduled_jobs')
      .update({
        status: 'processing',
        claim_token: claimToken,
        lease_expires_at: new Date(Date.now() + leaseDurationSeconds * 1000).toISOString(),
        updated_at: nowIso,
      })
      .eq('post_id', postId)
      .in('status', ['scheduled', 'queued', 'processing']);
  } else {
    // Network failure, DB timeout, permission error, or unexpected SQL exception: FAIL CLOSED
    const rpcErrMsg = rpcErr?.message || 'Unknown database RPC error during claim';
    console.error(`[Publisher] Fatal database error during claim_post_for_publishing for post ${postId}:`, rpcErr);
    return { success: false, error: `Database claim failure: ${rpcErrMsg}` };
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

  // 4b. Strictly verify required posting scope for personal member accounts (fail-closed)
  const normalizedScopes = Array.isArray(socialAccount.scopes)
    ? socialAccount.scopes
        .flatMap((s: string) => (typeof s === 'string' ? s.split(/[\s,]+/) : []))
        .map((s: string) => s.trim())
        .filter(Boolean)
    : [];

  if (socialAccount.account_type === 'member' && !normalizedScopes.includes('w_member_social')) {
    const errorMsg = `LinkedIn account "${socialAccount.account_name}" lacks verified "w_member_social" posting permission. Please reconnect or reauthorize your LinkedIn account.`;
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
    p_target_post_id: postId,
    p_expected_claim_token: claimToken,
    p_provider_post_id: providerPostId,
    p_raw_response: rawResponse || null,
    // Dual compatibility with legacy RPC parameter names
    target_post_id: postId,
    expected_claim_token: claimToken,
    provider_post_id: providerPostId,
    raw_response: rawResponse || null,
  } as any);

  if (!finalizeErr && finalizeData) {
    if (!finalizeData.success) {
      console.warn(`[Publisher] Finalization rejected for post ${postId}: ${finalizeData.reason}`);
      return { success: false, error: `Publish finalization rejected: ${finalizeData.reason}` };
    }
  } else if (finalizeErr && isRpcFunctionMissingError(finalizeErr, 'finalize_post_publishing')) {
    // Fallback ONLY if the RPC function genuinely does not exist in the database schema (e.g. unapplied migration)
    console.warn(`[Publisher] finalize_post_publishing RPC missing (${finalizeErr.code || finalizeErr.message}); falling back to verified CAS update`);
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
  } else {
    // Network failure, DB timeout, permission error, or unexpected SQL exception: FAIL CLOSED
    const rpcErrMsg = finalizeErr?.message || 'Unknown database RPC error during finalization';
    console.error(`[Publisher] Fatal database error during finalize_post_publishing for post ${postId}:`, finalizeErr);
    return { success: false, error: `Database finalization failure: ${rpcErrMsg}` };
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
    p_target_post_id: post.id,
    p_expected_claim_token: activeClaimToken,
    p_error_message: errorMsg,
    p_max_attempts: 3,
    // Dual compatibility with legacy RPC parameter names
    target_post_id: post.id,
    expected_claim_token: activeClaimToken,
    error_message: errorMsg,
    max_attempts: 3,
  } as any);

  if (!rpcErr && retryData) {
    if (!retryData.success) {
      console.warn(`[Publisher] Retry RPC rejected for post ${post.id}: ${retryData.reason}`);
      // Lease was lost, expired, or post was already published!
      // Do NOT mutate post or scheduled_jobs - the winning worker or final state owns the row!
      return;
    }
  } else if (rpcErr && isRpcFunctionMissingError(rpcErr, 'handle_publishing_failure_and_retry')) {
    // Fallback ONLY IF RPC genuinely does not exist in the database schema (e.g. unapplied migration)
    console.warn(`[Publisher] handle_publishing_failure_and_retry RPC missing (${rpcErr.code || rpcErr.message}); falling back to verified CAS update`);
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
  } else if (rpcErr) {
    // Fail closed: Network error, timeout, permission denied, or unexpected SQL error
    console.error(`[Publisher] Fatal database error during handle_publishing_failure_and_retry for post ${post.id}:`, rpcErr);
    // Do NOT bypass concurrency controls or overwrite newer state with direct fallback
    return;
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

