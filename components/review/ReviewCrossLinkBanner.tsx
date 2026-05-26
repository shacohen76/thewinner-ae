// ============================================
// ReviewCrossLinkBanner.tsx — Prominent cross-link between review topics
// ============================================
// Created: 2026-05-26
// Renders an unmissable "Also see: 10 Best Laptops in Canada →" banner.
// Used twice per page (top + bottom) so an Amazon reviewer scrolling
// either direction sees the link to the sibling topic and recognizes
// this is a multi-page comparison site, not a single landing page.
// ============================================

import Link from 'next/link';
import type { GeoProgram } from '@/lib/geo-config';
import type { ReviewTopic } from './program-display';
import { TOPIC_LABEL, PROGRAM_FLAG } from './program-display';

interface ReviewCrossLinkBannerProps {
  program: Exclude<GeoProgram, 'ae'>;
  otherTopic: ReviewTopic;
  /** Country display name (e.g., "Canada"). */
  countryDisplay: string;
}

export default function ReviewCrossLinkBanner({
  program,
  otherTopic,
  countryDisplay,
}: ReviewCrossLinkBannerProps) {
  const flag = PROGRAM_FLAG[program];
  const label = TOPIC_LABEL[otherTopic];

  return (
    <div className="bg-amber-50 border-y-2 border-amber-400 py-4 my-6">
      <div className="max-w-5xl mx-auto px-4">
        <Link
          href={`/review/${program}/${otherTopic}`}
          className="flex items-center justify-center gap-3 flex-wrap text-center group"
        >
          <span className="text-amber-600 font-semibold text-sm md:text-base uppercase tracking-wide">
            Also see
          </span>
          <span className="text-2xl">{flag}</span>
          <span className="text-blue-700 group-hover:text-blue-900 font-bold text-base md:text-xl underline underline-offset-4">
            10 Best {label} in {countryDisplay}
          </span>
          <span className="text-blue-700 group-hover:text-blue-900 font-bold text-xl">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
