# CUSTOMER ONBOARDING MANUAL
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  

---

## 1. Onboarding Funnel

```
Registration (/register)
       ↓
Email Verification (Supabase Auth Link)
       ↓
Workspace Creation (Auto-provisioned or Custom)
       ↓
LinkedIn Profile Authorization (/accounts)
       ↓
Brand Voice Definition (/settings)
       ↓
AI Content Generation & 7-Day Calendar (/ai-studio)
       ↓
Autonomous Scheduled Publishing (/calendar)
```

---

## 2. Friction Mitigation Measures
- **Expired Verification Links:** Handled gracefully on `/login` via hash listener `#error_code=otp_expired` with informative banner and session recovery.
- **Empty States:** Clear calls-to-action on Dashboard, Calendar, and Composer guiding users to connect their account.
- **Support Ingestion:** One-click modal accessible from the persistent top navigation bar.

