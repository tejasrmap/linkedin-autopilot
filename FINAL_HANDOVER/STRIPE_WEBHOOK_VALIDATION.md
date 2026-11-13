# STRIPE WEBHOOK VALIDATION — LINKEDIN AUTOPILOT
## GT InnoX LLP | Billing Correctness, Idempotency & Replay Protection

**Target Module:** `src/app/api/billing/webhook/route.ts`  
**Database Table:** `public.stripe_events`, `public.subscriptions`  
**Status:** FULLY HARDENED & VERIFIED  

---

## 1. ATOMIC EVENT CLAIMING ARCHITECTURE

To ensure total protection against duplicate event processing across horizontal serverless instances:

```mermaid
flowchart TD
    Webhook[Incoming Stripe Webhook] --> SigCheck{Verify Stripe Signature}
    SigCheck -->|Invalid| Reject400[400 Bad Signature]
    SigCheck -->|Valid| TryInsert[Insert into public.stripe_events with status='processing']
    
    TryInsert -->|Unique Constraint Violation| CheckExisting[Select Existing Event Status]
    CheckExisting -->|status == 'processed'| ReturnDup[Return 200 Deduplicated]
    CheckExisting -->|status == 'processing' < 60s| ReturnInFlight[Return 200 In-Flight]
    CheckExisting -->|status == 'processing' > 60s| ReclaimLock[Reclaim Stale Lock -> Update status='processing']
    CheckExisting -->|status == 'failed'| RetryEvent[Allow Re-Attempt -> Update status='processing']
    
    TryInsert -->|Insert Succeeded| ProcessEvent[Process Subscription Lifecycle]
    ReclaimLock --> ProcessEvent
    RetryEvent --> ProcessEvent
    
    ProcessEvent --> ExtractDates{Authoritative Stripe Period?}
    ExtractDates -->|Missing| FailClosed[Throw Error: Stripe Period Missing -> Mark status='failed']
    ExtractDates -->|Valid| CheckOrder{event.created >= last_event_created?}
    CheckOrder -->|No / Stale Event| RejectOutOfOrder[Safe Return: Out-of-order event skipped]
    CheckOrder -->|Yes| UpdateSub[Upsert Subscription Record with last_event_created]
    
    UpdateSub --> MarkProcessed[Update stripe_events status='processed']
    MarkProcessed --> Return200[Return 200 OK]
```

---

## 2. KEY REFACTOR DETAILS

### 2.1 Elimination of Estimated 30-Day Subscriptions
* **Historical Vulnerability:** Previous fallback logic defaulted to `new Date(Date.now() + 30 * 86400000)` if Stripe did not provide subscription end dates.
* **Hardened Rule:** If `current_period_end` is not authoritative from Stripe's payload or client fetch, the transaction fails closed, updates `stripe_events.status = 'failed'`, and alerts operators. No unverified subscription time is ever created.

### 2.2 Replay & Out-of-Order Rejection
* `public.subscriptions` now records `last_event_created BIGINT`.
* If a delayed webhook arrives out of sequence (e.g. `customer.subscription.updated` arrives after a `customer.subscription.deleted`), the incoming event timestamp (`event.created`) is checked against `last_event_created`. If older, it is ignored safely without overwriting the newer state.

### 2.3 Stale Lock Recovery
* If an edge function crashes mid-execution while holding a `processing` lock, subsequent retries will reclaim the lock after 60 seconds (`updated_at < NOW() - INTERVAL '60 seconds'`), ensuring self-healing without manual database intervention.
