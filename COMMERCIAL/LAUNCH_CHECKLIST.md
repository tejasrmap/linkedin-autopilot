# COMMERCIAL LAUNCH CHECKLIST
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Technical Infrastructure Readiness
- [x] Next.js 14 production build compiled cleanly with exit code 0.
- [x] All 76 automated test assertions passed (0 failures).
- [x] Supabase Row Level Security active on all 15 tables.
- [x] AES-256-GCM authenticated cipher for OAuth access tokens.
- [x] Persistent background worker running with 5-second polling fallback.
- [x] Ambiguous post reconciliation engine active with 35s timeout signal.
- [x] Media MIME validation and 50MB ceiling enforced on `/api/media/upload`.
- [x] Stripe webhook ledger (`stripe_events`) and customer portal active.

---

## 2. External Dependencies Awaiting Account Activation
- [ ] **Stripe Live Production Keys:** Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel to activate real credit card charges.
- [ ] **LinkedIn Company Page Approval:** Awaiting LinkedIn Partner Program review for `w_organization_social` scope (Personal publishing is 100% operational).
- [ ] **Custom Domain DNS:** Verify CNAME `autopilot.gtinnox.in` pointing to `cname.vercel-dns.com`.
