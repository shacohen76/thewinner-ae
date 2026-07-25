-- ============================================================================
-- Admin panel — language/source/program split (MULTIGEO "MG5")
-- Target Supabase project: acreztrqmszpdenpsbwx (shared by both Vercel projects).
--
-- Purpose: surface "which language converts, per geo?" in /admin/tracking.
-- The tags already fire split by program x source x language (tag_pool.program +
-- tag_pool.locale); this migration gives the panel the one aggregate it needs.
--
-- ADDITIVE + REVERSIBLE. One NEW function, nothing existing touched:
--   admin_lang_split(p_since) returns { by_tag, purchases } in a single call:
--     - by_tag   : click side — sessions/clicks/gclid per assigned_tag
--                  (bot-excluded, same Chrome/145 signature as admin_tracking_rollup)
--     - purchases: money side — orders + revenue per tag_id over an order_date window
--   Deliberately GLOBAL (no geo/country filter): in this view `program` (from
--   tag_pool) already IS the geo axis, and purchase attribution is by tag, not by
--   visitor IP — so a global result keeps the click side and the money side on the
--   same denominator. The route joins tag_id -> tag_pool (program, tag_type, locale).
--
-- admin_tracking_rollup is intentionally left byte-identical (lowest-risk path;
-- the existing panels keep their exact data).
--
-- Revenue is sensitive → EXECUTE granted to service_role only (the admin route
-- uses the service-role key); revoked from anon/authenticated.
-- Rollback: DROP FUNCTION public.admin_lang_split(timestamptz);
-- Created: 2026-07-24
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_lang_split(p_since timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  -- Click side: per Amazon tag, bot-excluded. Uses idx_click_log_tag(assigned_tag, created_at).
  'by_tag', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT cl.assigned_tag                                                    AS assigned_tag,
             count(*)                                                           AS sessions,
             count(*) FILTER (WHERE cl.gclid IS NOT NULL AND cl.gclid NOT LIKE 'test%') AS with_gclid,
             count(*) FILTER (WHERE cl.clicked_asins IS NOT NULL
                                AND array_length(cl.clicked_asins,1) > 0)       AS with_clicks
      FROM public.click_log cl
      WHERE cl.created_at >= p_since
        AND cl.assigned_tag IS NOT NULL
        AND NOT (cl.user_agent IS NOT NULL AND cl.user_agent LIKE '%Chrome/145.0.0.0%')
      GROUP BY cl.assigned_tag
    ) t), '[]'::jsonb),
  -- Money side: per tag_id. amazon_purchase_attributions holds per-scrape delta rows
  -- (tag_id/order_date/seq); summing the deltas over the window gives cumulative
  -- orders + revenue booked to that tag. gads tags are language-blind (tag_pool.locale
  -- IS NULL) by design, so paid revenue aggregates onto one per-program row downstream.
  'purchases', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT a.tag_id                                          AS tag_id,
             coalesce(sum(a.delta_order_count),0)::int         AS orders,
             round(coalesce(sum(a.delta_revenue),0)::numeric,2) AS revenue
      FROM public.amazon_purchase_attributions a
      WHERE a.order_date >= p_since::date
      GROUP BY a.tag_id
    ) t), '[]'::jsonb)
);
$function$;

-- Keep this callable only by the service-role key the admin route uses (revenue is sensitive).
REVOKE ALL ON FUNCTION public.admin_lang_split(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lang_split(timestamp with time zone) TO service_role;
