# BACKUP AND DISASTER RECOVERY RUNBOOK
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Metrics & Targets
- **Recovery Point Objective (RPO):** < 1 hour.
- **Recovery Time Objective (RTO):** < 2 hours.

---

## 2. Backup Schedules & Procedures

### 2.1 Automated Database Snapshots (Supabase)
- Continuous Point-in-Time Recovery (PITR) with 7-day retention on Supabase Pro.
- Automated logical snapshot via `pg_dump`:
  ```bash
  pg_dump -h db.opkatczhnzfqcjkmxcvm.supabase.co -U postgres -d postgres -F c -b -v -f backup_$(date +%Y%m%d).dump
  ```

### 2.2 Static Assets & Storage Buckets
- Bucket: `media` in Supabase Storage.
- Multi-region replication enabled on Supabase infrastructure.

### 2.3 Secret Encryption Keys
- The `ENCRYPTION_KEY` used for AES-256-GCM token encryption is preserved in a secure password vault.
- **CAUTION:** Losing `ENCRYPTION_KEY` invalidates all stored OAuth tokens.

---

## 3. Restoration Runbook
1. Provision target Supabase instance.
2. Apply migrations: `npx supabase db push`.
3. Restore data dump:
   ```bash
   pg_restore -h <target-host> -U postgres -d postgres -v backup_latest.dump
   ```
4. Update Vercel environment variables with new Supabase URL and anon/service keys.
5. Redeploy web tier.
