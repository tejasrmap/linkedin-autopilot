# COMMERCIAL PRICING & PLAN MATRIX
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## 1. Commercial Tier Definitions

| Tier | Price | Target Audience | Limits & Entitlements | Stripe Price ID |
|---|---|---|---|---|
| **Free Starter** | $0 / forever | Individual founders & creators testing the platform | 1 Account, 15 Posts/mo, 50 AI Credits, Standard Support | `price_free` |
| **Pro Growth** | $29 / month | Growing creators, consultants, and executive leaders | 5 Accounts, 500 Posts/mo, 2,000 AI Credits, Media & Video Publishing, BullMQ Priority | `price_pro_monthly` |
| **Agency Enterprise** | $199 / month | Agencies & marketing teams managing multiple brands | 50 Accounts, 5,000 Posts/mo, 10,000 AI Credits, Multi-tenant Workspaces, 24/7 SLA | `price_agency_monthly` |

---

## 2. Quota Enforcement Logic
All limits are verified against live database counts in `/api/subscription`:
- `postsThisMonth`: Count of posts created in current calendar month (`created_at >= startOfMonth`).
- `connectedAccounts`: Count of accounts with `connection_status = 'active'`.
- `aiCreditsUsed`: Count of AI generation requests logged in `ai_generations`.

---

## 3. Subscription Management Actions
- **Upgrades:** Immediate checkout session via `POST /api/billing/checkout`.
- **Invoices & Receipts:** Downloadable via `POST /api/billing/portal` (Stripe Customer Portal).
- **Cancellations:** User can cancel anytime in the customer portal; access remains active until `current_period_end`.

