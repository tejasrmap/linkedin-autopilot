# BACKUP AND DISASTER RECOVERY PLAN
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Classification:** Operational Continuity Standard  

---

## 1. Objectives & Metrics
- **Recovery Point Objective (RPO):** < 1 hour (Maximum acceptable data loss in disaster scenario).
- **Recovery Time Objective (RTO):** < 2 hours (Maximum time to restore full application operations).

---

## 2. Backup Architecture

### 2.1 Database (PostgreSQL on Supabase)
- **Automated Daily Backups:** Managed by Supabase Pro tier with 7-day retention and Point-in-Time Recovery (PITR).
- **Physical Dump Export (Logical Backups):**
  A weekly pg_dump backup script runs automatically to secure an off-site logical snapshot:
  ```bash
  pg_dump -h db.opkatczhnzfqcjkmxcvm.supabase.co -U postgres -d postgres -F c -b -v -f backup_$(date +%Y%m%d).dump
  ```
- **Storage:** Stored in an encrypted AWS S3 bucket with Object Lock (WORM compliance) in region `ap-south-1`.

### 2.2 Static Assets & User Uploads (Supabase Storage)
- **Bucket:** `media`
- All uploaded image and PDF files are stored with immutable UUID filenames.
- Multi-region replication enabled on Supabase storage buckets.

### 2.3 Secret Encryption Keys
- The `ENCRYPTION_KEY` used for AES-256-GCM token encryption is preserved in a secure password vault (1Password / AWS Secrets Manager).
- **CAUTION:** Losing `ENCRYPTION_KEY` invalidates all stored OAuth tokens. If key rotation occurs, existing tokens must be re-encrypted or users must re-authorize accounts.

---

## 3. Disaster Recovery Procedures

### 3.1 Scenario A: Supabase Instance Outage / Corruption
1. Provision new Supabase project or restore from nearest PITR snapshot via Supabase Dashboard.
2. If restoring to a new project:
   - Run `npx supabase db push` to reapply all schemas from `supabase/migrations`.
   - Restore latest logical dump:
     ```bash
     pg_restore -h <new-host> -U postgres -d postgres -v backup_latest.dump
     ```
   - Update `NEXT_PUBLIC_SUPABASE_URL` and keys in Vercel.
   - Redeploy application.

### 3.2 Scenario B: Redis Infrastructure Failure
1. If Redis crashes, BullMQ queue operations will pause.
2. The serverless Cron fallback (`/api/cron/process-scheduled-posts`) continues querying PostgreSQL directly for posts where `scheduled_at <= NOW()` and `status = 'scheduled'`.
3. Scheduled post deliveries continue without dropping posts.
4. Replace or reboot Redis instance and restart worker daemon: `npm run worker`.

### 3.3 Scenario C: LinkedIn API Credential Compromise
1. Log into LinkedIn Developer Portal.
2. Regenerate `Client Secret`.
3. Invalidate compromised credentials.
4. Update `LINKEDIN_CLIENT_SECRET` in Vercel environment.
5. Notify active users to reconnect their profiles via `/accounts`.
