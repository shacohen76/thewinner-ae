// Shopee affiliate CTA — parallel to the Amazon button, SEA visitors only.
// Added 2026-09-09. Rendered by page.tsx (hero/banner) and, later, ProductCard
// (per-product). Click is logged fire-and-forget to /api/shopee-click, isolated
// from the Amazon click path. Purely additive; if this fails, nothing else breaks.
'use client';

import { getSessionId } from './TrackingProvider';

type Variant = 'banner' | 'inline';

interface ShopeeCtaProps {
  shortLink: string;
  offerId?: string | null;
  pageSlug: string;
  variant?: Variant;
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

export default function ShopeeCta({ shortLink, offerId, pageSlug, variant = 'inline' }: ShopeeCtaProps) {
  const base =
    'inline-flex items-center justify-center gap-2 w-full bg-[#ee4d2d] hover:bg-[#d73211] text-white font-bold rounded-xl transition-all shadow-lg text-center';
  const size = variant === 'banner' ? 'py-3 px-6 mb-4' : 'py-2 px-6 mt-2 text-sm';
  return (
    <a
      href={shortLink}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => logShopeeClick(offerId, pageSlug)}
      className={`${base} ${size}`}
    >
      🛒 {variant === 'banner' ? 'Also on Shopee — fast local delivery' : 'Also on Shopee'}
    </a>
  );
}
