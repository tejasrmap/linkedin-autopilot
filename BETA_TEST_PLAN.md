# BETA TEST PLAN — LINKEDIN AUTOPILOT
## GT InnoX LLP | Controlled Private Beta Protocol

**Target Audience**: 3–5 initial internal/client beta users  
**Target Environment**: `https://autopilot.gtinnox.in`  
**Execution Window**: Private Beta Cycle 1  

---

## 1. Safety Directives & Untouchable Content

> [!IMPORTANT]
> The owner has a live real post (`175ca017-43cd-44b2-bb28-c018c0bb68bb`) scheduled for `2026-11-13T23:55:00Z` on their personal LinkedIn account.
> **DO NOT edit, cancel, reschedule, delete, or touch this post under any circumstances.**

All beta test scenarios below must be executed using dedicated test workspaces or test accounts.

---

## 2. Beta Test Scenarios Matrix

| Test ID | Scenario | Expected Outcome | Verification Method |
| :--- | :--- | :--- | :--- |
| **BT-01** | Single Scheduled Text Post | Publishes exactly once at the designated minute | Provider post ID present in `posts`; single record in `post_publish_attempts` |
| **BT-02** | Three Staggered Posts | Each post publishes cleanly at its designated hour | Monotonic execution logs; zero stuck locks |
| **BT-03** | Five Batch Posts Due in Same Minute | All 5 claimed and processed in 1 cron cycle | `succeeded: 5`, `failed: 0` in cron response |
| **BT-04** | Simultaneous Cron Invocation | No duplicate publications | CAS lock prevents race condition; exactly 1 publish per post |
| **BT-05** | Transient Failure & Retry | Backs off by $2^n$ min, retries, and succeeds | Attempt count increments; post and job remain synchronized |
| **BT-06** | Terminal Retry Exhaustion | Marks post `failed` after attempt 3 | Explicit failure error; user alerted via in-app notification |
| **BT-07** | Network Timeout Reconciliation | Live author reconciliation detects post live | Status resolves to `published` without double post |
| **BT-08** | Expired / Revoked LinkedIn Token | Connection marked `revoked`, user alerted | User notification created; graceful error |
| **BT-09** | Image / Media Post | Post with image attachment publishes live | Media asset URL included in LinkedIn URN payload |
| **BT-10** | Stale Lock Recovery (>5 min) | Stale processing post recovered to scheduled | Reclaimed counter increments; processed next minute |
