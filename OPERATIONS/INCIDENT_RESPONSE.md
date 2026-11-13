# INCIDENT RESPONSE & TRIAGE PROTOCOL
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Severity Classifications & SLAs

| Severity | Definition | Response SLA | Examples |
|---|---|---|---|
| **SEV-1 (Critical)** | Core publishing failure, token leakage, total system outage, database unavailable. | < 15 minutes | RLS breach, widespread 500 errors on `/api/cron`, LinkedIn OAuth outage. |
| **SEV-2 (Major)** | Major feature failure with workaround available. | < 1 hour | Gemini AI generation outage, Stripe webhook failure, BullMQ delay spike. |
| **SEV-3 (Minor)** | Minor UI rendering defect, non-blocking bug. | < 12 hours | Dropdown alignment, typo, non-critical notification formatting. |

---

## 2. Containment & Resolution Workflows

### 2.1 Publishing Queue Stall
1. Check `/api/admin/metrics` to inspect overdue scheduled jobs.
2. If Redis is down, verify the persistent database poller is running.
3. If necessary, trigger manual reconciliation on unconfirmed posts via `POST /api/posts/[id]/reconcile`.

### 2.2 Security Incident (Token Compromise)
1. Revoke LinkedIn Developer application credentials in the LinkedIn Developer Portal.
2. Rotate `LINKEDIN_CLIENT_SECRET` in Vercel environment variables.
3. Trigger automated account status flag (`revoked`) in `public.social_accounts` to prompt user reauthorization.
