# LINKEDIN AUTOPILOT — OFFICIAL LINKEDIN DEVELOPER APPROVAL CHECKLIST
**Company:** GT InnoX LLP  
**Developer App ID:** `86pecf126iu1v4`  
**API Version:** `v202401` / `v202610`  
**Target:** General Availability Dual-Destination Publishing  

---

## 1. Personal Profile Destination (Member Level) — Status: APPROVED ✅

The following products and scopes are active and verified on Developer App `86pecf126iu1v4`:
- **Share on LinkedIn (`w_member_social`):** Allows authoring, scheduling, and publishing text, image, video, and PDF documents to the authenticated member's personal feed.
- **Sign In with LinkedIn using OpenID Connect (`openid`, `profile`, `email`):** Allows secure SSO authentication, profile identity retrieval, and unique member URN extraction (`urn:li:person:...`).

---

## 2. Organization / Company Page Destination — Status: AWAITING APPROVAL ⏳

Publishing to LinkedIn Company Pages requires official LinkedIn enterprise product access:

### Required Product:
- **Product Name:** `Community Management API` (formerly Marketing Developer Platform)
- **Required Permission Scopes:**
  - `w_organization_social` — Required to publish posts, images, and videos on behalf of an Organization URN (`urn:li:organization:...`).
  - `r_organization_social` — Required to read organization post engagement metrics, reactions, comments, and analytics.
  - `r_organization_admin` — Required to inspect the member's administrative role on the target company page.

### Activation Checklist for GT InnoX Admin:
1. Log in to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps/86pecf126iu1v4).
2. Navigate to the **Products** tab.
3. Locate **Community Management API** and click **Request Access**.
4. Submit the GT InnoX business verification form (LLP incorporation details and use-case description: "Enterprise LinkedIn multi-account scheduling & analytics SaaS").
5. Once LinkedIn reviews and approves the request (typically 2–5 business days), check that `w_organization_social` appears under the **Auth** tab in **OAuth 2.0 scopes**.
6. In LinkedIn Autopilot, navigate to **LinkedIn Accounts**, click **Request Company Page Access**, and authorize the new scopes.
