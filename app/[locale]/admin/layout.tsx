// Admin layout — no header/footer, noindex
import type { Metadata } from 'next';
import { CONFIG } from '@/lib/utils';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: `Admin — ${new URL(CONFIG.siteUrl).hostname}`,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
