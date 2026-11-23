// ============================================
// FETCH STORE TAGS — build step (TAGS 1, 2026-11-23)
// ============================================
// Runs before `next build` (package.json "build"). ONE read of the 18 fixed store-tag rows in
// Supabase public.tag_pool (program='ae'), validated all-or-nothing, written to
// lib/store-tags.generated.json. That JSON holds ONLY the 18 public tag strings; the key is used
// here, in the build process, and never written to any file or bundle.
//
// Mapping (same rule as AMZ_AFF/amz_store_tags_v1.py):
//   tag_type = <market>_static, except de -> eu_static, ae -> direct_legacy
//
// Fallback (fail closed):
//   - 3 tries, then FAIL the build (exit 1), so a stale committed tag can never ship silently
//     after a store switch. Vercel moves production domains only to a deployment that succeeds,
//     so the current deployment keeps serving.
//   - only an explicit preview / development build (VERCEL_ENV=preview|development) keeps the
//     committed snapshot instead, with a loud `source=snapshot` line. VERCEL_ENV unset (system env
//     vars not exposed, or a local build) counts as production.
//   - emergency / offline local build: env STORE_TAGS_ALLOW_SNAPSHOT=1 allows the snapshot.
//
// A store switch = change the tag_pool row, then Redeploy both Vercel projects. No code change.
// ============================================
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'lib', 'store-tags.generated.json');

export const MARKETS = ['ae', 'sa', 'us', 'ca', 'au', 'sg', 'jp', 'br', 'uk', 'de', 'it', 'es', 'fr', 'pl', 'se', 'ie', 'be', 'nl'];
const SUFFIX = { us: '20', ca: '20', br: '20', au: '22', sg: '22', jp: '22' }; // all others: 21
const TAG_RE = /^[a-z0-9]+-2[0-3]$/;
export const storeType = (m) => ({ ae: 'direct_legacy', de: 'eu_static' })[m] ?? `${m}_static`;

const COMMENT =
  'GENERATED at build by scripts/fetch-store-tags.mjs from Supabase tag_pool (program=ae fixed rows). ' +
  'The committed copy is the snapshot for preview/local builds. To switch a store: change the tag_pool row, ' +
  'then Redeploy. Do not edit by hand.';

/** rows [{tag_id, tag_type}] -> {market: tag}. Throws listing every problem. */
export function validate(rows) {
  const by = new Map();
  for (const r of rows) by.set(r.tag_type, [...(by.get(r.tag_type) ?? []), r.tag_id]);
  const bad = [];
  const tags = {};
  for (const m of MARKETS) {
    const got = by.get(storeType(m)) ?? [];
    if (got.length !== 1) { bad.push(`${m}: ${got.length} rows of ${storeType(m)} (need exactly 1)`); continue; }
    const t = got[0];
    const suf = SUFFIX[m] ?? '21';
    if (typeof t !== 'string' || !TAG_RE.test(t)) bad.push(`${m}: bad format ${JSON.stringify(t)}`);
    else if (!t.endsWith(`-${suf}`)) bad.push(`${m}: ${t} lacks the market suffix -${suf}`);
    tags[m] = t;
  }
  const seen = new Map();
  for (const [m, t] of Object.entries(tags)) {
    if (seen.has(t)) bad.push(`${t} shared by ${seen.get(t)} and ${m}`);
    seen.set(t, m);
  }
  if (bad.length) throw new Error(`tag_pool fixed rows invalid: ${bad.join('; ')}`);
  return tags;
}

function env(name) {
  if (process.env[name]) return process.env[name];
  // local builds: next build reads .env.local itself, but this step runs before it
  const f = join(ROOT, '.env.local');
  if (!existsSync(f)) return undefined;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && line.slice(0, i).trim() === name) return line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

async function fetchRows(tries = 3) {
  const url = env('NEXT_PUBLIC_SUPABASE_URL') || env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  const types = [...new Set(MARKETS.map(storeType))].sort().join(',');
  const q = `select=tag_id,tag_type&program=eq.ae&tag_type=in.(${types})`;
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/tag_pool?${q}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      console.warn(`[store-tags] try ${i}/${tries} failed: ${last}`);
      if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error(`tag_pool read failed after ${tries} tries (${last})`);
}

function write(tags) {
  const body = { _comment: COMMENT, tags: Object.fromEntries(MARKETS.map((m) => [m, tags[m]])) };
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, JSON.stringify(body, null, 2) + '\n');
  renameSync(tmp, OUT);
}

function snapshot() {
  return validate(Object.entries(JSON.parse(readFileSync(OUT, 'utf8')).tags)
    .map(([m, tag_id]) => ({ tag_id, tag_type: storeType(m) })));
}

async function main() {
  const vercelEnv = process.env.VERCEL_ENV;
  const production = !(vercelEnv === 'preview' || vercelEnv === 'development');
  const allowSnapshot = process.env.STORE_TAGS_ALLOW_SNAPSHOT === '1';
  let before = {};
  try { before = snapshot(); } catch { /* no valid committed snapshot */ }
  try {
    const tags = validate(await fetchRows());
    write(tags);
    const changed = MARKETS.filter((m) => before[m] !== tags[m]);
    console.log(`[store-tags] source=db 18/18 rows valid; vs committed snapshot: ` +
      (changed.length ? `CHANGED ${changed.map((m) => `${m} ${before[m]} -> ${tags[m]}`).join(', ')}` : 'no change'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (production && !allowSnapshot) {
      console.error(`[store-tags] FAIL build (VERCEL_ENV=${vercelEnv ?? 'unset'}): ${msg}. Fix the tag_pool rows / env, or set ` +
        'STORE_TAGS_ALLOW_SNAPSHOT=1 for an emergency build from the committed snapshot.');
      process.exit(1);
    }
    snapshot(); // throws if the committed snapshot itself is invalid
    console.warn(`[store-tags] !!! source=snapshot (committed file, NOT the DB): ${msg}` +
      (production ? ' — production build allowed by STORE_TAGS_ALLOW_SNAPSHOT=1' : ''));
  }
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  await main();
}
