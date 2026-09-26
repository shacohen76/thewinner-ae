// ============================================
// /pt static-page metadata — BR 1 (2026-09-26)
// ============================================
// About / Contact / Privacy / Terms export English static metadata. On /pt they need a
// Portuguese <title>/description instead. Each page's generateMetadata calls this for
// locale 'pt' and returns its original (unchanged) English object otherwise.
// Strings: messages/pt.json → Meta.<key> / Meta.<key>Desc.
// ============================================

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function ptStaticMetadata(key: 'about' | 'contact' | 'privacy' | 'terms'): Promise<Metadata> {
  const t = await getTranslations({ locale: 'pt', namespace: 'Meta' });
  return {
    title: t(key),
    description: t(`${key}Desc`),
    alternates: { canonical: `/pt/${key}` },
    openGraph: { locale: 'pt_BR' },
  };
}
