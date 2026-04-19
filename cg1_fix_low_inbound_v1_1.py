#!/usr/bin/env python3
"""
CG1 Low-Inbound Fix v1.1
=========================
Adds contextual internal links to blog posts that have <2 inbound links.

Usage:
  python cg1_fix_low_inbound.py              # dry run
  python cg1_fix_low_inbound.py --apply      # apply changes

Run from repo root (where content/blog/posts/ lives).
"""

import os
import re
import sys

POSTS_DIR = os.path.join("content", "blog", "posts")

FIXES = [
    (
        "how-to-pick-wireless-earbuds",
        "guide-to-buying-a-laptop",
        'If you\'re also upgrading your audio setup, check out our guide on [how to pick the right wireless earbuds](/blog/how-to-pick-wireless-earbuds) for every budget.\n\n',
    ),
    (
        "guide-to-kids-toys-games",
        "guide-to-gifting",
        'Shopping for little ones? Our [guide to kids\' toys and games](/blog/guide-to-kids-toys-games) breaks down safety ratings and age-appropriate picks.\n\n',
    ),
    (
        "guide-to-makeup-tips-from-professionals",
        "how-to-choose-perfume-online",
        'For more beauty advice, see our [guide to makeup tips from real professionals](/blog/guide-to-makeup-tips-from-professionals) — practical techniques that actually work.\n\n',
    ),
    (
        "guide-to-most-watched-movies",
        "how-to-set-up-movie-night",
        'Not sure what to watch? Start with our [guide to the most-watched movies of all time](/blog/guide-to-most-watched-movies) for inspiration.\n\n',
    ),
    (
        "guide-to-outdoor-camping-gear",
        "how-to-start-a-new-hobby",
        'Thinking about getting outdoors? Our [guide to camping gear for hot climates](/blog/guide-to-outdoor-camping-gear) covers everything you need without overspending.\n\n',
    ),
    (
        "guide-to-pro-cooking-at-home",
        "how-to-cook-quick-dinners",
        'Want to level up beyond quick meals? Our [guide to pro-level cooking at home](/blog/guide-to-pro-cooking-at-home) covers techniques anyone can learn.\n\n',
    ),
    (
        "guide-to-starting-reading-habit",
        "guide-to-best-selling-books-all-time",
        'Once you\'ve found your next book, our [guide to starting a reading habit that sticks](/blog/guide-to-starting-reading-habit) will help you stay consistent.\n\n',
    ),
    (
        "guide-to-home-gardening-tools",
        "guide-to-sustainable-shopping",
        'Growing your own herbs is one of the simplest sustainable swaps — see our [guide to home gardening tools](/blog/guide-to-home-gardening-tools) to get started.\n\n',
    ),
]


def find_insertion_point(content: str) -> int:
    """Find position after the first ## heading's following paragraph."""
    match = re.search(r'^## .+$', content, re.MULTILINE)
    if match:
        next_para_break = content.find('\n\n', match.end())
        if next_para_break != -1:
            return next_para_break + 2

    first_break = content.find('\n\n')
    if first_break != -1:
        return first_break + 2

    return len(content)


def main():
    apply_mode = "--apply" in sys.argv

    print("=" * 55)
    print("CG1 Low-Inbound Fix v1.1")
    print(f"Mode: {'APPLY' if apply_mode else 'DRY RUN'}")
    print("=" * 55)

    if not os.path.isdir(POSTS_DIR):
        print(f"\n❌ Directory not found: {POSTS_DIR}")
        print("   Run this from repo root (where content/blog/posts/ lives)")
        sys.exit(1)

    fixed = 0
    skipped = 0

    for target_slug, host_slug, sentence in FIXES:
        host_path = os.path.join(POSTS_DIR, f"{host_slug}.md")

        if not os.path.isfile(host_path):
            print(f"\n⚠️  Host file not found: {host_slug}.md — skipping")
            skipped += 1
            continue

        with open(host_path, 'r', encoding='utf-8') as f:
            content = f.read()

        if f"/blog/{target_slug}" in content:
            print(f"\n✅ {host_slug} already links to {target_slug} — skipping")
            skipped += 1
            continue

        pos = find_insertion_point(content)
        new_content = content[:pos] + sentence + content[pos:]

        print(f"\n📝 {host_slug}.md")
        print(f"   → Adding link to: /blog/{target_slug}")
        print(f"   → Insert at char {pos}")
        print(f"   → \"{sentence.strip()[:80]}...\"")

        if apply_mode:
            with open(host_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"   ✅ Written")
        else:
            print(f"   (dry run — not written)")

        fixed += 1

    print(f"\n{'=' * 55}")
    print(f"📊 Results: {fixed} fixes {'applied' if apply_mode else 'planned'}, {skipped} skipped")
    if not apply_mode and fixed > 0:
        print(f"\n💡 Run with --apply to write changes:")
        print(f"   python cg1_fix_low_inbound.py --apply")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    main()
