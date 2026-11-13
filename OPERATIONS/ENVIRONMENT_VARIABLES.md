# ENVIRONMENT VARIABLES REFERENCE
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  

---

## Production Variables Matrix

| Variable | Scope | Status | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Client / Server | Configured | Base application domain (`https://autopilot.gtinnox.in`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client / Server | Configured | Supabase project URL (`https://opkatczhnzfqcjkmxcvm.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client / Server | Configured | Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | Configured | Supabase privileged service role key |
| `ENCRYPTION_KEY` | Server Only | Configured | 64-hex-char symmetric key for AES-256-GCM token encryption |
| `CRON_SECRET` | Server Only | Configured | Authorization token for Vercel Cron endpoints |
| `LINKEDIN_CLIENT_ID` | Server Only | Configured | LinkedIn Developer App Client ID |
| `LINKEDIN_CLIENT_SECRET` | Server Only | Configured | LinkedIn Developer App Client Secret |
| `LINKEDIN_REDIRECT_URI` | Server Only | Configured | LinkedIn OAuth callback URL (`https://autopilot.gtinnox.in/api/linkedin/callback`) |
| `GEMINI_API_KEY` | Server Only | Configured | Google Gemini Generative AI SDK key |
| `ADMIN_EMAILS` | Server Only | Configured | Comma-separated list of platform superadmin emails |
| `REDIS_URL` | Server Only | Pending Config | Redis connection string for BullMQ persistent worker |
| `STRIPE_SECRET_KEY` | Server Only | Pending Config | Stripe secret API key for live subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Server Only | Pending Config | Stripe webhook signing secret for signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Client / Server | Pending Config | Stripe public publishable key |

