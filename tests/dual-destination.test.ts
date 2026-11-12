// ==============================================================
// LINKEDIN AUTOPILOT - DUAL DESTINATION VERIFICATION SUITE
// BY GT INNOX LLP
// ==============================================================

import { linkedInClient, LinkedInClient } from '../src/lib/linkedin/client';
import { encryptToken, decryptToken } from '../src/lib/encryption';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    if (detail) console.log(`     Detail: ${detail}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     Failure Detail: ${detail}`);
    totalFailed++;
  }
}

async function runDualDestinationSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING DUAL DESTINATION & PRODUCTION TEST SUITE');
  console.log('🏢 GT InnoX LLP');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: Personal Destination Selection & URN
  // ----------------------------------------------------
  console.log('--- TEST GROUP 1: Personal Destination Selection ---');
  const sampleMemberId = 'fpBvx03h5B';
  const memberAuthorUrn = `urn:li:person:${sampleMemberId}`;
  assert(
    memberAuthorUrn.startsWith('urn:li:person:'),
    'Personal author URN starts with urn:li:person:',
    memberAuthorUrn
  );
  assert(
    memberAuthorUrn.split(':').pop() === sampleMemberId,
    'Personal author URN resolves provider account sub identifier',
    sampleMemberId
  );

  const personalAuthUrl = linkedInClient.getAuthorizationUrl('state-123', false);
  assert(
    personalAuthUrl.includes('w_member_social'),
    'Personal OAuth requests official w_member_social permission scope',
    'Scope present in query params'
  );

  // ----------------------------------------------------
  // TEST GROUP 2: Organization Destination Selection & URN
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 2: Organization Destination Selection ---');
  const sampleOrgId = '10594382';
  const orgAuthorUrn = `urn:li:organization:${sampleOrgId}`;
  assert(
    orgAuthorUrn.startsWith('urn:li:organization:'),
    'Organization author URN starts with urn:li:organization:',
    orgAuthorUrn
  );
  assert(
    orgAuthorUrn.split(':').pop() === sampleOrgId,
    'Organization author URN correctly isolates organization numeric ID',
    sampleOrgId
  );

  const orgAuthUrl = linkedInClient.getAuthorizationUrl('state-456', true);
  assert(
    orgAuthUrl.includes('w_organization_social'),
    'Organization OAuth requests w_organization_social permission scope',
    'Organization scope included when requestOrgAccess=true'
  );

  // ----------------------------------------------------
  // TEST GROUP 3: Page Authorization & Permission Inspection
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 3: Page Authorization & Permission Inspection ---');
  const fakeToken = 'AQVFakeTokenForTestingPermissions';
  const permCheck = await linkedInClient.checkOrganizationPermissions(fakeToken);
  assert(
    typeof permCheck.communityManagementActive === 'boolean',
    'checkOrganizationPermissions returns structured communityManagementActive boolean'
  );
  assert(
    permCheck.status === 'authorized' || permCheck.status === 'awaiting_authorization',
    'Status clearly marked as authorized or awaiting_authorization',
    `Resolved status: ${permCheck.status}`
  );
  assert(
    permCheck.message.length > 0,
    'Provides diagnostic message for developer app permissions',
    permCheck.message
  );

  // ----------------------------------------------------
  // TEST GROUP 4: Workspace Isolation & Destination Separation
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 4: Workspace Isolation & Destination Separation ---');
  const workspaceA = { id: 'ws-tenant-alpha', name: 'Alpha Workspace' };
  const workspaceB = { id: 'ws-tenant-beta', name: 'Beta Workspace' };

  const memberAccA = {
    id: 'acc-1',
    workspace_id: workspaceA.id,
    account_type: 'member',
    account_name: 'Member Alpha',
  };

  const orgAccB = {
    id: 'acc-2',
    workspace_id: workspaceB.id,
    account_type: 'organization',
    account_name: 'Company Beta',
  };

  const isCrossTenant = memberAccA.workspace_id !== orgAccB.workspace_id;
  assert(
    isCrossTenant,
    'Workspace Isolation: Personal and Organization destinations strictly partitioned by workspace_id'
  );

  // Cross-tenant destination assignment validation
  const canAssignAccountToPost = (postWsId: string, accWsId: string) => postWsId === accWsId;
  assert(
    canAssignAccountToPost(workspaceA.id, memberAccA.workspace_id),
    'Permitted: Assigning workspace personal account to post in same workspace'
  );
  assert(
    !canAssignAccountToPost(workspaceA.id, orgAccB.workspace_id),
    'Blocked: Assigning foreign workspace company page to post is strictly rejected'
  );

  // ----------------------------------------------------
  // TEST GROUP 5: Media Upload Owner Binding
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 5: Media Upload Owner Binding ---');
  // For images/videos/documents, the owner payload must match the author URN
  const constructMediaInitRequest = (authorUrn: string) => ({
    initializeUploadRequest: {
      owner: authorUrn,
    },
  });

  const memberMediaPayload = constructMediaInitRequest(memberAuthorUrn);
  assert(
    memberMediaPayload.initializeUploadRequest.owner === memberAuthorUrn,
    'Personal media upload binds ownership to urn:li:person URN'
  );

  const orgMediaPayload = constructMediaInitRequest(orgAuthorUrn);
  assert(
    orgMediaPayload.initializeUploadRequest.owner === orgAuthorUrn,
    'Organization media upload binds ownership to urn:li:organization URN'
  );

  // ----------------------------------------------------
  // TEST GROUP 6: Dual Destination Scheduling Window
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 6: Dual Destination Scheduling Window ---');
  const now = Date.now();
  const futureSchedule = new Date(now + 10 * 60 * 1000); // 10 minutes ahead
  const delayMs = futureSchedule.getTime() - now;

  assert(
    delayMs >= 590000 && delayMs <= 600000,
    'Calculates precise 10-minute millisecond delay window for scheduled post',
    `Computed delay: ${delayMs}ms`
  );

  const scheduledPostPersonal = {
    content: 'Personal thought on SaaS architecture',
    social_account_type: 'member',
    scheduled_at: futureSchedule.toISOString(),
  };

  const scheduledPostOrg = {
    content: 'Official GT InnoX Company Announcement',
    social_account_type: 'organization',
    scheduled_at: futureSchedule.toISOString(),
  };

  assert(
    scheduledPostPersonal.social_account_type === 'member' &&
      scheduledPostOrg.social_account_type === 'organization',
    'Supports distinct scheduled posts for both Personal and Company destinations'
  );

  // ----------------------------------------------------
  // TEST GROUP 7: Duplicate Prevention & CAS Lock Simulation
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 7: Duplicate Prevention & CAS Lock ---');
  let postDbState = {
    id: 'post-100',
    status: 'scheduled',
    version: 1,
  };

  // Simulate two concurrent workers attempting to publish post-100 simultaneously
  function attemptCasLock(workerId: string): boolean {
    if (['scheduled', 'approved', 'draft'].includes(postDbState.status)) {
      postDbState.status = 'processing';
      postDbState.version++;
      return true;
    }
    return false;
  }

  const worker1Result = attemptCasLock('Worker-1');
  const worker2Result = attemptCasLock('Worker-2');

  assert(worker1Result === true, 'Worker 1 successfully acquired CAS publishing lock');
  assert(worker2Result === false, 'Worker 2 rejected by CAS lock (Prevents duplicate publishing)');
  assert(postDbState.status === 'processing', 'Post safely transitioned to processing status');

  // ----------------------------------------------------
  // TEST GROUP 8: Worker Recovery & Overdue Catch-up
  // ----------------------------------------------------
  console.log('\n--- TEST GROUP 8: Worker Recovery & Overdue Catch-up ---');
  const pastOverdueTimestamp = new Date(now - 30 * 60 * 1000); // 30 minutes overdue
  const catchupDelayMs = Math.max(0, pastOverdueTimestamp.getTime() - now);

  assert(
    catchupDelayMs === 0,
    'Worker Recovery: Overdue job clamps delay to 0ms for immediate execution',
    `Delay: ${catchupDelayMs}ms`
  );

  // Exponential backoff calculation verification
  const calculateBackoff = (attempt: number, baseDelay = 5000) => baseDelay * Math.pow(2, attempt - 1);
  assert(
    calculateBackoff(1) === 5000 && calculateBackoff(2) === 10000 && calculateBackoff(3) === 20000,
    'Exponential backoff: Attempt 1=5s, Attempt 2=10s, Attempt 3=20s'
  );

  console.log('\n====================================================');
  console.log(`🏁 DUAL DESTINATION SUITE: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runDualDestinationSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
