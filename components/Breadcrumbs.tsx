// ============================================
// Breadcrumbs.tsx — Navigation breadcrumbs
// Created: 2026-03-19
// Adapted from KSP: English LTR (arrow direction normal, no rotate)
// ============================================

import { Link } from '@/i18n/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <div className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>

          {items.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {item.href ? (
                <Link href={item.href} className="hover:text-blue-600 transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-gray-800 font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>
    </div>
  );
}
