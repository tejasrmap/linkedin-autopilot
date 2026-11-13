# THREAT MODEL — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | STRIDE Security Analysis

---

## 1. System Scope & Assets

- **Assets:**
  - Encrypted LinkedIn OAuth tokens (`social_accounts.encrypted_access_token`).
  - Draft and scheduled post commentary and media assets.
  - User identity, workspace memberships, and customer emails.
  - Scheduler execution secrets (`CRON_SECRET`).
  - Supabase Service Role Key.

---

## 2. STRIDE Threat Assessment & Mitigations

### 1. Spoofing
- **Threat:** Attacker invokes `/api/cron/publish` posing as the scheduled cron runner to trigger arbitrary publishing.
- **Mitigation:** Strict Bearer authentication matching `CRON_SECRET`. Fail-closed rejection with HTTP 500 if unset; HTTP 401 if unauthorized. Rejection of query string authentication.

### 2. Tampering
- **Threat:** Adversary modifies encrypted token in the database to execute arbitrary code or bypass permissions.
- **Mitigation:** AES-256-GCM authenticated cipher with 16-byte authentication tag. Any byte alteration causes `ERR_CRYPTO_INVALID_IV` or authentication tag mismatch, aborting decryption.

### 3. Repudiation
- **Threat:** User disputes post creation or scheduler action.
- **Mitigation:** Complete immutable audit ledger in `public.post_publish_attempts` recording attempt timestamp, provider response, and HTTP status codes, accompanied by `public.scheduler_execution_logs`.

### 4. Information Disclosure
- **Threat:** Leaking OAuth access tokens in error logs or health endpoints.
- **Mitigation:** Access tokens are decrypted only in memory during the execution pipeline. Health endpoint excludes credentials and connection strings. Stack traces sanitized in API responses.

### 5. Denial of Service
- **Threat:** Rapid concurrent requests overload the publishing engine or trigger LinkedIn rate limits.
- **Mitigation:** Atomic UUID execution claim tokens and 300s lease durations ensure only 1 worker processes a given post. Batch size bounded to 20 posts per invocation.

### 6. Elevation of Privilege
- **Threat:** Tenant user queries posts or accounts of another workspace.
- **Mitigation:** Supabase RLS enforces multi-tenant boundaries at the database level. Server-side pipeline verifies `socialAccount.workspace_id === post.workspace_id`.
