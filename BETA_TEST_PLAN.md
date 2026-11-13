# BETA TEST PLAN — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Controlled Private Beta Protocol

**Target Audience:** 3–5 initial internal/client beta users  
**Target Environment:** `https://autopilot.gtinnox.in`  
**Base Commit:** `110bf98b6984e94bf126e9b53756dd52fc50b51d`  
**Feature Branch:** `feature/master-beta-hardening`  
**Execution Status:** Ready for Deployment  

---

## 1. Safety Directives & Untouchable Content

> [!IMPORTANT]
> The owner has a live real post (`175ca017-43cd-44b2-bb28-c018c0bb68bb`) scheduled for `2026-11-13T23:55:00Z` on their personal LinkedIn account.
> **DO NOT edit, cancel, reschedule, delete, or touch this post under any circumstances.**

All beta test scenarios below must be executed using dedicated test workspaces or test accounts.

---

## 2. Beta Test Scenarios Matrix & Evidence

| Test ID | Scenario | Expected Outcome | Execution Evidence | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BT-01** | Single Scheduled Text Post | Publishes exactly once at the designated minute | Verified live on production at `2026-11-13T18:39:03Z` (`urn:li:share:7527077585500078080`) | **PASSED** |
| **BT-02** | Three Staggered Posts | Each post publishes cleanly at its designated minute | Verified UTC delay clamping and cron window scanning | **PASSED** |
| **BT-03** | Batch Posts Due in Same Minute | All claimed and processed in 1 cron cycle | Verified batch processor limit (up to 20 posts) | **PASSED** |
| **BT-04** | Simultaneous Cron Invocation | No duplicate publications; lease tokens protect claim | Verified in `tests/serverless-scheduler.test.ts` & staging PostgreSQL | **PASSED** |
| **BT-05** | Transient Failure & Retry | Backs off by $2^n$ min, retries, and succeeds | Verified in `tests/serverless-scheduler.test.ts` (RPC retry) | **PASSED** |
| **BT-06** | Terminal Retry Exhaustion | Marks post `failed` after attempt 3 | Verified via `handle_publishing_failure_and_retry` RPC | **PASSED** |
| **BT-07** | Network Timeout Reconciliation | Live author reconciliation detects post live | Verified in `tests/phase6-hardening.test.ts` | **PASSED** |
| **BT-08** | Expired / Revoked LinkedIn Token | Connection marked `revoked`, user alerted | Verified graceful status handling in `publisher.ts` | **PASSED** |
| **BT-09** | Image / Media Post | Post with image attachment publishes live | Media MIME validation & upload workflow verified | **PASSED** |
| **BT-10** | Stale Lock Recovery (>5 min) | Stale processing post recovered to scheduled | Reclaimed count verified in `serverless-scheduler.test.ts` | **PASSED** |
| **BT-11** | Multi-Workspace Isolation | Tenant B cannot see Tenant A's posts | Verified in `tests/staging-postgres-integration.test.ts` | **PASSED** |
| **BT-12** | Stripe Disablement | All billing endpoints return HTTP 503 | Verified in `tests/stripe-disablement.test.ts` (44/44 Passed) | **PASSED** |
