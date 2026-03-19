'use client';
// TrackingProvider.tsx — Created: 2026-03-19

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { initTracking } from '@/lib/utils';

export default function TrackingProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    initTracking();
  }, [searchParams]);

  return <>{children}</>;
}
