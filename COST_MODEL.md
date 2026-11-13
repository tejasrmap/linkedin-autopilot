# COST MODEL — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Serverless Infrastructure Economics

---

## 1. Monthly Infrastructure Cost Breakdown

| Component | Provider & Tier | Allocation | Monthly Cost (USD) |
| :--- | :--- | :--- | :--- |
| **Serverless App & API** | Vercel (Hobby / Free Plan) | Edge Functions, Frontend, API routes | **$0.00** |
| **PostgreSQL Database** | Supabase (Free Tier / Micro) | 500MB DB, pg_cron, pg_net, Vault | **$0.00** |
| **Media File Storage** | Supabase Storage (Free Tier) | 1GB Media Bucket (Images & PDFs) | **$0.00** |
| **LinkedIn REST API** | LinkedIn Developer Portal | Member social publishing endpoints | **$0.00** |
| **AI Content Engine** | Google Gemini API | Free Tier / Pay-as-you-go | **$0.00** (Free quota) |
| **Persistent Workers** | Eliminated (No Railway/Render/ECS) | 100% Serverless architecture | **$0.00** |
| **Total Baseline Cost** | — | **Zero Infrastructure Overhead** | **$0.00 / month** |

---

## 2. Growth Scaling Projections (At 1,000 Active Beta Users)

- **Vercel Pro (if upgraded for commercial SLA):** $20/month per seat.
- **Supabase Pro (Compute + Daily Backups):** $25/month.
- **Gemini AI API:** ~$15/month for 500,000 generated tokens.
- **Projected Unit Cost per Active Customer:** **<$0.06 / user / month**.
