# LinkedIn Autopilot - Production Deployment Runbook
**By GT InnoX LLP**

This document details the production deployment, infrastructure architecture, environment variable configuration, operational health monitoring, and disaster recovery procedures for **LinkedIn Autopilot SaaS**.

---

## 1. System Architecture

LinkedIn Autopilot is engineered with a decoupled, highly available 3-tier architecture:

1. **Frontend & API Gateway:** Next.js 14 App Router running as containerized web service.
2. **Database & Multi-Tenant State:** Managed PostgreSQL via Supabase with Row Level Security (RLS) across 14 tables.
3. **Queue & Background Worker:** Dedicated persistent Node.js publishing worker powered by BullMQ and Redis with automatic DB-poller failover.
4. **External Integration:** LinkedIn REST Posts API (`v202610`), Images API, Videos API, and Documents API with OpenID Connect member authentication.

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env.production` on the production server:

```ini
# Application URLs
NEXT_PUBLIC_APP_URL=https://autopilot.gtinnox.in
APP_URL=https://autopilot.gtinnox.in

# Supabase Production Database
NEXT_PUBLIC_SUPABASE_URL=https://opkatczhnzfqcjkmxcvm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# LinkedIn Developer Production Credentials
LINKEDIN_CLIENT_ID=86pecf126iu1v4
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=https://autopilot.gtinnox.in/api/linkedin/callback
LINKEDIN_API_VERSION=202610

# Security & Encryption (32-byte / 64 hex character key)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CRON_SECRET=your_secure_cron_secret

# AI Studio (Google Gemini)
GEMINI_API_KEY=your_gemini_api_key

# Commercial Billing (Stripe)
# FAIL-SAFE: Defaults to false when unset. Only explicit 'true' activates live billing.
BILLING_ENABLED=false
NEXT_PUBLIC_BILLING_ENABLED=false
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Queue & Background Worker
REDIS_URL=rediss://default:...@...upstash.io:6379
```

---

## 3. Production Deployment with Docker Compose

To deploy the full production stack:

```bash
# 1. Clone repository
git clone https://github.com/tejasrmap/linkedin-autopilot.git
cd linkedin-autopilot

# 2. Configure production environment
cp .env.example .env

# 3. Build and launch services
docker-compose up -d --build

# 4. Check status
docker-compose ps
```

---

## 4. Operational Health & Monitoring

The system exposes an automated operational health check endpoint:

```bash
curl -f https://autopilot.gtinnox.in/api/health
```

Expected JSON Response (`HTTP 200`):
```json
{
  "status": "healthy",
  "service": "LinkedIn Autopilot SaaS",
  "version": "1.0.0",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 42 },
    "linkedin_api": { "status": "healthy", "latencyMs": 120 },
    "worker_engine": { "status": "healthy", "message": "BullMQ Redis Active" }
  }
}
```

---

## 5. Security & Token Protection

- **Storage:** LinkedIn OAuth access tokens are encrypted using **AES-256-GCM** with a distinct 16-byte initialization vector (IV) and authentication tag per account.
- **Client Shielding:** Token columns are excluded from client SELECT queries. Tokens are decrypted strictly server-side immediately before calling LinkedIn's REST API.
- **Auto-Revocation:** If LinkedIn returns HTTP 401 or `REVOKED_ACCESS_TOKEN`, the worker flags the account as `revoked` and notifies workspace admins.

---

## 6. Disaster Recovery & Backup

1. **Database Backups:** Daily automated backups configured via Supabase Managed Point-in-Time Recovery (PITR).
2. **Worker Failover:** If Redis becomes unavailable, the worker automatically switches to transactional PostgreSQL polling with no lost posts.
3. **Recovery After Worker Restart:** On restart, the worker queries `scheduled_jobs` for overdue tasks and executes them with 0ms delay.

