-- ============================================================================
-- 2026-11-14 — blog_posts: NEW blog posts from Supabase (no PR per post)
-- ============================================================================
-- Owner 2026-11-14: port the KSP "no-PR blog" flow to AMZ. The original 47 file
-- posts (content/blog/posts/*.md + posts.json) stay UNTOUCHED; NEW posts live in
-- this table and are merged in by lib/blog.ts at request time (ISR-cached). On a
-- slug clash the FILE wins. Full flow doc: AMZ_AFF/Docs_MD/AMZ_BLOG_NEW_POST_FLOW_v1_0.md.
--
-- What this migration does (one transaction):
--   1. creates public.blog_posts (RLS on; anon/authenticated may SELECT only
--      status='published'; all writes via the service-role key / publish script)
--   2. adds indexes on (status), (publish_date), (locale,status)
--   3. unique (slug, locale) so the publish script can UPSERT on_conflict=slug,locale
--
-- MULTI-LANGUAGE: `locale` (default 'en') makes the table ready for localized posts,
--   but SERVING stays English-only today (middleware 307s /ar|/ja/blog → prefix-less
--   English). Publish English rows only until the owner opens the localized-blog flip.
--
-- ORDER: apply this BEFORE (or with) the site PR. If the table is missing the site
--   degrades to files-only (lib/blog.ts try/catch) — safe, just no DB posts.
-- Needs a write window from the fleet orchestrator (Manager / BCPL granter).
--
-- ROLLBACK (together with reverting the site PR):
--   DROP TABLE public.blog_posts;
-- ============================================================================

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
CREATE TABLE public.blog_posts (
  id                bigint   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug              text     NOT NULL,
  locale            text     NOT NULL DEFAULT 'en',
  title             text     NOT NULL,
  tier              int      NOT NULL DEFAULT 3 CHECK (tier BETWEEN 1 AND 4),
  author_id         text     NOT NULL,
  description       text     NOT NULL DEFAULT '',
  quick_answer      text     NOT NULL DEFAULT '',
  tags              text[]   NOT NULL DEFAULT '{}',
  internal_links    text[]   NOT NULL DEFAULT '{}',
  product_links     text[]   NOT NULL DEFAULT '{}',
  outbound_authority text[]  NOT NULL DEFAULT '{}',
  target_words      int      NOT NULL DEFAULT 2000,
  publish_date      date     NOT NULL DEFAULT current_date,
  content_md        text     NOT NULL CHECK (length(btrim(content_md)) >= 200),
  hero_image_url    text,
  hero_image_credit text,
  status            text     NOT NULL DEFAULT 'published'
                             CHECK (status IN ('published', 'draft', 'archived')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, locale)
);

COMMENT ON TABLE public.blog_posts IS
  'NEW blog posts (no PR per post). Merged with the static file posts by lib/blog.ts; file wins on slug clash. Writes via service-role / amz_blog_publish.py. Docs: AMZ_AFF/Docs_MD/AMZ_BLOG_NEW_POST_FLOW_v1_0.md';

-- ── 2. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX blog_posts_status_idx       ON public.blog_posts (status);
CREATE INDEX blog_posts_publish_date_idx ON public.blog_posts (publish_date DESC);
CREATE INDEX blog_posts_locale_status_idx ON public.blog_posts (locale, status);

-- ── 3. RLS: public may read ONLY published rows; writes are service-role only ─
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_posts_anon_read_published
  ON public.blog_posts FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY blog_posts_auth_read_published
  ON public.blog_posts FOR SELECT TO authenticated
  USING (status = 'published');
-- No INSERT/UPDATE/DELETE policies: anon/authenticated cannot write; the
-- service-role key bypasses RLS (used only by amz_blog_publish.py).

COMMIT;
