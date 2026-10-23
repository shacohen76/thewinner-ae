# Junk & bot traffic rules — the ONE place

**Owner decision 2026-10-22:** every rule that decides "this visitor is junk / a bot,
don't give it a user ID or a click_log row" lives in **one Supabase table**:
`public.junk_traffic_rules`. Changing a rule = editing a row. **No PR, no deploy.**

| Piece | File / object | Holds rule values? |
|---|---|---|
| The rules | Supabase table `public.junk_traffic_rules` | **YES — the only place** |
| Loader (10-min cache, fail-open) | `lib/junk-rules.ts` | no |
| Matching logic | `lib/junk-traffic.ts` | no |
| The decision (site) | `app/api/tag-assign/route.ts` | no |
| The decision (admin panel) | SQL `public.is_junk_bot_ua(ua)` → used by `admin_tracking_rollup`, `admin_lang_split`; `app/api/admin/tracking/route.ts` | no |
| Table + seed | `db/migrations/2026-10-22_junk_traffic_rules.sql` | seed only (history) |

---

## 1. What a rule does (column `applies_to`)

| applies_to | Which visits | What happens | Never blocks the page |
|---|---|---|---|
| `bot` | **any** visit (also Google Ads / gclid) whose user-agent matches | No click_log row, ever. Admin panel also excludes old rows that match. | ✓ |
| `direct_junk` | **only DIRECT** visits: no outside referrer, no gclid/fbclid, no campaign param (`utm_*`, `gbraid`, `wbraid`, `msclkid`) | No click_log row and no user ID at landing. Links still get the right tag + Amazon domain. **If the visitor clicks a product, the session is created right then** (the click is never lost). GTM/GA4 is skipped from the visitor's 2nd page load on. | ✓ |

Because a `bot` rule also hits paid traffic, the table **only allows a plain
user-agent text** for `bot` rules (DB constraint `jtr_bot_is_single_ua`). ASN /
country / browser-version rules can only be `direct_junk`.

## 2. Rule kinds (column `kind`)

| kind | value | Matches when | Allowed for |
|---|---|---|---|
| `ua_contains` | text, ≥4 chars | user-agent contains the text (case-sensitive). `direct_junk` may join parts with ` && ` → **all** parts must be present | bot, direct_junk |
| `asn` | digits, e.g. `132203` | the visitor's network number (Vercel header `x-vercel-ip-as-number`) equals it | direct_junk |
| `not_program_country` | `*` | country is known and is **not** one of our Amazon program countries (`lib/geo-config`) | direct_junk |
| `desktop_chrome_below` | e.g. `140` | desktop (not mobile) Chrome/Edge with major version below it | direct_junk |

Other columns: `enabled` (switch a rule off without losing history), `note`
(**required** — why it exists + the evidence), `added_on`, `added_by`.

## 3. Fixed safety rules (in code on purpose — not junk rules)

1. **Google Ads money path is never skipped:** gads traffic / anything with a gclid
   always gets its row (`lib/tracking.ts` `shouldPersist`). Only a `bot` rule (exact
   user-agent, e.g. AdsBot) can skip it — as before.
2. **A product click always creates the session** (`clicked_asin` → persist).
3. **No user-agent at all = bot.**
4. **Table unreadable → no rules apply → everyone is tracked** (fail-open). Junk slips
   through for a while; real data is never lost. Logged as `[junk-rules]` in Vercel.

## 4. How to change a rule (SQL, service role / SQL editor)

All changes are live on the site within **10 minutes** (cache in `lib/junk-rules.ts`)
and immediately in the admin panel.

```sql
-- See all rules
SELECT id, applies_to, kind, value, enabled, added_on, added_by, note
FROM public.junk_traffic_rules ORDER BY applies_to, kind, id;

-- Add a cloud network (direct visits only)
INSERT INTO public.junk_traffic_rules (applies_to, kind, value, note, added_by)
VALUES ('direct_junk', 'asn', '12345',
        'NAME-FROM-RDAP. N direct sessions / 30d, 0 clickouts, 0 orders (date)', 'session name');

-- Add a bot user-agent text
INSERT INTO public.junk_traffic_rules (applies_to, kind, value, note, added_by)
VALUES ('bot', 'ua_contains', 'SomeScraper/', 'why + evidence', 'session name');

-- Switch a rule off (keep the row for history)
UPDATE public.junk_traffic_rules SET enabled = false WHERE id = 42;
```

**Before adding a rule, measure it** (owner rule): count the sessions it would hit
over 30 days and confirm **0 clickouts / 0 orders / 0 gads sessions you care about**
for `direct_junk`. Never add a home-internet provider (Comcast, AT&T, Verizon, …) —
real shoppers come from those.

## 5. Cleaning rows that already exist (optional, needs a write window)

The table stops **new** rows. Old rows are cleaned with the reversible quarantine
pattern (move to `click_log_bot_backup_<date>`, never a blind delete); examples:
`AMZ_AFF/claude_code_files/click_log_junk_quarantine_2026_10_05.sql` and
`…/click_log_junk_asn_quarantine_2026_10_22.sql`. A cleanup for the `asn` rules can
read the table directly:

```sql
-- dry-run count (read-only)
SELECT count(*) FROM public.click_log c
WHERE c.created_at >= now() - interval '30 days'
  AND c.traffic_source = 'direct' AND c.clicked_asins = '{}'
  AND c.gclid IS NULL AND c.fbclid IS NULL AND c.matched_order IS NULL
  AND c.as_number::text IN (SELECT value FROM public.junk_traffic_rules
                            WHERE enabled AND applies_to = 'direct_junk' AND kind = 'asn');
```

## 6. Deliberately NOT in the table (and why)

These are UA lists with a **different job** than "track or not". They stay in code
because they must work even if the database is down, and they run before every page:

| List | Where | Job | Why not in the table |
|---|---|---|---|
| `ALLOWED_BOT_PATTERNS` | `middleware.ts` | Search/social/AI crawlers: never geo-blocked, no geo cookie (SEO: crawlers see the standard page) | SEO safety; must never depend on a DB read |
| `BLOCKED_BOT_PATTERNS` | `middleware.ts` | Hard **403** for scraper tools (Lightpanda, python-requests, …) | It blocks pages; a DB read in middleware would add risk/latency to every page |
| `isBotClient()` | `components/TrackingProvider.tsx` | Browser-side: search crawlers get no link rewriting (SEO) | The browser can't read the table; the server is the decision point |
| bot regex in `refresh_ctk_clicks`, `category_top_keywords_live` | Supabase functions | Category keyword ranking by clickouts | Different purpose (ranking), owned by the keyword pipeline |

## 7. History

| Date | Change |
|---|---|
| 2026-03 / 05 | crawler names hardcoded in `/api/tag-assign` |
| 2026-05-25 | `Chrome/145.0.0.0` spoofed-bot signature (GEOS2) |
| 2026-08-29 | `lib/bot-signatures.ts` (Aug bot wave) + a SQL mirror in the admin functions |
| 2026-10-05 | junk-direct rules in `lib/junk-traffic.ts`, decided in middleware (PR #108) |
| 2026-10-22 | **all of the above moved into `public.junk_traffic_rules`** + 5 cloud ASNs (132203, 16509, 14618, 15169, 396982). The decision moved from middleware to `/api/tag-assign`. |

### Known trade-off of 2026-10-22
The middleware used to decide junk **before** the first page rendered, so GTM/GA4
was skipped on page 1 too. Now `/api/tag-assign` decides (after page 1 loads), so a
junk visitor's **first** page loads GTM; page 2+ skip it. The DB (click_log / user
IDs) behaves exactly as before. Chosen so the middleware never reads the database.
