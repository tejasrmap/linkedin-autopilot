-- ==============================================================
-- LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENTS SCHEMA
-- MIGRATION: 20261119000013_create_razorpay_payments.sql
-- BY GT INNOX LLP
-- ==============================================================

-- 1. Create razorpay_payments table for storing payment transactions & audit trail
CREATE TABLE IF NOT EXISTS public.razorpay_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    user_id UUID,
    order_id TEXT NOT NULL,
    payment_id TEXT UNIQUE,
    signature TEXT,
    amount INTEGER NOT NULL, -- in paise (e.g. 199900 = ₹1,999.00 INR)
    currency TEXT NOT NULL DEFAULT 'INR',
    plan_id TEXT NOT NULL CHECK (plan_id IN ('pro', 'agency')),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    method TEXT, -- 'upi', 'card', 'netbanking', 'wallet'
    notes JSONB DEFAULT '{}'::jsonb,
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_razorpay_payments_order ON public.razorpay_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_payment ON public.razorpay_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_workspace ON public.razorpay_payments(workspace_id);

-- Enable RLS
ALTER TABLE public.razorpay_payments ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on razorpay_payments"
    ON public.razorpay_payments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Workspace members can view payment receipts for their workspace
CREATE POLICY "Members view workspace razorpay payments"
    ON public.razorpay_payments
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

-- 2. Enhance subscriptions table with Razorpay payment reference & currency
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount INTEGER;
