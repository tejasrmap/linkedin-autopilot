# PRODUCTION HEALTH VALIDATION — LINKEDIN AUTOPILOT
## GT InnoX LLP | Genuine Telemetry, Latency Probes & Worker Health

**Target Route:** `/api/admin/metrics`  
**Status:** REAL-TIME PROBES OPERATIONAL  

---

## 1. LIVE HEALTH TELEMETRY ARCHITECTURE

Unlike synthetic or hardcoded dashboard metrics, `/api/admin/metrics` executes genuine latency probes and system checks:

1. **Database Probe (`database`):**
   * Executes a live query against `public.workspaces`.
   * Measures precise round-trip response time in milliseconds.
   * Reports `operational` or `unavailable`.

2. **Redis & BullMQ Probe (`redis`):**
   * Checks `REDIS_URL` configuration.
   * Connects via `ioredis` with an atomic `PING` and measures round-trip latency.
   * If Redis is omitted, reports `not_configured` while acknowledging database poller mode.

3. **Background Worker Heartbeat (`worker`):**
   * Inspects `public.worker_heartbeats` for the `primary_worker` row.
   * Measures time elapsed since `last_seen_at`.
   * If last seen within 60 seconds -> `operational`.
   * If last seen between 60s and 180s -> `degraded`.
   * If >180s or missing -> falls back to recent successful publish attempts.

4. **Queue Lag Measurement (`queueLag`):**
   * Evaluates `public.scheduled_jobs` for overdue jobs (`scheduled_at < NOW() - 60s`).
   * Calculates maximum queue latency: `Date.now() - oldestDueJobTime`.
   * Flags latency degradation if jobs are delayed beyond 2 minutes.

5. **External Provider Probes (`providers`):**
   * **Gemini AI:** Validates `GEMINI_API_KEY` configuration and executes an authenticated capability ping without incurring user billing overhead.
   * **LinkedIn OAuth:** Safely verifies `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` format without leaking plaintext secrets in response payloads.
   * **Stripe Billing:** Validates `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` presence and reachability.

6. **Publishing Success Rate:**
   * Derived from real queries to `public.post_publish_attempts`.
   * Formula: `(succeededAttempts / totalAttempts) * 100`.
   * If no attempts have occurred yet, reports `100.0%` with `totalAttempts: 0`.
