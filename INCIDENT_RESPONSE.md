# INCIDENT RESPONSE & TRIAGE PROTOCOL
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Standard:** Enterprise Security & Operational Continuity  

---

## 1. Severity Classifications

| Severity | Definition | Response SLA | Examples |
|---|---|---|---|
| **SEV-1 (Critical)** | Core publishing failure, token leakage, total system outage, database unavailable. | < 15 minutes | RLS breach, widespread 500 errors on `/api/cron`, LinkedIn OAuth outage. |
| **SEV-2 (Major)** | Major feature failure with workaround available (e.g. Gemini AI generation down). | < 1 hour | AI Studio failing, Stripe webhook failure, BullMQ delay spike. |
| **SEV-3 (Minor)** | Minor UI rendering defect, non-blocking bug, slow analytics query. | < 12 hours | Dropdown clipping, typo, non-critical notification formatting. |

---

## 2. Incident Response Workflow

### Phase 1: Detection & Triage
1. Alert triggered by Vercel Monitoring, Sentry, or user support ticket (`/api/support`).
2. Incident Commander assigned (Lead Engineer, GT InnoX).
3. Classify severity level (SEV-1 through SEV-3).

### Phase 2: Containment & Mitigation
- If SEV-1 involves security/credential exposure:
  1. Revoke active access tokens.
  2. Put app in maintenance mode if required via Vercel Edge Middleware.
- If publishing queue is stuck:
  1. Trigger manual reconciliation query on posts in `failed` or `pending` status.
  2. Inspect `/api/admin/metrics` for failed attempt error strings.

### Phase 3: Resolution & Verification
1. Deploy hotfix to `main` branch.
2. Vercel automatically builds and deploys to production edge.
3. Verify fix using `npm run test:phase6` and real API endpoint checks.
4. Mark related tickets in `/admin` as `resolved`.

### Phase 4: Post-Mortem & Blameless Review
1. Document root cause, timeline, detection latency, and preventive action items in `INCIDENT_LOG.md`.
2. Schedule unit/integration test addition to prevent regression.
