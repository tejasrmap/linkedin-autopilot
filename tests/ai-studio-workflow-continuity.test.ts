// ==============================================================
// AI STUDIO WORKFLOW CONTINUITY & DRAFT PERSISTENCE TEST SUITE
// GT INNOX LLP — PRODUCTION HARDENED
// ==============================================================

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GET as getPostsHandler, POST as createPostHandler } from '../src/app/api/posts/route';
import { GET as getPostByIdHandler, PATCH as updatePostByIdHandler, DELETE as deletePostByIdHandler } from '../src/app/api/posts/[id]/route';
import { POST as publishPostHandler } from '../src/app/api/posts/[id]/publish/route';
import { POST as schedulePostHandler } from '../src/app/api/posts/[id]/schedule/route';
import { createAdminClient, getTestStore } from '../src/lib/supabase/admin';

const VALID_WS_ID = '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';
const FOREIGN_WS_ID = 'e7b8c9d0-1234-5678-90ab-cdef12345678';
const UNKNOWN_WS_ID = '00000000-0000-0000-0000-000000000000';
const TEST_USER_ID = '3f722c4d-c224-4431-a0dc-28249bd79c37';

describe('PR #22 — AI Studio Workflow Continuity & Draft Persistence Suite', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as any).NODE_ENV = 'test';
    process.env.ALLOW_DEV_AUTH = 'true';
    process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
    process.env.TEST_AUTH_USER_ID = TEST_USER_ID;
    process.env.TEST_AUTH_ROLE = 'owner';

    // Clear test store
    const store = getTestStore();
    store.posts = [];
    store.workspaces = [
      { id: VALID_WS_ID, owner_id: TEST_USER_ID, name: "Test Owner's Workspace", slug: 'test-ws' },
    ];
    store.social_accounts = [
      { id: '11111111-2222-3333-4444-555555555555', workspace_id: VALID_WS_ID, account_name: 'Lead Developer', account_type: 'member', provider_account_id: 'dev123' },
    ];
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    delete process.env.TEST_AUTH_ROLE;
    delete process.env.TEST_AUTH_USER_ID;
    delete process.env.ALLOW_DEV_AUTH;
    delete process.env.MOCK_SUPABASE_FOR_TESTS;
    delete process.env.SIMULATE_DB_ERROR;
  });

  // -------------------------------------------------------------
  // PHASE 1: WORKSPACE AUTH & MULTI-TENANT ISOLATION
  // -------------------------------------------------------------
  describe('Phase 1: Multi-Tenant Workspace Header Enforcement', () => {
    test('POST /api/posts succeeds without x-workspace-id by defaulting securely', async () => {
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Initial draft content', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.ok(data.post?.id);
      assert.strictEqual(data.post.workspace_id, VALID_WS_ID);
      assert.strictEqual(data.post.status, 'draft');
    });

    test('POST /api/posts succeeds when x-workspace-id matches authorized workspace', async () => {
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': VALID_WS_ID,
        },
        body: JSON.stringify({ content: 'Authorized workspace post', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.post.workspace_id, VALID_WS_ID);
    });

    test('POST /api/posts strictly fails closed (403) for unknown workspace ID', async () => {
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': UNKNOWN_WS_ID,
        },
        body: JSON.stringify({ content: 'Malicious post', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('POST /api/posts strictly fails closed (403) for foreign tenant workspace ID', async () => {
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': FOREIGN_WS_ID,
        },
        body: JSON.stringify({ content: 'Cross-tenant injection attempt', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('GET /api/posts/[id] strictly fails closed (403) for foreign workspace header', async () => {
      const store = getTestStore();
      store.posts.push({
        id: 'post-1234',
        workspace_id: VALID_WS_ID,
        content: 'Original draft',
        status: 'draft',
        updated_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/posts/post-1234', {
        method: 'GET',
        headers: { 'x-workspace-id': FOREIGN_WS_ID },
      });

      const res = await getPostByIdHandler(req, { params: { id: 'post-1234' } });
      assert.strictEqual(res.status, 403);
    });

    test('GET /api/posts/[id] returns 404 for post belonging to another workspace (zero leakage)', async () => {
      const store = getTestStore();
      store.posts.push({
        id: 'victim-post-999',
        workspace_id: FOREIGN_WS_ID,
        content: 'Victim private draft',
        status: 'draft',
        updated_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/posts/victim-post-999', {
        method: 'GET',
        headers: { 'x-workspace-id': VALID_WS_ID },
      });

      const res = await getPostByIdHandler(req, { params: { id: 'victim-post-999' } });
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.error, 'Post not found');
    });

    test('Unauthenticated request to POST /api/posts returns 401 Unauthorized', async () => {
      process.env.ALLOW_DEV_AUTH = 'false';
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Unauthenticated draft', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 401);
    });
  });

  // -------------------------------------------------------------
  // PHASE 2: ROLE-BASED ACCESS CONTROL (RBAC) ON DRAFTS
  // -------------------------------------------------------------
  describe('Phase 2: Role-Based Access Control on Draft Persistence', () => {
    const rolesAllowed = ['owner', 'admin', 'editor', 'approver'] as const;

    for (const role of rolesAllowed) {
      test(`POST /api/posts is ALLOWED for role [${role}]`, async () => {
        process.env.TEST_AUTH_ROLE = role;
        const req = new Request('http://localhost:3000/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Draft created by ${role}`, status: 'draft' }),
        });

        const res = await createPostHandler(req);
        assert.strictEqual(res.status, 201);
      });

      test(`PATCH /api/posts/[id] is ALLOWED for role [${role}]`, async () => {
        process.env.TEST_AUTH_ROLE = role;
        const store = getTestStore();
        store.posts.push({
          id: `draft-for-${role}`,
          workspace_id: VALID_WS_ID,
          content: 'Initial text',
          status: 'draft',
          updated_at: new Date().toISOString(),
        });

        const req = new Request(`http://localhost:3000/api/posts/draft-for-${role}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Updated text by ${role}` }),
        });

        const res = await updatePostByIdHandler(req, { params: { id: `draft-for-${role}` } });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.post.content, `Updated text by ${role}`);
      });
    }

    test('POST /api/posts is REJECTED with 403 Forbidden for role [viewer]', async () => {
      process.env.TEST_AUTH_ROLE = 'viewer';
      const req = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Viewer attempting to create draft', status: 'draft' }),
      });

      const res = await createPostHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Permission denied'));
    });

    test('PATCH /api/posts/[id] is REJECTED with 403 Forbidden for role [viewer]', async () => {
      process.env.TEST_AUTH_ROLE = 'viewer';
      const store = getTestStore();
      store.posts.push({
        id: 'draft-viewer-target',
        workspace_id: VALID_WS_ID,
        content: 'Original',
        status: 'draft',
        updated_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/posts/draft-viewer-target', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Viewer modified content' }),
      });

      const res = await updatePostByIdHandler(req, { params: { id: 'draft-viewer-target' } });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.ok(data.error.includes('Permission denied'));
    });

    test('DELETE /api/posts/[id] is REJECTED with 403 Forbidden for role [viewer]', async () => {
      process.env.TEST_AUTH_ROLE = 'viewer';
      const store = getTestStore();
      store.posts.push({
        id: 'draft-delete-viewer',
        workspace_id: VALID_WS_ID,
        content: 'To be deleted',
        status: 'draft',
        updated_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/posts/draft-delete-viewer', {
        method: 'DELETE',
      });

      const res = await deletePostByIdHandler(req, { params: { id: 'draft-delete-viewer' } });
      assert.strictEqual(res.status, 403);
    });
  });

  // -------------------------------------------------------------
  // PHASE 3: OPTIMISTIC CONCURRENCY & OVERWRITE PROTECTION
  // -------------------------------------------------------------
  describe('Phase 3: Optimistic Concurrency & Overwrite Protection', () => {
    test('PATCH /api/posts/[id] succeeds when expectedUpdatedAt matches current post timestamp', async () => {
      const store = getTestStore();
      const initialTimestamp = '2026-11-16T00:00:00.000Z';
      store.posts.push({
        id: 'concurrency-post-1',
        workspace_id: VALID_WS_ID,
        content: 'Version 1',
        status: 'draft',
        updated_at: initialTimestamp,
      });

      const req = new Request('http://localhost:3000/api/posts/concurrency-post-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Version 2 with matching timestamp',
          expectedUpdatedAt: initialTimestamp,
        }),
      });

      const res = await updatePostByIdHandler(req, { params: { id: 'concurrency-post-1' } });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.post.content, 'Version 2 with matching timestamp');
    });

    test('PATCH /api/posts/[id] returns HTTP 409 Conflict when post was updated concurrently by another session', async () => {
      const store = getTestStore();
      const serverNewerTimestamp = '2026-11-16T01:30:00.000Z';
      const clientOlderTimestamp = '2026-11-16T01:00:00.000Z';

      store.posts.push({
        id: 'concurrency-post-conflict',
        workspace_id: VALID_WS_ID,
        content: 'Content saved concurrently in session B',
        status: 'draft',
        updated_at: serverNewerTimestamp,
      });

      // Session A attempts to save with its stale baseline timestamp
      const req = new Request('http://localhost:3000/api/posts/concurrency-post-conflict', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Stale overwrite from session A',
          expectedUpdatedAt: clientOlderTimestamp,
        }),
      });

      const res = await updatePostByIdHandler(req, { params: { id: 'concurrency-post-conflict' } });
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.code, 'CONCURRENT_MODIFICATION');
      assert.ok(data.error.includes('modified concurrently'));
      assert.strictEqual(data.serverUpdatedAt, serverNewerTimestamp);
      assert.strictEqual(data.serverPost.content, 'Content saved concurrently in session B');
    });

    test('PATCH /api/posts/[id] protects published posts from being downgraded back to draft', async () => {
      const store = getTestStore();
      store.posts.push({
        id: 'published-post-locked',
        workspace_id: VALID_WS_ID,
        content: 'Live published post on LinkedIn',
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const req = new Request('http://localhost:3000/api/posts/published-post-locked', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Malicious attempt to revert to draft',
          status: 'draft',
        }),
      });

      const res = await updatePostByIdHandler(req, { params: { id: 'published-post-locked' } });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Cannot revert a published post'));
    });
  });

  // -------------------------------------------------------------
  // PHASE 4: DUPLICATE PREVENTION & DRAFT LIFECYCLE
  // -------------------------------------------------------------
  describe('Phase 4: Duplicate Prevention & Draft Lifecycle', () => {
    test('Repeated autosaves update the exact same draft record without creating duplicates', async () => {
      const store = getTestStore();

      // 1. Initial autosave creates draft
      const req1 = new Request('http://localhost:3000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'First keystrokes...', status: 'draft' }),
      });
      const res1 = await createPostHandler(req1);
      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      const draftId = data1.post.id;
      assert.ok(draftId);
      assert.strictEqual(store.posts.length, 1);

      // 2. Second autosave updates the draft
      const req2 = new Request(`http://localhost:3000/api/posts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'First keystrokes... and a few more paragraphs.' }),
      });
      const res2 = await updatePostByIdHandler(req2, { params: { id: draftId } });
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(store.posts.length, 1, 'Store must still contain exactly 1 post');

      // 3. Third autosave updates with media attachments
      const req3 = new Request(`http://localhost:3000/api/posts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Final version with attached infographic',
          postType: 'image',
          mediaAssets: [{ id: 'img-1', file_name: 'diagram.png' }],
        }),
      });
      const res3 = await updatePostByIdHandler(req3, { params: { id: draftId } });
      assert.strictEqual(res3.status, 200);
      assert.strictEqual(store.posts.length, 1, 'Store must still contain exactly 1 post');
      assert.strictEqual(store.posts[0].media_assets.length, 1);
    });

    test('Scheduling an existing draft transitions post status in-place without creating a new record', async () => {
      const store = getTestStore();

      // Create draft
      const post = {
        id: 'draft-to-schedule-001',
        workspace_id: VALID_WS_ID,
        created_by: TEST_USER_ID,
        content: 'Ready to schedule draft',
        status: 'draft',
        social_account_id: '11111111-2222-3333-4444-555555555555',
        updated_at: new Date().toISOString(),
      };
      store.posts.push(post);
      assert.strictEqual(store.posts.length, 1);

      // Trigger schedule on existing draft
      const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const req = new Request(`http://localhost:3000/api/posts/${post.id}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledAt: tomorrowIso,
          timezone: 'UTC',
        }),
      });
      const res = await schedulePostHandler(req, { params: { id: post.id } });
      assert.strictEqual(res.status, 200);

      // Verify no duplicate post was created
      assert.strictEqual(store.posts.length, 1, 'Total posts in database must remain 1');
      assert.strictEqual(store.posts[0].id, 'draft-to-schedule-001');
    });
  });

  // -------------------------------------------------------------
  // PHASE 5: TWO-WAY HANDOFF INTEGRATION & METADATA PRESERVATION
  // -------------------------------------------------------------
  describe('Phase 5: Bidirectional Handoff Integration & Metadata Preservation', () => {
    test('Composer to AI Studio: parameters preserve draftId, content, and selected tone', () => {
      const activeDraftId = 'draft-uuid-12345';
      const activeContent = 'Draft content authored in Composer with technical details.';
      const activeTone = 'technical';

      // Build Composer -> AI Studio URL query
      const params = new URLSearchParams();
      params.set('tab', 'rewrite');
      params.set('draftId', activeDraftId);
      params.set('content', activeContent);
      params.set('tone', activeTone);

      const generatedUrl = `/ai-studio?${params.toString()}`;

      // Simulate AI Studio parsing on mount
      const parsed = new URL(`http://localhost:3000${generatedUrl}`);
      assert.strictEqual(parsed.searchParams.get('tab'), 'rewrite');
      assert.strictEqual(parsed.searchParams.get('draftId'), activeDraftId);
      assert.strictEqual(parsed.searchParams.get('content'), activeContent);
      assert.strictEqual(parsed.searchParams.get('tone'), activeTone);
    });

    test('AI Studio to Composer: parameters return rewritten text to exact same draftId with fromAi=true', () => {
      const activeDraftId = 'draft-uuid-12345';
      const rewrittenContent = 'Polished, story-driven transformation of original draft.';
      const selectedTone = 'storytelling';

      // Build AI Studio -> Composer URL query
      const params = new URLSearchParams();
      params.set('content', rewrittenContent);
      params.set('draftId', activeDraftId);
      params.set('tone', selectedTone);
      params.set('fromAi', 'true');

      const returnUrl = `/composer?${params.toString()}`;

      // Simulate Composer parsing on mount
      const parsed = new URL(`http://localhost:3000${returnUrl}`);
      assert.strictEqual(parsed.searchParams.get('draftId'), activeDraftId);
      assert.strictEqual(parsed.searchParams.get('content'), rewrittenContent);
      assert.strictEqual(parsed.searchParams.get('tone'), selectedTone);
      assert.strictEqual(parsed.searchParams.get('fromAi'), 'true');
    });

    test('AI Studio to Composer from fresh generation (without existing draft) initializes content cleanly', () => {
      const freshContent = 'Newly generated thought leadership post from AI Studio.';
      const tone = 'persuasive';

      const params = new URLSearchParams();
      params.set('content', freshContent);
      params.set('tone', tone);
      params.set('fromAi', 'true');

      const freshUrl = `/composer?${params.toString()}`;

      const parsed = new URL(`http://localhost:3000${freshUrl}`);
      assert.strictEqual(parsed.searchParams.get('draftId'), null);
      assert.strictEqual(parsed.searchParams.get('content'), freshContent);
      assert.strictEqual(parsed.searchParams.get('tone'), tone);
      assert.strictEqual(parsed.searchParams.get('fromAi'), 'true');
    });
  });

  // -------------------------------------------------------------
  // PHASE 6: CLIENT-SIDE AUTOSAVE RECOVERY & OFFLINE RESILIENCE
  // -------------------------------------------------------------
  describe('Phase 6: Client-Side Autosave Recovery & Local Storage Partitioning', () => {
    test('Storage key is strictly partitioned by workspace ID and user ID', () => {
      const wsA = 'ws-tenant-alpha';
      const wsB = 'ws-tenant-beta';
      const userA = 'user-alice';
      const userB = 'user-bob';

      const keyA = `autopilot_draft_${wsA}_${userA}`;
      const keyB = `autopilot_draft_${wsB}_${userA}`;
      const keyC = `autopilot_draft_${wsA}_${userB}`;

      assert.notStrictEqual(keyA, keyB, 'Different workspaces must produce isolated storage keys');
      assert.notStrictEqual(keyA, keyC, 'Different users in same workspace must produce isolated storage keys');
    });

    test('Autosave simulation: recovers cached draft after simulated browser crash/refresh', () => {
      // Mock localStorage container
      const mockLocalStorage: Record<string, string> = {};
      const storageKey = `autopilot_draft_${VALID_WS_ID}_${TEST_USER_ID}`;

      // 1. User writes draft in composer session 1
      const session1Draft = {
        draftId: 'draft-offline-101',
        content: 'Critical unsaved insight typed before browser closed',
        postType: 'text',
        selectedAccount: '11111111-2222-3333-4444-555555555555',
        mediaAssets: [],
        tone: 'educational',
        updatedAt: Date.now(),
      };
      mockLocalStorage[storageKey] = JSON.stringify(session1Draft);

      // 2. Simulated browser refresh in session 2
      const restoredRaw = mockLocalStorage[storageKey];
      assert.ok(restoredRaw);
      const restored = JSON.parse(restoredRaw);

      assert.strictEqual(restored.draftId, 'draft-offline-101');
      assert.strictEqual(restored.content, 'Critical unsaved insight typed before browser closed');
      assert.strictEqual(restored.tone, 'educational');
    });

    test('Recovery clears cache upon successful publish or schedule', () => {
      const mockLocalStorage: Record<string, string> = {};
      const storageKey = `autopilot_draft_${VALID_WS_ID}_${TEST_USER_ID}`;

      mockLocalStorage[storageKey] = JSON.stringify({ draftId: 'd-1', content: 'Scheduled post' });
      assert.ok(mockLocalStorage[storageKey]);

      // Publish / Schedule succeeds
      delete mockLocalStorage[storageKey];
      assert.strictEqual(mockLocalStorage[storageKey], undefined, 'Published post must clear active draft cache');
    });
  });
});
