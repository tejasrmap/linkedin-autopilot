# DATA PRIVACY AUDIT — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Compliance & Data Protection Assessment

**Standard:** GDPR, CCPA, and LinkedIn API Developer Data Protection Policies.  

---

## 1. Personally Identifiable Information (PII) Inventory

1. **User Identity:** User email, full name, avatar URL (stored in `public.profiles` and Supabase Auth).
2. **Social Account Metadata:** LinkedIn member ID (`sub`), display name, profile image URL (stored in `public.social_accounts`).
3. **LinkedIn OAuth Credentials:** Access tokens and refresh tokens (encrypted with AES-256-GCM in `public.social_accounts`).
4. **Content & Media:** Post text commentary, uploaded images and documents (stored in `public.posts` and Supabase Storage bucket `media`).

---

## 2. Data Retention & Deletion Principles

1. **Account Disconnection**:
   - Calling `/api/linkedin/disconnect` immediately deletes or nullifies all stored encrypted tokens and sets `connection_status = 'disconnected'`.
   - Access tokens are purged immediately from memory and storage.
2. **Post Deletion**:
   - Deleting a post purges the record from `public.posts` and cascades deletion of `public.scheduled_jobs`.
   - Associated media files in Supabase Storage are marked for removal.
3. **Workspace Offboarding**:
   - Deleting a workspace invokes database cascade deletion across posts, scheduled jobs, media references, and notifications.

---

## 3. Data Processing & Geographic Sovereignty

- **Database:** Supabase Managed PostgreSQL hosted in AWS region `ap-south-1` (Mumbai, India).
- **Application:** Vercel Global Edge Network with serverless functions executing in `bom1` / `iad1`.
- **Encryption at Rest:** Enabled across Supabase storage volumes and database tables.
