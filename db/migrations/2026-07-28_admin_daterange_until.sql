-- ============================================================================
-- Admin panel — optional end-bound (p_until) for a standalone "Yesterday" view
-- Target Supabase project: acreztrqmszpdenpsbwx.
--
-- The panel window was open-ended (>= p_since .. now), so "Today" and
-- "Yesterday" both always included today. This adds an OPTIONAL upper bound
-- p_until to the two aggregation functions so a single day can be isolated.
--
-- ADDITIVE + SAFE: p_until defaults to NULL, and NULL coalesces to +infinity =
-- the exact pre-change behavior. Every existing panel view is byte-identical
-- when p_until is omitted. A narrower window only ever scans FEWER rows.
--
-- Signature note: adding a trailing arg makes a *new* function signature, and
-- keeping the old one alongside would make the app's named-arg call ambiguous.
-- So we DROP the old signature and CREATE the widened one; the currently
-- deployed route (which omits p_until) resolves to the new function with
-- p_until defaulted — no behavior change, no breakage window (run in one txn).
-- Rollback: DROP + recreate the prior signatures (see 2026-07-24 migration for
-- admin_lang_split; admin_tracking_rollup's prior body is unchanged except the
-- p_until arg + the one AND clause).
-- Created: 2026-07-28
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_tracking_rollup(timestamp with time zone, text[], text[]);

CREATE OR REPLACE FUNCTION public.admin_tracking_rollup(
    p_since timestamp with time zone,
    p_in text[] DEFAULT NULL::text[],
    p_not_in text[] DEFAULT NULL::text[],
    p_until timestamp with time zone DEFAULT NULL::timestamp with time zone  -- MG5: optional upper bound
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH filtered AS (
  SELECT
    cl.ip_country,
    coalesce(cl.traffic_source,'unknown')                                   AS source,
    cl.assigned_tag                                                         AS assigned_tag,
    cl.user_id,
    (cl.gclid IS NOT NULL AND cl.gclid NOT LIKE 'test%')                    AS has_gclid,
    (cl.clicked_asins IS NOT NULL AND array_length(cl.clicked_asins,1) > 0) AS has_click,
    coalesce(array_length(cl.clicked_asins,1),0)                            AS asin_count,
    (cl.created_at AT TIME ZONE 'Asia/Dubai')::date                         AS dubai_day,
    coalesce(replace(cl.landing_page,'/best/',''),'unknown')               AS page,
    (cl.user_agent IS NOT NULL AND cl.user_agent LIKE '%Chrome/145.0.0.0%') AS is_bot
  FROM public.click_log cl
  WHERE cl.created_at >= p_since
    AND cl.created_at < coalesce(p_until, 'infinity'::timestamptz)          -- MG5: optional upper bound
    AND (p_in IS NULL OR cl.ip_country = ANY(p_in))
    AND (p_not_in IS NULL OR (cl.ip_country IS NOT NULL AND NOT (cl.ip_country = ANY(p_not_in))))
),
base AS (
  SELECT * FROM filtered WHERE NOT is_bot
)
SELECT jsonb_build_object(
  'totals', (SELECT jsonb_build_object(
      'sessions',      count(*),
      'with_gclid',    count(*) FILTER (WHERE has_gclid),
      'with_clicks',   count(*) FILTER (WHERE has_click),
      'total_asins',   coalesce(sum(asin_count),0),
      'bots_excluded', (SELECT count(*) FROM filtered WHERE is_bot)
    ) FROM base),
  'by_country', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT ip_country,
             count(*)                          AS sessions,
             count(*) FILTER (WHERE has_gclid) AS with_gclid,
             count(*) FILTER (WHERE has_click) AS with_clicks,
             coalesce(sum(asin_count),0)       AS total_asins
      FROM base GROUP BY ip_country
    ) t), '[]'::jsonb),
  'by_day', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT dubai_day                         AS day,
             count(*)                          AS sessions,
             count(*) FILTER (WHERE has_gclid) AS with_gclid,
             count(*) FILTER (WHERE has_click) AS with_clicks,
             coalesce(sum(asin_count),0)       AS total_asins
      FROM base GROUP BY dubai_day
    ) t), '[]'::jsonb),
  'by_day_source', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT dubai_day AS day, source, count(*) AS n
      FROM base GROUP BY dubai_day, source
    ) t), '[]'::jsonb),
  'by_source', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT source, count(*) AS n FROM base GROUP BY source
    ) t), '[]'::jsonb),
  'by_tag', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT assigned_tag,
             count(*)                          AS sessions,
             count(*) FILTER (WHERE has_gclid) AS with_gclid,
             count(*) FILTER (WHERE has_click) AS with_clicks,
             coalesce(sum(asin_count),0)       AS total_asins
      FROM base WHERE assigned_tag IS NOT NULL GROUP BY assigned_tag
    ) t), '[]'::jsonb),
  'top_pages', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT page,
             count(*)                          AS visits,
             count(*) FILTER (WHERE has_click) AS clicks
      FROM base GROUP BY page ORDER BY count(*) DESC LIMIT 15
    ) t), '[]'::jsonb),
  'user_summary', (SELECT jsonb_build_object(
      'total_users',           count(*),
      'new_users',             count(*) FILTER (WHERE sessions = 1),
      'returning_users',       count(*) FILTER (WHERE sessions > 1),
      'cross_source_users',    count(*) FILTER (WHERE srcs > 1),
      'users_with_clicks',     count(*) FILTER (WHERE any_click),
      'users_with_gclid',      count(*) FILTER (WHERE any_gclid),
      'total_sessions',        coalesce(sum(sessions),0),
      'returning_with_clicks', count(*) FILTER (WHERE sessions > 1 AND any_click),
      'new_with_clicks',       count(*) FILTER (WHERE sessions = 1 AND any_click)
    ) FROM (
      SELECT user_id,
             count(*)               AS sessions,
             count(DISTINCT source) AS srcs,
             bool_or(has_click)     AS any_click,
             bool_or(has_gclid)     AS any_gclid
      FROM base WHERE user_id IS NOT NULL GROUP BY user_id
    ) u)
);
$function$;

-- ── admin_lang_split — same optional upper bound (click side + money side) ──
DROP FUNCTION IF EXISTS public.admin_lang_split(timestamp with time zone);

CREATE OR REPLACE FUNCTION public.admin_lang_split(
    p_since timestamp with time zone,
    p_until timestamp with time zone DEFAULT NULL::timestamp with time zone  -- MG5: optional upper bound
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'by_tag', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT cl.assigned_tag                                                    AS assigned_tag,
             count(*)                                                           AS sessions,
             count(*) FILTER (WHERE cl.gclid IS NOT NULL AND cl.gclid NOT LIKE 'test%') AS with_gclid,
             count(*) FILTER (WHERE cl.clicked_asins IS NOT NULL
                                AND array_length(cl.clicked_asins,1) > 0)       AS with_clicks
      FROM public.click_log cl
      WHERE cl.created_at >= p_since
        AND cl.created_at < coalesce(p_until, 'infinity'::timestamptz)
        AND cl.assigned_tag IS NOT NULL
        AND NOT (cl.user_agent IS NOT NULL AND cl.user_agent LIKE '%Chrome/145.0.0.0%')
      GROUP BY cl.assigned_tag
    ) t), '[]'::jsonb),
  'purchases', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT a.tag_id                                          AS tag_id,
             coalesce(sum(a.delta_order_count),0)::int         AS orders,
             round(coalesce(sum(a.delta_revenue),0)::numeric,2) AS revenue
      FROM public.amazon_purchase_attributions a
      WHERE a.order_date >= p_since::date
        AND a.order_date < coalesce(p_until::date, 'infinity'::date)
      GROUP BY a.tag_id
    ) t), '[]'::jsonb)
);
$function$;

-- DROP cleared the grants; re-assert service_role-only (revenue is sensitive).
REVOKE ALL ON FUNCTION public.admin_lang_split(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lang_split(timestamp with time zone, timestamp with time zone) TO service_role;
