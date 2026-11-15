# AI Content Studio Architecture & Quality Audit

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Production URL:** `https://autopilot.gtinnox.in`  
**Base Commit:** `1bc272ebc626c01ad7ab4b7386e64993ab50531e` (PR #20 merge)  
**Date:** 16 November 2026  
**Auditor:** Principal AI & Full-Stack Architect  
**Audit Status:** COMPLETE — ARCHITECTURE INSPECTED & ACTIONABLE ROADMAP FORMULATED

---

## 1. Existing Architecture & Feature Inventory

The AI Content Studio in LinkedIn Autopilot comprises six primary content generation and optimization tools distributed across dedicated pages and serverless API endpoints.

```
                           +-------------------------------------+
                           |         AI Studio Frontend          |
                           |   /ai-studio & /ai-studio/cert      |
                           +------------------+------------------+
                                              |
      +--------------------+------------------+--------------------+--------------------+
      |                    |                  |                    |                    |
+-----v-------+      +-----v-------+    +-----v-------+      +-----v-------+      +-----v-------+
|  Generate   |      |   Rewrite   |    |  Hashtags   |      |    Ideas    |      |  Calendar   |
| /ai/generate|      | /ai/rewrite |    | /ai/hashtags|      | /ai/ideas   |      | /ai/calendar|
+-----+-------+      +-----+-------+    +-----+-------+      +-----+-------+      +-----+-------+
      |                    |                  |                    |                    |
+-----v--------------------v------------------v--------------------v--------------------v-----+
|                           Central AI Service & Model Adapter                                |
|                        (src/lib/ai/gemini.ts & content-intelligence.ts)                     |
+---------------------------------------------+-----------------------------------------------+
                                              |
      +---------------------------------------+---------------------------------------+
      |                                       |                                       |
+-----v----------------------+ +--------------v-------------+ +-----------------------v-------+
|  WritingProfileEngine      | |   UniquenessEngine         | |   Google Gemini 1.5 Flash     |
|  (User vs Brand Isolation) | |   (Quality Gate & Scoring) | |   (Text & Vision Multi-Modal) |
+----------------------------+ +----------------------------+ +-------------------------------+
```

### Feature Inventory

| Tool / Route | Endpoint | Primary Engine / Module | Input Schema | Output Schema | Target Destination |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Post Generator** | `POST /api/ai/generate` | `ContentIntelligenceEngine`, `UniquenessEngine`, `WritingProfileEngine` | `topic`, `audience`, `tone`, `length`, `contentType`, `generationMode`, `narrativeArc`, `useBrandVoice`, `historyScope` | `content`, `uniquenessScore`, `qualityStatus`, `qualityWarnings`, `topicAnalysis`, `retriesUsed` | `/composer?content=...` or Copy |
| **Tone Rewrite** | `POST /api/ai/rewrite` | `aiService.rewritePost` | `content`, `targetTone`, `improveHook` | `content` (rewritten draft) | `/composer?content=...` or Copy |
| **Hashtag Lab** | `POST /api/ai/hashtags` | `aiService.generateHashtags` | `topic`, `count` (default 6) | `hashtags: string[]` | Copy / Copy All |
| **Viral Ideas** | `POST /api/ai/ideas` | `aiService.generateIdeas` | `industry`, `count` (default 5) | `ideas: [{ title, hook, outline, fullDraft }]` | `/composer?content=...` or Copy |
| **7-Day Calendar** | `POST /api/ai/calendar` | `aiService.generateContentCalendar` | `industry`, `tone` | `plan: [{ day, theme, hook, format, contentType, fullDraft }]` | Inline Editor, Bulk Schedule (`/api/posts/bulk`) |
| **Brand Settings** | `GET / PUT /api/brand-settings` | Supabase `brand_settings` Table | `brandName`, `industry`, `targetAudience`, `brandVoice`, `preferredHashtags` | Saved brand settings entity | Configures `useBrandVoice` across AI tools |
| **Certificate Generator** | `POST /api/ai/certificate` | Gemini 1.5 Flash Vision, Signature Screening | Multipart `certificate` (PDF, PNG, JPG), optional `verificationUrl` | `certificate: {...}`, `announcement`, `verificationStatus`, `stored: false` | `/composer?content=...` or Copy |

---

## 2. Current Implementation Assessment

### Strengths
1. **Sophisticated Grounded Post Generation:** PR #18 successfully introduced domain-specific ontologies, 15 narrative arcs, and a 6-dimension quality scoring engine (`topicRelevance`, `subjectSpecificDetail`, `originality`, `writingNaturalness`, `factualGrounding`, `audienceValue`).
2. **Strict History Scoping Architecture:** The three-scope model (`user_personal`, `workspace_brand`, `unpersonalized`) cleanly isolates private writing profiles and historical uniqueness checks between tenants and users.
3. **Hardened Certificate Route:** PR #20 established authoritative binary magic-number signatures, lightweight structural screening (`IHDR`, `EOI`, `%%EOF`), ephemeral in-memory processing (`stored: false`), and fail-closed workspace resolution.

### Architectural Weaknesses
1. **Asymmetric Route Security:** While `/api/ai/certificate` received rigorous multi-tenant header inspection and fail-closed workspace verification, the older routes (`ideas`, `hashtags`, `calendar`, `rewrite`, `generate`, and `brand-settings`) call `getAuthContext()` without parameters, ignoring `x-workspace-id`.
2. **Missing UI Data Synchronization:** Data created in AI Studio does not persist across tab navigation or page reloads. The database records generations in `ai_generations`, but no endpoint or UI exists to view or restore history.
3. **Disconnected Workflows:** The Certificate Announcement Generator lives on an isolated page (`/ai-studio/certificate`) and is absent from the main AI Studio tab navigation.
4. **One-Way Composer Integration:** Content flows from AI Studio to Composer via query string, but Composer cannot send text back into AI Studio for tone rewriting or hook improvement without manual copy-pasting.

---

## 3. Critical Bugs & Reliability Risks

### Issue 1: Brand Settings Never Fetched on Page Load (UI State Overwrite Bug)
- **File:** [`src/app/ai-studio/page.tsx`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/ai-studio/page.tsx#L102-L135)
- **Severity:** High (Functional Defect)
- **Description:** `AIStudioPage` initializes brand state with hardcoded placeholders (`brandName: 'GT InnoX LLP'`, `brandIndustry: 'AI & Software Engineering'`, `brandVoice: 'Visionary, rigorous, results-focused'`). While `handleSaveBrand` successfully sends `PUT /api/brand-settings`, the component never calls `GET /api/brand-settings` on mount.
- **Impact:** When a user refreshes or reopens AI Studio, their saved brand voice disappears from the form and reverts to `GT InnoX LLP`. If they save again, they accidentally overwrite their actual brand settings with the default placeholders.

### Issue 2: Missing `x-workspace-id` Support in Auxiliary AI Routes
- **Files:** 
  - [`src/app/api/ai/generate/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/ai/generate/route.ts#L35)
  - [`src/app/api/ai/rewrite/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/ai/rewrite/route.ts#L22)
  - [`src/app/api/ai/ideas/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/ai/ideas/route.ts#L20)
  - [`src/app/api/ai/hashtags/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/ai/hashtags/route.ts#L20)
  - [`src/app/api/ai/calendar/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/ai/calendar/route.ts#L20)
  - [`src/app/api/brand-settings/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/brand-settings/route.ts#L18)
- **Severity:** High (Multi-Tenant Isolation Gap)
- **Description:** These endpoints call `await getAuthContext()` with zero arguments.
- **Impact:** Multi-workspace users cannot switch their active workspace when using AI Studio. If a client sends `x-workspace-id: <secondary-workspace-uuid>`, the API silently executes against the user's default workspace instead of the requested workspace, and never fails closed if an unknown workspace is specified.

### Issue 3: Unrestricted Brand Settings Mutation (RBAC Bypass)
- **File:** [`src/app/api/brand-settings/route.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/app/api/brand-settings/route.ts#L34-L65)
- **Severity:** High (Access Control Violation)
- **Description:** `PUT /api/brand-settings` executes an upsert using `createAdminClient()`. It authenticates the user but does not verify `auth.role`.
- **Impact:** A read-only `viewer` or standard `editor` can overwrite company-wide brand guidelines, industry definitions, and tone rules for the entire organization. Only `owner` and `admin` roles should be authorized to update organizational brand assets.

### Issue 4: Validation Errors Return HTTP 500 Instead of 400
- **Files:** `src/app/api/ai/ideas/route.ts`, `src/app/api/ai/hashtags/route.ts`, `src/app/api/ai/calendar/route.ts`
- **Severity:** Medium (API Error Classification Bug)
- **Description:** `Zod.parse(body)` is invoked inside a generic `try { ... } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }`.
- **Impact:** Invalid client parameters (e.g., empty string or invalid count) cause the API to report an internal server failure (500) rather than a bad client request (400), creating misleading error logs and breaking API contracts.

### Issue 5: Character Encoding Mojibake in Production Code
- **Files:** `src/app/ai-studio/certificate/page.tsx`, `src/lib/ai/gemini.ts`, `src/lib/ai/content-intelligence.ts`
- **Severity:** Medium (Visual Defect & Code Health)
- **Description:** Non-ASCII punctuation (middle dots `·`, ellipses `…`, em-dashes `—`, bullets `•`, accented `é`) were corrupted during ANSI/UTF-8 file writes, resulting in displayed text like `Â· max 10 MB`, `Extracting certificate detailsâ€¦`, and `â€¢ Feature breadth`.
- **Impact:** Unprofessional UI rendering in production and corrupted text in generated fallback posts.

### Issue 6: Idea Generator Fallback Under-Delivery
- **File:** [`src/lib/ai/gemini.ts`](file:///c:/Users/tejag/Downloads/GT-Scheduler/src/lib/ai/gemini.ts#L540-L600)
- **Severity:** Low (Contract Discrepancy)
- **Description:** When the Gemini API is unavailable, `generateIdeas` returns a static fallback array containing only 3 concepts, even if the caller requested `count = 5` (the default).
- **Impact:** UI displays 3 ideas when 5 were requested, without explaining the truncation.

---

## 4. User Experience Improvements

1. **Transient State Persistence (`sessionStorage`):**
   - Currently, navigating away from `/ai-studio` to check accounts or view the calendar erases all generated posts, rewritten drafts, and ideas.
   - *Improvement:* Introduce a lightweight debounce hook saving active draft state to `sessionStorage` per tab.

2. **Generation History Explorer:**
   - The database already tracks every post, idea, and calendar generation in `public.ai_generations`.
   - *Improvement:* Add an "Activity & History" tab or drawer allowing users to review their last 20 generations, restore text with a single click, and copy previous outputs.

3. **Bi-Directional Composer Integration:**
   - In `/composer`, the "Enhance with AI Studio" button should navigate to `/ai-studio?tab=rewrite&content=${encodeURIComponent(content)}`.
   - In `/ai-studio`, when the `rewrite` tab mounts, it should detect the `content` search param and automatically populate the original draft editor.

4. **Unified Navigation for Certificate Generator:**
   - The Certificate Announcement Generator should be added as a prominent tab or quick-start action within `/ai-studio` alongside "Generate Post" and "Viral Ideas", in addition to its sidebar entry.

5. **Per-Day Regeneration in 7-Day Calendar:**
   - When generating a 7-day schedule, users frequently like 5-6 days but want to regenerate a single day (e.g. Wednesday).
   - *Improvement:* Add a "Regenerate Day" action on individual calendar cards that calls `/api/ai/generate` with that day's specific theme and format.

---

## 5. AI Output Quality Improvements

1. **Explicit Degradation Disclosures Across All Tools:**
   - `generatePostWithReport` truthfully outputs `qualityStatus: 'degraded'` and `qualityWarnings` when operating in offline fallback mode.
   - `ideas`, `hashtags`, and `calendar` should adopt the same standard: return `{ ..., qualityStatus: 'verified' | 'degraded' }` so the UI can present an honest banner when Gemini is unreachable.

2. **LinkedIn-Specific Formatting Optimizations:**
   - Hook spacing: enforce double line-breaks after opening hooks to maximize engagement before LinkedIn's "...see more" cutoff (140–210 characters).
   - Clean bullet structures: convert raw dashes to clean Unicode bullets (`•`) or numbered lists without mojibake corruption.

3. **Multi-Variant Certificate Post Framing:**
   - Provide three narrative angles for certificate announcements:
     1. *Achievement & Skills:* Focuses on technical competencies mastered.
     2. *Learning Journey & Gratitude:* Focuses on mentorship and effort invested.
     3. *Practical Application:* Focuses on how the credential applies to current customer or engineering projects.

---

## 6. Security & Workspace Isolation Considerations

1. **Tenant Isolation Enforcement:**
   - In all AI route handlers, extract `const requestWorkspaceId = request.headers.get('x-workspace-id') || null;`.
   - Invoke `const auth = await getAuthContext(requestWorkspaceId);`.
   - If `requestWorkspaceId` is provided but cannot be verified against the user's memberships, immediately return HTTP `403 Forbidden: Access denied to requested workspace`.

2. **Role-Based Access Control on Brand Voice:**
   - Enforce:
     ```typescript
     if (!['owner', 'admin'].includes(auth.role)) {
       return NextResponse.json({ error: 'Forbidden: Only workspace owners and admins can modify brand settings' }, { status: 403 });
     }
     ```

3. **Ephemeral File Safety:**
   - Maintain the strict zero-persistence guarantee proven in PR #20: uploaded certificates must never be written to Supabase Storage or serverless disks.

---

## 7. Missing Automated Tests

| Target Area | Test Scenario | Current Status | Risk Level |
| :--- | :--- | :---: | :---: |
| **Brand Settings API** | `PUT /api/brand-settings` rejects `viewer` and `editor` roles with 403 | **Missing** | High |
| **Brand Settings API** | `GET /api/brand-settings` honors `x-workspace-id` for multi-tenant switching | **Missing** | High |
| **AI Ideas API** | `POST /api/ai/ideas` returns 400 for invalid body schema | **Missing** | Medium |
| **AI Ideas API** | `POST /api/ai/ideas` honors `x-workspace-id` and rejects foreign workspaces | **Missing** | High |
| **AI Hashtags API** | `POST /api/ai/hashtags` rate limit enforcement and foreign workspace rejection | **Missing** | High |
| **AI Calendar API** | `POST /api/ai/calendar` validation, rate limiting, and auth fail-closed checks | **Missing** | High |
| **UI State Fetch** | Automated component test verifying `GET /api/brand-settings` is called on mount | **Missing** | High |

---

## 8. Prioritized Development Roadmap

```
                               PHASED AI STUDIO ROADMAP
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Phase 1 (PR #21): Core Reliability, RBAC, Multi-Tenant Headers & Encoding Fixes        │
│ • Fetch brand settings on UI mount                                                     │
│ • Enforce owner/admin RBAC on PUT /api/brand-settings                                  │
│ • Pass and verify x-workspace-id across all AI routes                                  │
│ • Fix Zod error 500 -> 400 classification                                              │
│ • Fix all mojibake encoding glitches across AI files                                   │
│ • Add automated route tests for ideas, hashtags, calendar, brand-settings              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Phase 2 (PR #22): Generation History & Transient State Persistence                     │
│ • GET /api/ai/generations endpoint with workspace/user filtering                       │
│ • Generation History tab in AI Studio UI                                               │
│ • sessionStorage auto-save for uncommitted drafts                                      │
│ • Add Certificate Generator tab in main AI Studio navigation                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│ Phase 3 (PR #23): Bi-Directional Composer Enhancement                                  │
│ • Pass composer draft to AI Studio rewrite tab via URL params                          │
│ • Inline AI quick-actions in Composer (Improve Hook, Shorten, Suggest Hashtags)         │
│ • Single-day calendar regeneration action in 7-day plan                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Recommended Scope for PR #21

**Title:** `fix(ai): harden workspace authorization, brand voice persistence and RBAC, error handling, and test coverage`

### Included Changes

1. **Fix Brand Settings UI Auto-Fetch:**
   - In `src/app/ai-studio/page.tsx`, add `fetchBrandSettings()` to `useEffect` on mount.
   - Populate `brandName`, `brandIndustry`, `brandVoice`, and preferred settings from `GET /api/brand-settings`.

2. **Harden Multi-Tenant Workspace Resolution Across All AI Endpoints:**
   - Update `src/app/api/ai/generate/route.ts`, `src/app/api/ai/rewrite/route.ts`, `src/app/api/ai/ideas/route.ts`, `src/app/api/ai/hashtags/route.ts`, `src/app/api/ai/calendar/route.ts`, and `src/app/api/brand-settings/route.ts`:
   - Read `x-workspace-id` header and pass to `getAuthContext(requestWorkspaceId)`.
   - Return HTTP `403 Forbidden: Access denied to requested workspace` if `requestWorkspaceId` cannot be verified.

3. **Enforce Brand Settings RBAC:**
   - In `PUT /api/brand-settings`, verify `['owner', 'admin'].includes(auth.role)`.
   - Reject `viewer` or `editor` attempts with HTTP `403 Forbidden`.

4. **Correct Client Validation Status Codes:**
   - In `ideas`, `hashtags`, and `calendar` routes, catch `ZodError` and return HTTP `400 Bad Request` with structured error messages.

5. **Clean Character Encoding Mojibake:**
   - Replace all corrupted characters (`Â·`, `â€¦`, `â€¢`, `â€”`, `clichÃ©s`) with standard UTF-8 characters (`·`, `…`, `•`, `—`, `clichés`) in:
     - `src/app/ai-studio/certificate/page.tsx`
     - `src/lib/ai/gemini.ts`
     - `src/lib/ai/content-intelligence.ts`
     - `src/lib/ai/uniqueness-engine.ts`
     - `src/lib/ai/writing-profile.ts`
     - Route header comments

6. **Full Automated Test Suite:**
   - Create `tests/ai-studio-routes.test.ts` covering:
     - Brand settings fetch and RBAC rejection for viewers.
     - Multi-tenant `x-workspace-id` enforcement across `ideas`, `hashtags`, `calendar`, `rewrite`, and `generate`.
     - Zod 400 Bad Request verification.
     - Custom API key propagation (`x-gemini-key`).

---

## 10. Acceptance Criteria & Test Plan for PR #21

### Automated Acceptance Criteria
- [ ] `npm run test:ai-routes`: 100% pass across all new route authorization and RBAC tests.
- [ ] `npm run test:certificate`: 38/38 passing.
- [ ] `npm run test:matrix`: 37/37 passing.
- [ ] `npm test`: 21/21 passing.
- [ ] `npx tsc --noEmit`: 0 errors.
- [ ] `npm run lint`: 0 warnings, 0 errors.
- [ ] `npm run build`: 47/47 routes generated cleanly.

### Manual Verification Checklist
1. Log in as Workspace Owner $\rightarrow$ modify Brand Name and Voice in AI Studio $\rightarrow$ Save.
2. Refresh page $\rightarrow$ confirm saved values remain populated (no reversion to placeholder).
3. Log in as Workspace Viewer $\rightarrow$ attempt `PUT /api/brand-settings` $\rightarrow$ confirm HTTP 403 Forbidden.
4. Send `POST /api/ai/ideas` with `x-workspace-id: foreign-id` $\rightarrow$ confirm HTTP 403 Forbidden.
5. Inspect `/ai-studio/certificate` $\rightarrow$ confirm no mojibake characters appear in upload labels or buttons.

