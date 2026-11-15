# AI Studio Workflow Continuity — Architecture Assessment & Audit

**Project:** LinkedIn Autopilot SaaS  
**Author:** Antigravity Engineering  
**Date:** November 16, 2026  
**Scope:** AI Content Studio & Composer Two-Way Integration, Autosave, Draft Persistence, RBAC, and Concurrency Control.

---

## 1. Executive Summary

LinkedIn Autopilot SaaS features two primary content authoring surfaces:
1. **AI Content Studio (`/ai-studio`)**: Multi-tab generative suite (Generate, Rewrite, Hashtags, Ideas, 7-Day Calendar, Brand Voice Settings, and Certificate Announcements).
2. **Post Studio & Composer (`/composer`)**: Rich post authoring surface with media attachments, character counting, live LinkedIn preview, destination switcher (Personal Profile vs Company Page), and immediate or scheduled publishing.

Previously, these two interfaces operated with significant workflow discontinuities:
- Navigation from AI Studio to Composer passed raw text via URL query parameters (`/composer?content=...`), but Composer had no concept of an underlying draft ID (`draftId`), causing every save action to create a new duplicate post record.
- Navigation from Composer to AI Studio (`router.push('/ai-studio')`) dropped the current post content and tone completely.
- In-progress edits in both Composer and AI Studio lacked automatic persistence: a page reload, network drop, or accidental navigation resulted in lost work.
- In `/api/posts` and `/api/posts/[id]`, incoming `x-workspace-id` headers were not forwarded to the authentication resolver, and `PATCH /api/posts/[id]` lacked role-based authorization checks (RBAC) and optimistic concurrency safeguards.

This audit details the architectural strategy to establish seamless, bidirectional workflow continuity and rock-solid persistence without requiring a schema migration or new database tables.

---

## 2. Component State & Workflow Audit

### 2.1 AI Studio State Management (`src/app/ai-studio/page.tsx`)
- **Tabs**:
  - `generate`: Generates grounded LinkedIn posts from topics, with length, tone, and audience configurations.
  - `rewrite`: Rewrites user drafts into various stylistic tones (`storytelling`, `professional`, `conversational`, `technical`, `educational`, `persuasive`).
  - `hashtags`: Extracts contextual hashtags.
  - `ideas`: Brainstorms content pillars and angles.
  - `calendar`: Plans 7-day thematic posting schedules.
  - `brand`: Configures workspace brand name, industry, and tone voice.
- **Previous Integration Mechanism**:
  - AI Studio used one-way buttons: `sendToComposer(text)` which invoked `router.push('/composer?content=' + encodeURIComponent(text))`.
  - It did not pass existing `draftId`, source tab, or tone metadata.
  - It could not receive drafts back from Composer for iterative refining.
- **Autosave State**:
  - In-progress generations and prompt drafts were stored strictly in component memory. A browser refresh wiped the active tab's drafts.

### 2.2 Composer State Management (`src/app/composer/page.tsx`)
- **State Fields**:
  - `content`: Text of the post (max 3,000 characters).
  - `selectedAccount`: LinkedIn member or organization account ID.
  - `destinationType`: `'member' | 'organization'`.
  - `mediaAssets`: Array of attached images, videos, or documents.
  - `postType`: `'text' | 'image' | 'video' | 'document'`.
  - `scheduleMode`, `scheduledDate`, `scheduledTime`, `timezone`.
- **Previous Shortcomings**:
  - Did not inspect or retain `draftId` from URL search parameters or session storage.
  - On "Save Draft", "Schedule Post", or "Publish Now", Composer unconditionally invoked `POST /api/posts`, creating a brand-new post record even if the user was editing a previously saved draft.
  - "Enhance with AI Studio" button simply routed to `/ai-studio` without carrying over the draft text or tone.
  - No visual save status indicator (Saved, Saving, Unsaved, Error, Conflict).
  - No background autosave.

### 2.3 Post Management & Listing (`src/app/posts/page.tsx`)
- Drafts are listed under the "Drafts" tab (`/posts?tab=draft`).
- "Edit in Composer" previously navigated to `/composer?content=${encodeURIComponent(viewingPost.content)}` without `draftId`, creating duplicates upon subsequent saving.

---

## 3. Database Schema & RLS Policy Evaluation

### 3.1 Can Existing Tables Support Workflow Continuity?
**Yes.** The existing `public.posts` table in Supabase already contains all necessary fields:
```sql
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    media_assets JSONB DEFAULT '[]'::JSONB,
    post_type TEXT NOT NULL DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'document', 'article')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'UTC',
    published_at TIMESTAMPTZ,
    provider_post_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### 3.2 Database Migration Proposal Assessment
- **Conclusion**: **NO NEW TABLE OR SCHEMA MIGRATION IS REQUIRED.**
- Creating a separate `drafts` table would fragment the data model, introduce data duplication, require complex synchronizations when publishing, and break existing foreign keys with `scheduled_jobs` and analytics.
- By using `status = 'draft'` on `posts`, drafts natively participate in existing tenant isolation, foreign keys, and access controls.

---

## 4. Architecture Implementation Plan

### 4.1 Server-Side Hardening (`/api/posts` & `/api/posts/[id]`)
1. **Workspace Header Support**:
   - Extract `request.headers.get('x-workspace-id')` in all routes (`POST /api/posts`, `GET /api/posts`, `GET /api/posts/[id]`, `PATCH /api/posts/[id]`, `DELETE /api/posts/[id]`).
   - Pass to `getAuthContext(requestWorkspaceId)`. If the user is not a verified member of the requested workspace, fail closed with `HTTP 403 Forbidden`.
2. **RBAC Enforcements**:
   - Creating or modifying posts (`POST /api/posts`, `PATCH /api/posts/[id]`, `DELETE /api/posts/[id]`) requires role in `['owner', 'admin', 'editor', 'approver']`.
   - `viewer` role is strictly rejected with `HTTP 403 Forbidden: Permission denied`.
3. **Optimistic Concurrency Control**:
   - In `PATCH /api/posts/[id]`, accept optional `expectedUpdatedAt: string`.
   - If provided and the stored `updated_at` in the database is newer than `expectedUpdatedAt` (beyond a 1000ms threshold), reject with `HTTP 409 Conflict` and return the server's current record.
4. **Draft Immutability Guards**:
   - Reject attempts to downgrade a `published` post back to `draft`.

### 4.2 Client-Side Draft Persistence & Autosave Engine
1. **State Machine**:
   - Save statuses: `'saved'`, `'saving'`, `'unsaved'`, `'error'`, `'conflict'`, `'offline'`.
2. **Autosave Engine**:
   - Debounced at 1,500ms.
   - Saves immediately to localized storage (`sessionStorage` / `localStorage` scoped by `autopilot_draft_${workspaceId}_${userId}`) to protect against crash/refresh before network round-trip.
   - If `draftId` is null, calls `POST /api/posts` with `status: 'draft'`, obtains `post.id`, and updates browser URL via `window.history.replaceState` to `/composer?draftId=${id}`.
   - If `draftId` exists, calls `PATCH /api/posts/${draftId}` with updated fields and `expectedUpdatedAt`.
   - On manual Save, Schedule, or Publish, the existing `draftId` is updated rather than creating a duplicate.
3. **Save Status Indicator UI**:
   - Visible badge in Composer indicating real-time sync state.
   - Retry trigger on network failure.
   - Conflict notification on concurrent modification.

### 4.3 Bidirectional Two-Way Integration (Composer <-> AI Studio)
1. **Composer to AI Studio**:
   - User clicks "Enhance with AI" in Composer.
   - Navigates to `/ai-studio?tab=rewrite&draftId=${draftId}&content=${encodeURIComponent(content)}&tone=${tone}`.
2. **AI Studio to Composer**:
   - AI Studio receives `draftId`, `content`, and `tone`.
   - Pre-populates the "Rewrite" input and shows an active banner: "Enhancing Composer Draft: [ID]. Changes will update your active draft without creating duplicates."
   - User generates the rewrite.
   - "Return to Composer" navigates to `/composer?draftId=${draftId}&content=${encodeURIComponent(rewrittenPost)}&tone=${tone}&fromAi=true`.
   - Composer updates the active draft content and autosaves to the same `draftId`.

---

## 5. Security & Isolation Matrix

| Scenario | Expected Behavior | Enforced Layer |
| :--- | :--- | :--- |
| Unauthenticated request | `HTTP 401 Unauthorized` | Server `getAuthContext` |
| Foreign workspace header | `HTTP 403 Forbidden: Access denied to requested workspace` | Server `getAuthContext` |
| Viewer role attempting save/update | `HTTP 403 Forbidden: Permission denied` | Server Route Handler |
| Accessing draft of another workspace | `HTTP 404 Not Found` (Zero knowledge leak) | Server Database Scope (`workspace_id`) |
| Concurrent update conflict | `HTTP 409 Conflict: Draft modified concurrently` | Server Route Handler |
| Browser refresh in Composer | Restores exact draft and continues with same `draftId` | Client Engine + Server Persistence |
| Multiple edits and saves | Single post ID updated; zero duplicates created | Client + Server Contract |

