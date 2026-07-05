-- ============================================================================
-- Tag-Pool Mechanics V2 (Decision 157) — flag-gated, OFF by default
-- Applied 2026-07-05 to Supabase project acreztrqmszpdenpsbwx (shared by BOTH
-- Vercel projects thewinner-ae + thewinners-ae).
--
-- Purpose: per-program pool tuning + the visible warming-progress signal.
-- Additive & flag-off: NO behavior change until program_pool_config.mechanics_v2
-- is flipped true (single DB column ⇒ one flip covers both projects).
-- See Docs_MD/tagpool_mechanics_impl_handoff.md and TAGPOOL_ATTRIBUTION_SPEC_v1_0.md.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.program_pool_config (
  program              TEXT PRIMARY KEY,
  marketplace          TEXT NOT NULL,
  currency             TEXT NOT NULL,
  visibility_threshold INT  NOT NULL DEFAULT 4,    -- orders for a tag to graduate to stable (per-market)
  soft_hold_minutes    INT  NOT NULL DEFAULT 10,   -- assignment hold before clickout (fast churn)
  stable_pin_hours     INT  NOT NULL DEFAULT 24,   -- pin duration after a stable tag's clickout
  warming_pin_minutes  INT  NOT NULL DEFAULT 20,   -- pin after a warming tag's clickout (sub-hour: cover one session, keep cycling)
  warming_target_m     INT  NOT NULL DEFAULT 4,    -- warming pool target W = (K - S) / m
  tag_prefix           TEXT NOT NULL,
  mechanics_v2         BOOL NOT NULL DEFAULT false, -- THE FLAG (off = exact V1 behavior)
  enabled              BOOL NOT NULL DEFAULT true,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AE row, flag OFF (AE stays byte-identical until flipped on the shared DB).
INSERT INTO public.program_pool_config
  (program, marketplace, currency, visibility_threshold, soft_hold_minutes,
   stable_pin_hours, warming_pin_minutes, warming_target_m, tag_prefix, mechanics_v2)
VALUES ('ae', 'amazon.ae', 'AED', 4, 10, 24, 20, 4, 'twnrae', false)
ON CONFLICT (program) DO NOTHING;

-- Warming-progress signal: set on clickout. The ONLY visible signal for sub-threshold
-- warming tags (Amazon hides <4-order tags), and the warming assignment priority key.
ALTER TABLE public.tag_pool ADD COLUMN IF NOT EXISTS last_clickout_at TIMESTAMPTZ;

-- RLS on, no policy → service_role (the app + crons) bypasses; anon/auth get nothing.
-- Matches the other pool tables (Decision 148).
ALTER TABLE public.program_pool_config ENABLE ROW LEVEL SECURITY;
