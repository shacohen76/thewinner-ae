-- ============================================================================
-- 2026-10-22 — junk_traffic_rules: the ONE place for every junk / bot rule
-- ============================================================================
-- Owner 2026-10-22: "all prior rules moved to Supabase, exactly 1 place, very
-- clear and documented". Full docs: docs/JUNK_TRAFFIC_RULES.md.
--
-- What this migration does (one transaction):
--   1. creates public.junk_traffic_rules (RLS on, service role only)
--   2. seeds it with EVERY rule that was hardcoded in the site before:
--        - 31 crawler names         (was app/api/tag-assign/route.ts BOT_PATTERNS)
--        -  6 spoofed-browser UAs   (was lib/bot-signatures.ts + a SQL mirror in
--                                    admin_tracking_rollup / admin_lang_split)
--        -  3 junk-direct rules     (was lib/junk-traffic.ts, 2026-10-05)
--      + the 5 cloud ASNs approved by the owner on 2026-10-22
--   3. adds public.is_junk_bot_ua(ua) and points the two admin panel functions
--      at it, so the panel reads the SAME table as the site.
--
-- ORDER: apply this BEFORE the site PR is deployed (the site reads this table;
-- if the table is missing the site fails OPEN = tracks everyone, incl. bots).
-- Needs a write window from the fleet orchestrator.
--
-- ROLLBACK (only together with reverting the site PR):
--   restore admin_tracking_rollup / admin_lang_split from
--   db/migrations/2026-07-28_admin_daterange_until.sql + the 2026-08-29 bot list
--   (git history), then DROP FUNCTION public.is_junk_bot_ua(text);
--   DROP TABLE public.junk_traffic_rules;
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
CREATE TABLE public.junk_traffic_rules (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  applies_to  text    NOT NULL CHECK (applies_to IN ('bot', 'direct_junk')),
  kind        text    NOT NULL CHECK (kind IN ('ua_contains', 'asn', 'not_program_country', 'desktop_chrome_below')),
  value       text    NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  note        text    NOT NULL CHECK (length(btrim(note)) > 0),
  added_on    date    NOT NULL DEFAULT current_date,
  added_by    text    NOT NULL,
  UNIQUE (applies_to, kind, value),
  -- value shape per kind
  CONSTRAINT jtr_value_shape CHECK (
       (kind = 'ua_contains'          AND length(btrim(value)) >= 4)   -- no 1-letter rule that hits everyone
    OR (kind = 'asn'                  AND value ~ '^[0-9]+$')
    OR (kind = 'not_program_country'  AND value = '*')
    OR (kind = 'desktop_chrome_below' AND value ~ '^[0-9]{2,3}$')
  ),
  -- SAFETY: a 'bot' rule applies to ALL traffic incl. Google Ads (gclid), so it may
  -- only be an exact single user-agent text — never an ASN / country / version
  -- rule (that could silently drop paid sessions).
  CONSTRAINT jtr_bot_is_single_ua CHECK (
    applies_to <> 'bot' OR (kind = 'ua_contains' AND position('&&' IN value) = 0)
  )
);

ALTER TABLE public.junk_traffic_rules ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
REVOKE ALL ON public.junk_traffic_rules FROM anon, authenticated;

COMMENT ON TABLE public.junk_traffic_rules IS
  'THE one place for junk/bot traffic rules (owner 2026-10-22). Read by the site (/api/tag-assign via lib/junk-rules.ts, cached 10 min) and the admin panel (is_junk_bot_ua). Edit rows here — no PR needed. Docs: thewinner-ae repo docs/JUNK_TRAFFIC_RULES.md';
COMMENT ON COLUMN public.junk_traffic_rules.applies_to IS
  'bot = no click_log row ever, any traffic source (incl. gclid) + excluded from admin panel counts. direct_junk = only DIRECT visits (no referrer/click id/campaign): no row/user_id until the visitor clicks a product.';
COMMENT ON COLUMN public.junk_traffic_rules.kind IS
  'ua_contains: user-agent contains value (case-sensitive; direct_junk may join parts with " && " = all must match). asn: x-vercel-ip-as-number = value. not_program_country: value "*", country known and not an Amazon program country. desktop_chrome_below: desktop Chrome/Edge major < value.';
COMMENT ON COLUMN public.junk_traffic_rules.enabled IS 'false = rule off (keep the row for history instead of deleting it). Live on the site within 10 min.';
COMMENT ON COLUMN public.junk_traffic_rules.note IS 'WHY the rule exists: what it catches + the evidence (counts, dates). Required.';

-- ── 2. Seed: every rule that was hardcoded before + the 2026-10-22 ASNs ────────
INSERT INTO public.junk_traffic_rules (applies_to, kind, value, note, added_on, added_by) VALUES
-- Crawler / automation names — were BOT_PATTERNS in app/api/tag-assign/route.ts (v1.1, 2026-03/05)
('bot','ua_contains','vercel-screenshot',          'Vercel deployment screenshot bot',                       '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','HeadlessChrome',             'headless automation',                                    '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Googlebot',                  'Google search crawler',                                  '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','AdsBot',                     'Google Ads landing-page bot (arrives WITH gclid — must stay a bot rule)', '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Mediapartners-Google',       'Google AdSense crawler',                                 '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Google-Adwords-DisplayAds',  'Google Ads display crawler',                             '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','pageburst',                  'crawler',                                                '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','bingbot',                    'Bing search crawler',                                    '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Baiduspider',                'Baidu crawler',                                          '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','YandexBot',                  'Yandex crawler',                                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','facebookexternalhit',        'Facebook link preview',                                  '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Twitterbot',                 'X/Twitter link preview',                                 '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','LinkedInBot',                'LinkedIn link preview',                                  '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Slurp',                      'Yahoo crawler',                                          '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','DuckDuckBot',                'DuckDuckGo crawler',                                     '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Applebot',                   'Apple crawler',                                          '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','AhrefsBot',                  'SEO tool crawler',                                       '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','SemrushBot',                 'SEO tool crawler',                                       '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','MJ12bot',                    'Majestic crawler',                                       '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Screaming Frog',             'SEO tool crawler',                                       '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','crawler',                    'generic: UA says crawler',                               '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','spider',                     'generic: UA says spider',                                '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','bot/',                       'generic: "...bot/1.0" style UA',                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Bot/',                       'generic: "...Bot/1.0" style UA',                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Bot-',                       'generic: "...Bot-..." style UA',                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','PetalBot',                   'Huawei crawler',                                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','Bytespider',                 'ByteDance crawler',                                      '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','GPTBot',                     'OpenAI crawler',                                         '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','ChatGPT-User',               'ChatGPT browsing fetch',                                 '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','ClaudeBot',                  'Anthropic crawler',                                      '2026-03-27','tag-assign v1.1'),
('bot','ua_contains','PerplexityBot',              'Perplexity crawler',                                     '2026-03-27','tag-assign v1.1'),
-- Spoofed-browser UAs — were lib/bot-signatures.ts (+ SQL mirror in the admin functions)
('bot','ua_contains','Chrome/145.0.0.0',  'SG bot wave 2026-05: impossible future Chrome version at the time; 0 clickouts', '2026-05-25','GEOS2'),
('bot','ua_contains','Chrome/118.0.0.0',  'Aug-2026 residential-proxy bot wave: frozen late-2023 version (also Edg/118)',   '2026-08-29','bot-signatures'),
('bot','ua_contains','Chrome/119.0.0.0',  'Aug-2026 residential-proxy bot wave: frozen late-2023 version (also Edg/119)',   '2026-08-29','bot-signatures'),
('bot','ua_contains','Chrome/120.0.0.0',  'Aug-2026 residential-proxy bot wave: frozen late-2023 version (also Edg/120)',   '2026-08-29','bot-signatures'),
('bot','ua_contains','Firefox/120.0',     'Aug-2026 residential-proxy bot wave: frozen Firefox version',                   '2026-08-29','bot-signatures'),
('bot','ua_contains','Firefox/121.0',     'Aug-2026 residential-proxy bot wave: frozen Firefox version',                   '2026-08-29','bot-signatures'),
-- Junk DIRECT — were lib/junk-traffic.ts (2026-10-05, PR #108)
('direct_junk','not_program_country','*',  'Direct visit from a country with no Amazon program (e.g. CN crawlers). 30d to 10-05: direct = 12,089 sessions, 1.27% clickout', '2026-10-05','CLEANUP 1'),
('direct_junk','desktop_chrome_below','140','Desktop Chrome/Edge >=1 year stale. 0 of ~13K direct sessions on Chrome <140 ever clicked out (to 10-05)',               '2026-10-05','CLEANUP 1'),
('direct_junk','ua_contains','X11; Linux x86_64 && Chrome/147.0.0.0','US Linux crawler first seen 2026-06-18: 8,148 direct sessions, 0 clickouts',              '2026-10-05','CLEANUP 1'),
-- Cloud ASNs — owner OK 2026-10-22. Registry names from RDAP (APNIC/ARIN).
-- Evidence 30d (09-22..10-22, all markets): 848 direct sessions from these 5, 0 clickouts, 0 orders.
-- They DO carry real Google Ads shoppers too — that is why these are direct_junk, never bot.
('direct_junk','asn','132203','TENCENT-NET-AP-CN (Shenzhen Tencent). 485 direct/30d, 0 clickouts; US 260 in 7d: desktop Chrome 148-150, new user_id per page', '2026-10-22','US direct cleanup'),
('direct_junk','asn','16509', 'AMAZON-02. 219 direct/30d, 0 direct clickouts (41/7d all on /best/respiratory-masks)',                                        '2026-10-22','US direct cleanup'),
('direct_junk','asn','14618', 'AMAZON-AES (EC2). 39 direct/30d, 0 direct clickouts (one user_id crawling home + categories)',                                  '2026-10-22','US direct cleanup'),
('direct_junk','asn','15169', 'GOOGLE. 89 direct/30d, 0 direct clickouts',                                                                                   '2026-10-22','US direct cleanup'),
('direct_junk','asn','396982','GOOGLE-CLOUD-PLATFORM. 16 direct/30d, 0 clickouts (UA PTST / Moto G (4) test agents)',                                         '2026-10-22','US direct cleanup');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.junk_traffic_rules;
  IF n <> 45 THEN RAISE EXCEPTION 'ABORT: expected 45 seed rows, got %', n; END IF;
END $$;

-- ── 3. One SQL helper for the admin panel, reading the same table ─────────────
CREATE OR REPLACE FUNCTION public.is_junk_bot_ua(p_ua text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_ua IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.junk_traffic_rules r
    WHERE r.enabled AND r.applies_to = 'bot' AND r.kind = 'ua_contains'
      AND strpos(p_ua, r.value) > 0
  )
$function$;
COMMENT ON FUNCTION public.is_junk_bot_ua(text) IS
  'true if the UA matches an enabled bot rule of public.junk_traffic_rules. Used by admin_tracking_rollup + admin_lang_split.';

-- admin_tracking_rollup: IDENTICAL to the live definition except the is_bot
-- expression (was 6 hardcoded LIKEs = the old lib/bot-signatures.ts mirror).
CREATE OR REPLACE FUNCTION public.admin_tracking_rollup(p_since timestamp with time zone, p_in text[] DEFAULT NULL::text[], p_not_in text[] DEFAULT NULL::text[], p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
    public.is_junk_bot_ua(cl.user_agent)                                     AS is_bot  -- 2026-10-22: rules from public.junk_traffic_rules
  FROM public.click_log cl
  WHERE cl.created_at >= p_since
    AND cl.created_at < coalesce(p_until, 'infinity'::timestamptz)
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

-- admin_lang_split: IDENTICAL to the live definition except the bot filter
-- (was only the old Chrome/145 signature → now every enabled bot rule).
CREATE OR REPLACE FUNCTION public.admin_lang_split(p_since timestamp with time zone, p_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
        AND NOT public.is_junk_bot_ua(cl.user_agent)   -- 2026-10-22: rules from public.junk_traffic_rules
      GROUP BY cl.assigned_tag
    ) t), '[]'::jsonb),
  'purchases', coalesce((SELECT jsonb_agg(t) FROM (
      SELECT d.tag_id                                 AS tag_id,
             coalesce(sum(d.n),0)::int                AS orders,
             round(coalesce(sum(d.rev),0)::numeric,2) AS revenue
      FROM (SELECT DISTINCT ON (a.tag_id, a.scraped_at, a.order_date)
                   a.tag_id, a.delta_order_count AS n, a.delta_revenue AS rev
            FROM public.amazon_purchase_attributions a
            WHERE a.order_date >= p_since::date
              AND a.order_date < coalesce(p_until::date, 'infinity'::date)
              AND a.tag_id NOT IN ('Other','others')
            ORDER BY a.tag_id, a.scraped_at, a.order_date) d
      GROUP BY d.tag_id
    ) t), '[]'::jsonb)
);
$function$;

COMMIT;

-- Read-back after COMMIT:
-- SELECT applies_to, kind, count(*) FROM public.junk_traffic_rules GROUP BY 1,2 ORDER BY 1,2;
--   expect bot/ua_contains 37 · direct_junk/asn 5 · direct_junk/desktop_chrome_below 1
--          direct_junk/not_program_country 1 · direct_junk/ua_contains 1
-- SELECT public.is_junk_bot_ua('Mozilla/5.0 ... Chrome/145.0.0.0 Safari/537.36');  -- true
-- SELECT public.is_junk_bot_ua('Mozilla/5.0 ... Chrome/150.0.0.0 Safari/537.36');  -- false
