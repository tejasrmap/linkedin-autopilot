# SECURITY AUDIT — LINKEDIN AUTOPILOT
## GT InnoX LLP | Autonomous Engineering Mission

**Company:** GT InnoX LLP  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Target Environment:** Vercel (Web/API) + Supabase (PostgreSQL, Vault, Storage, Auth)  
**Date:** November 14, 2026  

---

## 1. Multi-Tenant Workspace Isolation

- **Tenant Boundaries**: All database tables (`posts`, `social_accounts`, `notifications`, `ai_generations`, `subscriptions`) are scoped by `workspace_id`.
- **Database Row-Level Security (RLS)**:
  - Tables enforce RLS policies verifying `auth.uid() = created_by` or membership in `workspace_members`.
  - Service-role client (`createAdminClient()`) bypasses RLS for scheduled cron tasks and webhook ledgers.
- **Cross-Workspace Publishing Prevention**:
  - In `src/lib/queue/publisher.ts`, line 204 enforces a strict safeguard:
    ```typescript
    if (socialAccount.workspace_id !== post.workspace_id) {
      throw new Error('Security violation: Assigned LinkedIn account does not belong to the post workspace.');
    }
    ```
  - Verified via real PostgreSQL staging integration tests: querying Workspace B strictly returns 0 posts from Workspace A.

---

## 2. Secrets Management & Vault Security

- **Zero-Secret Codebase**: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, and LinkedIn OAuth credentials are never committed in plaintext.
- **Supabase Vault**: The recurring `pg_cron` stored procedure `private.invoke_serverless_publish_cron()` dynamically reads the secret via `vault.decrypted_secrets` inside a private schema. Execution permissions are revoked from `PUBLIC`, `anon`, and `authenticated`.
- **Fail-Closed Cron Protection**: If `CRON_SECRET` is unset, `/api/cron/publish` rejects all callers with HTTP 500 without querying the database.
- **Bearer Header Requirement**: Secrets passed in URL query parameters (`?key=...`) are explicitly rejected to prevent token leakage in HTTP access and proxy logs.

---

## 3. LinkedIn OAuth & Credential Encryption

- **Encryption at Rest**: OAuth tokens (`access_token`, `refresh_token`) stored in `public.social_accounts` are encrypted using AES-256-GCM via `src/lib/encryption.ts` using `TOKEN_ENCRYPTION_KEY`.
- **Company Page Scope Freeze**: Organization integration and scopes remain completely frozen.
- **Account Disconnection**: Disconnecting an account immediately zeroes out stored access tokens and marks `connection_status: 'disconnected'`.

---

## 4. Stripe Billing Disablement & Fail-Safe Defaults

- **Server-Side Enforcement**: `isBillingEnabled()` strictly returns `false` unless `process.env.BILLING_ENABLED === 'true'`.
- **Endpoint Gate**: `/api/billing/checkout` and `/api/billing/portal` return HTTP 503 (`Billing is temporarily unavailable`).
- **Webhook Ledger Protection**: Incoming webhook events are acknowledged and recorded with status `ignored_billing_disabled`, preventing any unverified subscription mutations.
- **Zero Fabrication**: Unpaid workspaces default to `tier: 'free'`, `isPaid: false`, `id: null`, and `renewalDate: null`. No synthetic subscription IDs are fabricated.
