# DEPLOYMENT STATUS REPORT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Active Deployment Topology

- **Web Application Host:** Vercel (Edge Network)
- **Production Domain:** https://autopilot.gtinnox.in
- **Database Host:** Supabase (AWS `ap-south-1` Mumbai)
- **Project Reference:** `opkatczhnzfqcjkmxcvm`
- **Total Registered Routes:** 47 (All compiled into production bundles)
- **Worker Execution:** Node.js Persistent Daemon (`src/worker/index.ts`) with BullMQ and standalone 5-second polling fallback.
- **Failover Serverless Cron:** Vercel Cron calling `/api/cron/publish` every 1 minute.

