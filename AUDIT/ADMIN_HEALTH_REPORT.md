# ADMIN HEALTH TELEMETRY & SYSTEM PROBES REPORT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Endpoint:** `/api/admin/metrics`, UI: `/admin`  
**Date:** November 2026  

---

## 1. Overview
The Administrative Operations portal provides platform visibility into tenant health, delivery queues, support tickets, and service statuses. In adherence to GT InnoX non-negotiable guidelines, all misleading count fallbacks have been eliminated and replaced with real runtime telemetry.

---

## 2. Elimination of Hardcoded & Fallback Telemetry

### 2.1 Metric Accuracy
- **Previous Code:** `activeWorkspaces: totalWorkspaces || 1`, `activeLinkedInAccounts: totalAccounts || 1`.
- **Remediated Code:** `activeWorkspaces: totalWorkspaces ?? 0`, `activeLinkedInAccounts: totalAccounts ?? 0`.
- **Validation:** If the database contains 0 workspaces or 0 accounts, the dashboard accurately displays 0.

### 2.2 Live Runtime Service Health Probes
The endpoint `/api/admin/metrics` performs active connectivity checks and returns one of four deterministic states:
- `operational`: Service is reachable, configured, and responsive within threshold latency.
- `degraded`: Service is reachable but experiencing latency > 2000ms or queue delays.
- `unavailable`: Connection failed or timed out.
- `not_configured`: Required environment variables are not set.

### 2.3 Monitored Services & Probe Mechanics

| Service | Probe Method | Live Response Sample |
|---|---|---|
| **Database** | Supabase query ping + latency measurement | `{"status": "operational", "latencyMs": 296, "rlsActive": true}` |
| **Worker / Queue** | Checks for overdue jobs in `scheduled_jobs` (>5 min lag indicates worker downtime) | `{"status": "operational", "mode": "Persistent Standalone Poller"}` |
| **Redis** | Active ping via ioredis with 1000ms timeout | `{"status": "not_configured"}` (or `operational` when `REDIS_URL` present) |
| **LinkedIn OAuth** | Validates `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` configuration | `{"status": "operational", "version": "202610"}` |
| **AI Studio** | Validates `GEMINI_API_KEY` configuration | `{"status": "operational", "rateLimitActive": true}` |
| **Billing** | Validates `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` | `{"status": "not_configured"}` |
