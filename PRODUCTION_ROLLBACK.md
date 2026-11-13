# PRODUCTION ROLLBACK PROCEDURE
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Domain:** `https://autopilot.gtinnox.in`  

---

## 1. Quick Rollback via Vercel (Instant Traffic Switch)
Because Next.js deployments on Vercel are immutable, rolling back the production web tier takes less than 30 seconds:

1. Open [Vercel Dashboard](https://vercel.com/) > `linkedin-autopilot` project.
2. Navigate to the **Deployments** tab.
3. Locate the previous healthy deployment (e.g., Commit `9f551fa` or earlier stable release).
4. Click the three dots (`...`) menu on the target deployment and select **Instant Rollback / Promote to Production**.
5. Edge routing shifts 100% of incoming production traffic to the previous deployment immediately.

---

## 2. Git Branch Rollback (Repository Source)
To roll back code at the Git repository level:
```bash
# Fetch latest state
git fetch origin

# Revert a bad commit cleanly
git revert <faulty-commit-sha> --no-edit

# Push to main to trigger standard CI/CD deployment
git push origin main
```

---

## 3. Database Schema Rollback
If a database migration introduced an incompatibility:
1. All migrations are designed to be strictly incremental and backward-compatible (adding nullable columns or non-destructive tables).
2. To revert an applied migration:
   - Identify the specific table or column in `supabase/migrations`.
   - Apply a down-migration script via Supabase SQL Editor or `npx supabase db push`.
   - Example down-migration:
     ```sql
     -- Revert table addition
     DROP TABLE IF EXISTS public.faulty_table CASCADE;
     ```

---

## 4. Post-Rollback Checklist
- [ ] Verify `https://autopilot.gtinnox.in/dashboard` loads with HTTP 200.
- [ ] Confirm user session cookies remain valid.
- [ ] Check `/api/admin/metrics` to ensure publishing queue is intact.
- [ ] Notify active beta users if any action requires re-authentication.
