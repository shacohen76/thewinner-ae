// ============================================
// i18n navigation helpers — INTL1 Phase 1
// ============================================
// Created: 2026-05-30 (INTL1 Phase 1 — locale routing scaffolding)
//
// Locale-aware wrappers around Next's navigation primitives. Using THESE
// (instead of next/link / next/navigation) keeps the active locale on links
// and programmatic navigations automatically — e.g. <Link href="/best/x">
// renders /best/x for en and /ar/best/x for ar, with no per-call locale
// plumbing. We migrate components to these in Phase 2; exported now so the
// API is ready and the routing config has a single consumer surface.
// ============================================

import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
