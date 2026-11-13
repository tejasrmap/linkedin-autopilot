# SCHEDULER RELIABILITY REPORT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Date:** November 2026  

---

## 1. Scheduling Architecture
LinkedIn Autopilot implements an atomic, fault-tolerant scheduling engine:
- **Delay Precision:** Calculates millisecond delay between `NOW()` and `scheduled_at` in UTC.
- **Past Scheduling Handling:** Any scheduled job with a timestamp in the past clamps delay to `0ms` for immediate catch-up.
- **Race Condition Prevention:** Conditional Compare-And-Swap (CAS) update:
  ```sql
  UPDATE public.posts 
  SET status = 'processing' 
  WHERE id = $1 AND status IN ('scheduled', 'approved', 'draft')
  RETURNING id;
  ```
  If another concurrent worker is processing the post, the second caller receives 0 rows and exits safely, preventing duplicate posts on LinkedIn.

---

## 2. Edge Case Validations

- **Timezone Drift:** All database timestamps are stored with explicit UTC offsets (`TIMESTAMPTZ`). Client calendar interfaces convert to local browser timezone upon display.
- **Batch Scheduling:** `/api/posts/bulk` validates up to 50 scheduled posts per batch, spacing them according to selected cadence (Daily, Weekdays Only, Bi-weekly).
- **Leap Day & DST:** Relies on standardized ISO-8601 string parsing and JavaScript `Date` UTC arithmetic (`getTime()`).
