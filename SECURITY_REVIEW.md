# SECURITY REVIEW — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Application Security & DevSecOps Audit

**Date:** November 14, 2026  
**Auditor:** GT InnoX LLP Autonomous Engineering Mission  
**Scope:** Authentication, Authorization, Token Encryption, Database RLS, Input Sanitization, Workspace Boundaries, and Scheduler Execution.  

---

## 1. Authentication & Session Validation

1. **Supabase Auth**: All user authentication is handled via Supabase Auth using JWT sessions stored in HTTP-only, secure cookies via `@supabase/ssr`.
2. **Server-Side Verification**: Route handlers authenticate requests by inspecting the session user ID server-side before resolving any database query.
3. **Cron Route Security**: `/api/cron/publish` fails closed with `HTTP 500` if `CRON_SECRET` is missing. It strictly mandates `Authorization: Bearer <CRON_SECRET>` and rejects query string secrets to prevent leakage into access logs.

---

## 2. OAuth & Token Cryptography

1. **Encryption Standard**: All connected LinkedIn access tokens and refresh tokens are encrypted at rest using AES-256-GCM authenticated encryption (`src/lib/encryption.ts`).
2. **IV & AuthTag Uniqueness**:
   - Each encryption operation generates a cryptographically random 16-byte initialization vector (`crypto.randomBytes(16)`).
   - A 16-byte GCM authentication tag (`cipher.getAuthTag()`) verifies ciphertext integrity and prevents bit-flipping attacks.
   - Decryption strictly validates the authentication tag, failing immediately on tampering.
3. **Secret Storage**: Master encryption key `ENCRYPTION_KEY` is loaded from protected environment variables and never logged or exposed in client responses.
4. **Scope Partitioning**:
   - Personal member publishing uses official `w_member_social` and OpenID Connect (`openid`, `profile`, `email`).
   - Company Page organization scopes (`w_organization_social`, `rw_organization_admin`) are strictly isolated and frozen.

---

## 3. Database Security & Tenant Isolation

1. **Row Level Security (RLS)**:
   - RLS is enabled on all tables: `workspaces`, `workspace_members`, `posts`, `social_accounts`, `media`, `notifications`, `subscriptions`, etc.
   - Access is partitioned by `workspace_id`. Cross-workspace queries are denied at the PostgreSQL engine level.
2. **PostgreSQL RPC Security**:
   - `claim_post_for_publishing` and `handle_publishing_failure_and_retry` are defined as `SECURITY DEFINER` with anchored `SET search_path = public, extensions`.
   - Execution privileges on these stored procedures are revoked from `PUBLIC`, `anon`, and `authenticated`, granted strictly to `postgres` and `service_role`.
3. **Cross-Tenant Guardrail**: `executePublishPipeline()` enforces a secondary check confirming `socialAccount.workspace_id === post.workspace_id`, preventing any cross-tenant publishing if foreign IDs are passed.

---

## 4. API & Media Upload Security

1. **MIME Type Whitelisting**:
   - Upload endpoints enforce strict MIME type validation permitting only `image/jpeg`, `image/png`, `video/mp4`, and `application/pdf`.
   - Executable binaries (`.exe`), scripts (`.js`), and HTML files (`.html`) are blocked.
2. **File Size Limits**: Enforced at 50MB per upload.
3. **Rate Limiting**: Sliding window rate limiting guards AI studio endpoints, authentication callbacks, and support ticket submissions against abuse.
