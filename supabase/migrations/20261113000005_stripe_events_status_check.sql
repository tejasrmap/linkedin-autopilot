-- ==============================================================
-- LINKEDIN AUTOPILOT - STRIPE EVENTS STATUS ENHANCEMENT
-- MIGRATION: 20261113000005_stripe_events_status_check.sql
-- BY GT INNOX LLP
-- ==============================================================

-- Allow 'ignored_billing_disabled' status in stripe_events ledger
ALTER TABLE public.stripe_events DROP CONSTRAINT IF EXISTS stripe_events_status_check;
ALTER TABLE public.stripe_events ADD CONSTRAINT stripe_events_status_check 
  CHECK (status IN ('processing', 'processed', 'failed', 'ignored_billing_disabled'));
