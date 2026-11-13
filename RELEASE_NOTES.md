# RELEASE NOTES — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Private Beta Release v1.0.0-beta.1

**Release Date:** November 14, 2026  
**Target Environments:** Production (`https://autopilot.gtinnox.in`)  
**Base Commit on `main`:** `110bf98b6984e94bf126e9b53756dd52fc50b51d`  
**Branch:** `feature/master-beta-hardening`  

---

## What's New & Hardened in v1.0.0-beta.1

### 1. Publishing Ownership & Concurrency Leases
- **UUID Execution Leases**: Every publishing attempt acquires a cryptographically unique `UUID` claim token and a 300-second lease window.
- **Atomic Stored Procedure**: Implemented `public.claim_post_for_publishing()` ensuring that exactly one worker can claim a post, completely preventing duplicate posts during traffic spikes or network delays.
- **Published Post Immutability**: Posts transitioned to `published` status are strictly protected from being reopened, rescheduled, or overwritten by retry handlers.

### 2. Transactional Retries & Exponential Backoff
- **Atomic Failure & Retry Transition**: Implemented `public.handle_publishing_failure_and_retry()` PostgreSQL `SECURITY DEFINER` function, eliminating split-state errors between `posts` and `scheduled_jobs`.
- **Deterministic Backoff**: Retries are scheduled with exponential backoff ($2^{\text{attempts}}$ minutes) up to a maximum of 3 attempts before terminal failure.

### 3. Serverless Scheduler & Observability Hardening
- **Zero Edge Cache on Health Telemetry**: Added explicit `Cache-Control: no-store, no-cache, must-revalidate` response headers on `/api/health` to eliminate stale edge responses.
- **Accurate Degraded Status Reporting**: `/api/health` now inspects `scheduler_execution_logs` and accurately flags `degraded` status when a scheduler execution fails.

### 4. Security & Compliance Protections
- **LinkedIn Company Page Frozen**: Organization publishing is fully isolated and frozen pending LinkedIn Developer App approval.
- **Stripe Disabled**: Billing remains 100% disabled with fail-safe HTTP 503 handlers and non-mutating webhook acknowledgments.
- **Tenant Isolation**: Verified multi-workspace isolation via real PostgreSQL staging integration tests.
