# PRODUCTION DEPLOYMENT GUIDE — LINKEDIN AUTOPILOT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Production Domain:** `https://autopilot.gtinnox.in`  
**Hosting Platforms:** Vercel (Next.js Application), Supabase (Database, Auth, Storage), Upstash / Render (Redis & Worker Daemon)  

---

## 1. Architecture Overview
LinkedIn Autopilot consists of three coordinated production components:
1. **Next.js 14 Web Application & API Routes:** Hosted on Vercel with edge-ready API routes and automatic HTTPS.
2. **Supabase PostgreSQL & Auth:** Manages multi-tenant workspaces, RLS policies, encrypted OAuth credentials, and static media buckets.
3. **Background Delivery Engine:**
   - **Primary:** Persistent Node.js worker daemon running `npx tsx src/worker/index.ts` backed by BullMQ and Redis (Upstash/Render/Railway).
   - **Failover / Serverless Fallback:** Vercel Cron calling `GET /api/cron/process-scheduled-posts` every 1 minute via `Authorization: Bearer <CRON_SECRET>`.

---

## 2. Production Environment Variables Checklist

Configure these variables in Vercel (`Project Settings` > `Environment Variables`):

```env
# Application Host
NEXT_PUBLIC_APP_URL=https://autopilot.gtinnox.in

# Supabase Authentication & Database
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# LinkedIn Developer Application (OAuth 2.0)
LINKEDIN_CLIENT_ID=<your-linkedin-client-id>
LINKEDIN_CLIENT_SECRET=<your-linkedin-client-secret>
LINKEDIN_REDIRECT_URI=https://autopilot.gtinnox.in/api/auth/linkedin/callback

# Security & Symmetric Token Encryption
ENCRYPTION_KEY=<64-char-hex-or-32-byte-secret-for-aes-256-gcm>
CRON_SECRET=<secure-random-token-for-cron-endpoint>

# Google Gemini AI Studio
GEMINI_API_KEY=<your-google-gemini-api-key>

# Redis / BullMQ (Primary Worker)
REDIS_URL=rediss://default:<password>@<host>:<port>

# Commercial Billing (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 3. Database Migration Deployment

All database schemas, triggers, and RLS policies are version-controlled in `supabase/migrations`.
To deploy migrations to production Supabase:
```bash
# Link to remote Supabase project
npx supabase link --project-ref opkatczhnzfqcjkmxcvm

# Push migrations
npx supabase db push
```

---

## 4. Persistent Worker Daemon Setup (Render / Railway / VPS)

To deploy the dedicated background worker:
1. Deploy repository to a long-running service (e.g. Render background worker or Railway service).
2. Set build command: `npm install`
3. Set start command: `npm run worker`
4. Inject all environment variables listed above (especially `REDIS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`, and `LINKEDIN_CLIENT_ID`).

---

## 5. Domain & SSL Verification (Vercel)
1. Add custom domain `autopilot.gtinnox.in` in Vercel Project Domains.
2. Configure DNS CNAME record in your domain registrar:
   - Host: `autopilot`
   - Target: `cname.vercel-dns.com`
3. Vercel automatically provisions and renews Let's Encrypt SSL certificates.
