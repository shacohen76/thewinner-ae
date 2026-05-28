/**
 * fix_blog_toc_anchors.mjs
 * ------------------------------------------------------------------
 * One-time / repeatable post-processor for CG1 blog markdown files.
 *
 * Problem it fixes:
 *   - The model sometimes emits explicit `{#custom-id}` anchors on headings,
 *     which the remark + remark-slug pipeline does NOT support — they render
 *     as literal text AND pollute the auto-generated heading id.
 *   - The in-body "## Table of Contents" anchors must EXACTLY match the
 *     heading ids that remark-slug (github-slugger) actually produces,
 *     otherwise the TOC links don't jump.
 *
 * What it does, per file:
 *   1. Strips any ` {#...}` suffix from H2/H3 headings.
 *   2. Computes the canonical github-slugger id for each heading
 *      (same library remark-slug uses — guaranteed to match server render).
 *   3. Rewrites every anchor inside the "## Table of Contents" list so it
 *      points at the correct id, matching by visible link text.
 *
 * Usage:
 *   node fix_blog_toc_anchors.mjs <file1.md> <file2.md> ...
 *
 * Run from anywhere; pass absolute paths. Requires github-slugger from the
 * website repo's node_modules (so run with that repo as cwd or via npx there).
 */

import fs from 'node:fs';
import GithubSlugger from 'github-slugger';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node fix_blog_toc_anchors.mjs <file.md> ...');
  process.exit(1);
}

// Mirror github-slugger's behavior for a single heading's visible text.
function slugForText(text, slugger) {
  // Strip markdown link syntax / inline formatting markers from heading text
  const clean = text
    .replace(/\{#[^}]*\}\s*$/, '')   // remove trailing {#id}
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [txt](url) -> txt
    .replace(/[*_`]/g, '')            // strip emphasis/code markers
    .trim();
  return { clean, slug: slugger.slug(clean) };
}

let totalFixed = 0;

for (const file of files) {
  let md = fs.readFileSync(file, 'utf8');
  const eol = md.includes('\r\n') ? '\r\n' : '\n'; // preserve original line endings
  const lines = md.split(/\r?\n/);                  // tolerate CRLF when matching

  const slugger = new GithubSlugger(); // fresh per doc — matches per-page render
  // Map from normalized visible heading text -> canonical slug, in document order.
  const headingTextToSlug = new Map();

  // Pass 1: strip {#...} from headings and compute canonical slugs in order.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,3})\s+(.*?)\s*$/);
    if (!m) continue;
    const hashes = m[1];
    let headingText = m[2];
    // Skip the TOC heading itself from slug registration order? No — github-slugger
    // registers EVERY heading including "Table of Contents", exactly like the server.
    const stripped = headingText.replace(/\s*\{#[^}]*\}\s*$/, '');
    const { clean, slug } = slugForText(stripped, slugger);
    lines[i] = `${hashes} ${stripped}`;
    // Key by lowercased cleaned text for matching TOC entries
    headingTextToSlug.set(clean.toLowerCase(), slug);
  }

  // Pass 2: rewrite TOC list anchors. A TOC line looks like:
  //   - [Visible Text](#whatever)   (possibly nested with indentation)
  let inToc = false;
  let fixedInFile = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{2,3}\s+(.*)$/);
    if (h) {
      // entering/leaving TOC region
      inToc = /table of contents/i.test(h[1]);
      continue;
    }
    if (!inToc) continue;
    const item = lines[i].match(/^(\s*[-*]\s*)\[([^\]]+)\]\(#([^)]*)\)(.*)$/);
    if (!item) continue;
    const prefix = item[1];
    const visible = item[2];
    const oldAnchor = item[3];
    const rest = item[4];
    const key = visible
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim()
      .toLowerCase();
    const correct = headingTextToSlug.get(key);
    if (correct && correct !== oldAnchor) {
      lines[i] = `${prefix}[${visible}](#${correct})${rest}`;
      fixedInFile++;
    }
  }

  const out = lines.join(eol);
  if (out !== md) {
    fs.writeFileSync(file, out, 'utf8');
  }
  console.log(`${file.split(/[\\/]/).pop()}: ${fixedInFile} TOC anchors corrected`);
  totalFixed += fixedInFile;
}

console.log(`\nDone. ${totalFixed} anchors corrected across ${files.length} file(s).`);
