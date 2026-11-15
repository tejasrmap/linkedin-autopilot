-- ==============================================================
-- MIGRATION 11: AI CONTENT INTELLIGENCE & QUALITY METRICS
-- ENHANCE AI GENERATIONS & BRAND SETTINGS FOR MULTI-TENANT INTELLIGENCE
-- GT INNOX LLP — PRODUCTION HARDENED
-- ==============================================================

BEGIN;

-- 1. Enhance ai_generations with quality score and intelligence metadata
ALTER TABLE public.ai_generations
ADD COLUMN IF NOT EXISTS quality_score NUMERIC DEFAULT NULL;

ALTER TABLE public.ai_generations
ADD COLUMN IF NOT EXISTS topic_category TEXT DEFAULT NULL;

ALTER TABLE public.ai_generations
ADD COLUMN IF NOT EXISTS generation_metadata JSONB DEFAULT '{}'::JSONB;

-- 2. Enhance brand_settings with optional customized writing style preferences
ALTER TABLE public.brand_settings
ADD COLUMN IF NOT EXISTS writing_preferences JSONB DEFAULT '{}'::JSONB;

-- 3. Create index for fast historical workspace lookups
CREATE INDEX IF NOT EXISTS idx_ai_generations_workspace_recent
ON public.ai_generations (workspace_id, created_at DESC);

COMMIT;
