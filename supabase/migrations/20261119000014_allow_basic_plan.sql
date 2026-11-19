-- ==============================================================
-- LINKEDIN AUTOPILOT - MIGRATION 14
-- ADD 'basic' ALIAS TO SUBSCRIPTIONS PLAN_ID CHECK CONSTRAINT
-- BY GT INNOX LLP
-- ==============================================================

-- Allow 'basic' as a valid tier in subscriptions
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_id_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_check CHECK (plan_id IN ('free', 'basic', 'pro', 'business', 'agency'));
