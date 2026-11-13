# REMAINING BLOCKERS & EXTERNAL DEPENDENCIES
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. External Blockers Matrix

| Dependency | Category | Status | Impact | Required Owner Action |
|---|---|---|---|---|
| **LinkedIn Company Page Approval** | External Partner Review | Awaiting Approval | Company Page publishing is disabled (Personal profile publishing is 100% operational). | Submit verification package prepared in `LINKEDIN_APPROVAL_CHECKLIST.md` to LinkedIn Developer Portal. |
| **Stripe Live Production Keys** | Merchant Account | Pending Configuration | Live cards cannot be charged (Test mode functions properly). | Obtain `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Stripe Dashboard and paste into Vercel Environment Variables. |
| **Beta Pilot Cohort Execution** | Operational / Program | Ready for Launch | Beta feedback is template-ready but awaiting live pilot participants to complete the 14-day cycle. | Invite the 20 pilot users using `BETA/BETA_ONBOARDING_GUIDE.md`. |
| **Custom Domain DNS** | Networking / DNS | Active | Domain `autopilot.gtinnox.in` configured on Vercel. | Monitor SSL renewal. |
