# BETA ISSUE TRACKER & RESOLUTION LOG
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Repository:** https://github.com/tejasrmap/linkedin-autopilot  
**Status:** All Known Pre-Beta Issues Resolved (Zero Unresolved Blockers)  

---

## 1. Issue Resolution Matrix

| Issue ID | Component | Description | Root Cause | Resolution | Status |
|---|---|---|---|---|---|
| **ISS-001** | Publishing State | Ambiguous publishing status when LinkedIn API drops socket after 30s | Network timeout or slow Restli gateway response | Implemented 35s timeout abort signal and automatic reconciliation query `reconcileRecentAuthorPost` + manual `/api/posts/[id]/reconcile` API | **RESOLVED** ✅ |
| **ISS-002** | Team RBAC | Inviting team members had static mockup UI in `/team` | Missing backend API for workspace members | Built full CRUD `/api/workspaces/members` with RLS role validation (owner/admin) | **RESOLVED** ✅ |
| **ISS-003** | Settings & Brand Voice | Brand voice edits and workspace updates did not persist | Form state was local-only | Created `PATCH /api/workspaces` and `PUT /api/brand-settings` with real Supabase persistence | **RESOLVED** ✅ |
| **ISS-004** | Media Security | Media upload allowed unvalidated file payloads | Missing server-side MIME type check | Implemented strict whitelist validation (`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/quicktime`, `application/pdf`) and 50MB file size limit in `/api/media/upload` | **RESOLVED** ✅ |
| **ISS-005** | AI Studio | 7-day calendar generator gave repeated identical posts | Prompt lacked topic distinctness & temperature | Injected dynamic daily thought angles (Thought Leadership, Case Study, How-To, Myth Busting, etc.) and creative temperature in `/api/ai/calendar` | **RESOLVED** ✅ |
| **ISS-006** | AI Studio | Applying global hashtags multiple times duplicated them | String append without existing tag parsing | Implemented clean regex extraction to strip existing tags before appending new unique tags | **RESOLVED** ✅ |
| **ISS-007** | UI / Modals | Dropdowns in Schedule All modal clipped outside modal boundaries | Modal overflow hidden with fixed bounds | Redesigned modal with custom portal/z-index layering and spacious scrollable container | **RESOLVED** ✅ |
| **ISS-008** | Branding | Generic boilerplate favicon and placeholder branding | Missing GT InnoX official visual assets | Created and integrated official GT InnoX SVG logo, favicon, and brand metadata across all pages | **RESOLVED** ✅ |
| **ISS-009** | Auth / Supabase | Single-use email confirmation link showed "otp_expired" error banner | Supabase consumes verification token on initial scanner click | Added client hash listener in `/login` (`#error_code=otp_expired`) providing reassuring guidance and session recovery | **RESOLVED** ✅ |
| **ISS-010** | Support System | Beta users had no built-in mechanism to report defects | Missing customer ticket portal | Built `support_tickets` PostgreSQL table, `/api/support` endpoints, top navigation `SupportModal`, and `/admin` ticket inbox | **RESOLVED** ✅ |

---

## 2. Live Defect Reporting Workflow for Beta Testers
1. Testers click the **Help / Support (? / LifeBuoy)** button in the top navigation bar.
2. Select category: `publishing`, `ai_generation`, `scheduling`, `accounts`, or `billing`.
3. Provide description and severity level.
4. Ticket is immediately persisted in `public.support_tickets` and logged in `/admin` for GT InnoX engineering triage.
