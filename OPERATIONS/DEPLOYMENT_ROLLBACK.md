# PRODUCTION ROLLBACK RUNBOOK
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Instant 30-Second Web Tier Rollback (Vercel)
Vercel keeps immutable build deployments. If a regression occurs:
1. Open [Vercel Dashboard](https://vercel.com/) > `linkedin-autopilot` project.
2. Navigate to **Deployments**.
3. Locate the previous healthy deployment SHA.
4. Click `...` > **Instant Rollback / Promote to Production**.
5. Traffic routes to the previous build immediately.

---

## 2. Git Source Reversion
```bash
git fetch origin
git revert <commit-sha> --no-edit
git push origin main
```

---

## 3. Database Schema Rollback
All migrations in `supabase/migrations/` are non-destructive and backward compatible. If a column or table must be reverted:
```sql
DROP TABLE IF EXISTS public.faulty_table CASCADE;
```
