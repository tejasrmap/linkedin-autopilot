# BETA TEST SCENARIOS & PROTOCOLS
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  

---

## Protocol Matrix

| Test Case | Objective | Action | Expected Outcome |
|---|---|---|---|
| **TC-01** | Account Registration & Verification | Register new email, click verification link | Redirects to `/dashboard` with default workspace provisioned |
| **TC-02** | Personal LinkedIn OAuth | Click Connect LinkedIn, complete consent dialog | Account card displays member name and active badge in `/accounts` |
| **TC-03** | Immediate Text Publishing | Write text commentary and click "Publish Now" | Post status transitions to `published`; live on LinkedIn with official `urn:li:share:...` |
| **TC-04** | Single Post Scheduling | Select scheduled time 10 mins in future | Appears on Calendar with `scheduled` badge; worker publishes at exact time |
| **TC-05** | Media Upload & Publishing | Attach high-resolution PNG image and publish | Image binary uploaded to LinkedIn and renders in LinkedIn feed |
| **TC-06** | AI 7-Day Plan Generation | Generate calendar for custom topic | Produces 7 distinct daily thought angles with 0 duplicates |
| **TC-07** | Global Hashtag Application | Input global hashtags and click "Apply to All" | Appends tags cleanly without duplicating existing hashtags |
| **TC-08** | In-App Support Ticket | Open Support modal, submit medium priority ticket | Ticket appears in member's workspace ticket history and `/admin` queue |
| **TC-09** | Team Invitation & RBAC | Invite member with 'Editor' role | Invitee can draft and edit posts but cannot delete workspace or change billing |

