-- ==============================================================
-- LINKEDIN AUTOPILOT - PR #38 SECURITY MIGRATION
-- MIGRATION: 20261121000015_authoritative_checkout_records.sql
-- PURPOSE: Authoritative association between checkout/order/subscription sessions,
--          workspace ownership, payment mode, and verified settlement status.
-- SAFETY NOTICE: Per PR #38 instructions, this migration file is created and
--                documented, but MUST NOT be executed on production Supabase.
-- BY GT INNOX LLP
-- ==============================================================

-- 1. Add subscription_id and payment_mode to razorpay_payments
ALTER TABLE public.razorpay_payments ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.razorpay_payments ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'standard';

-- 2. Indexes for fast authoritative checkout lookups
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_subscription ON public.razorpay_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_workspace_status ON public.razorpay_payments(workspace_id, status);

-- 3. Document table columns for security audits
COMMENT ON COLUMN public.razorpay_payments.order_id IS 'Authoritative order ID or subscription ID initialized on server';
COMMENT ON COLUMN public.razorpay_payments.subscription_id IS 'Razorpay recurring subscription ID for Autopay e-mandates';
COMMENT ON COLUMN public.razorpay_payments.payment_mode IS 'Mode of payment: autopay vs one_time';
