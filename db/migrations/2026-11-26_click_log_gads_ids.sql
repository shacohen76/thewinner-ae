-- AGT 1 Step 0 (2026-11-26): Google Ads ids on click_log. MEASURE ONLY — no tag / attribution
-- logic reads these columns. Filled by /api/tag-assign from the account-level final URL suffix
-- agid={adgroupid}&cmpid={campaignid}&accid=<account id>.
-- Run in a Manager 6.9 write window. Safe order: this SQL first, then merge the site PR.
-- (The code also survives the reverse order: insertClickLog retries without the ids.)
-- Nullable, no default => catalog-only change, no table rewrite. lock_timeout keeps it from
-- queueing behind a long query; if it times out, just run it again.
SET lock_timeout = '3s';
ALTER TABLE public.click_log
  ADD COLUMN IF NOT EXISTS ad_group_id     bigint,
  ADD COLUMN IF NOT EXISTS campaign_id     bigint,
  ADD COLUMN IF NOT EXISTS gads_account_id bigint;
COMMENT ON COLUMN public.click_log.ad_group_id     IS 'AGT1 2026-11-26: Google Ads {adgroupid} of the landing click (final URL suffix agid). Measure only.';
COMMENT ON COLUMN public.click_log.campaign_id     IS 'AGT1 2026-11-26: Google Ads {campaignid} of the landing click (final URL suffix cmpid). Measure only.';
COMMENT ON COLUMN public.click_log.gads_account_id IS 'AGT1 2026-11-26: Google Ads customer id of the landing click (static accid in the account suffix). Measure only.';

-- Check:
--   select count(*) filter (where ad_group_id is not null) as with_ids, count(*) as all_rows
--   from public.click_log where created_at > now() - interval '1 hour';
-- Rollback (after reverting the site PR):
--   ALTER TABLE public.click_log DROP COLUMN IF EXISTS ad_group_id,
--     DROP COLUMN IF EXISTS campaign_id, DROP COLUMN IF EXISTS gads_account_id;
