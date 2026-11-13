# INCIDENT RESPONSE PLAN — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | SRE Severity Levels & Escalation Matrix

---

## 1. Severity Classifications & SLAs

| Severity | Definition | Response SLA | Target Resolution |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core publishing failure affecting all users; database down; duplicate publishing detected | **< 15 minutes** | **< 2 hours** |
| **SEV-2 (High)** | Scheduler paused; background retries stalled; LinkedIn OAuth revoked for multiple users | **< 30 minutes** | **< 4 hours** |
| **SEV-3 (Medium)** | Isolated user publishing error; minor telemetry discrepancy | **< 2 hours** | **< 24 hours** |
| **SEV-4 (Low)** | UI cosmetic issue; non-critical log noise | **< 1 business day** | Next release |

---

## 2. Escalation & Response Workflow

```
[ALERT TRIGGERED: /api/health returns degraded/unhealthy or user reports error]
                            │
                            ▼
           [Step 1: Triage & Severity Assignment]
                            │
                            ▼
           [Step 2: Containment & Mitigation]
   - If DB failure: Check Supabase status page and connection pool.
   - If Stuck jobs: Scheduler automatically reclaims expired leases.
   - If LinkedIn OAuth outage: Notify impacted users to reconnect.
                            │
                            ▼
           [Step 3: Root Cause Investigation & Fix]
   - Inspect scheduler_execution_logs and post_publish_attempts ledger.
   - Deploy hotfix via feature branch PR (never commit directly to main).
                            │
                            ▼
           [Step 4: Post-Mortem & Blameless Review]
   - Document root cause, timeline, detection gap, and remediation action.
```
