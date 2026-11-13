# PRODUCTION RUNBOOK — LINKEDIN AUTOPILOT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Production Domain:** https://autopilot.gtinnox.in  
**Hosting Platforms:** Vercel (Next.js Application), Supabase (PostgreSQL 15), Upstash / Render (Redis & Worker Daemon)  

---

## 1. System Architecture Overview
The platform operates as a decoupled, multi-tier system:
1. **Edge Web Tier:** Next.js 14 App Router on Vercel handling user sessions, AI content generation, and REST API routes.
2. **Persistence Tier:** Managed Supabase PostgreSQL with 15 tables enforcing Row Level Security (RLS) via `public.is_workspace_member(workspace_id)`.
3. **Background Worker Tier:** Long-running worker (`npx tsx src/worker/index.ts`) providing BullMQ job consumption and persistent database polling fallback.

---

## 2. Daily Health Check Procedure
Execute the automated health check:
```bash
curl -f https://autopilot.gtinnox.in/api/health
```
Expected HTTP 200 response with latency breakdown:
```json
{
  "status": "healthy",
  "service": "LinkedIn Autopilot SaaS",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 296 },
    "linkedin_api": { "status": "healthy", "latencyMs": 586 },
    "worker_engine": { "status": "healthy", "message": "Persistent Database Poller Active" }
  }
}
```

---

## 3. Worker Deployment on Render / Railway / VPS
To deploy the dedicated background worker:
1. Service Type: Background Worker
2. Build Command: `npm install`
3. Start Command: `npm run worker`
4. Inject all required environment variables: `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`.
