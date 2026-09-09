// Shopee affiliate CTA — mirrors the Amazon block (wordmark + "Show Offer"
// button), shown ABOVE the Amazon block for SEA visitors only. Added 2026-09-09.
// Click logged fire-and-forget to /api/shopee-click (isolated from Amazon). Purely
// additive; if anything fails, the outbound link still works.
'use client';

import { getSessionId } from './TrackingProvider';

interface ShopeeCtaProps {
  shortLink: string;
  offerId?: string | null;
  pageSlug: string;
  label: string; // same label as the Amazon button (t('showOffer'))
}

function logShopeeClick(offerId: string | null | undefined, pageSlug: string): void {
  try {
    const payload = JSON.stringify({
      session_id: getSessionId(),
      offer_id: offerId ?? null,
      page_slug: pageSlug,
      market: 'sg',
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/shopee-click', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/shopee-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never surface — the outbound link still works
  }
}

export default function ShopeeCta({ shortLink, offerId, pageSlug, label }: ShopeeCtaProps) {
  return (
    <>
      {/* Shopee wordmark — the visual parallel of the "available at amazon" badge */}
      <span
        className="h-10 flex items-center justify-center text-2xl font-extrabold tracking-tight text-[#ee4d2d]"
        aria-label="Shopee"
      >
        Shopee
      </span>

      {/* "Show Offer" button — identical shape to the Amazon button, Shopee-orange */}
      <a
        href={shortLink}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={() => logShopeeClick(offerId, pageSlug)}
        className="w-full bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-105 shadow-lg text-center text-sm block"
      >
        {label}
      </a>
    </>
  );
}
