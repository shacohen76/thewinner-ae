// ============================================
// BestAuthorByline.tsx — E-E-A-T byline for /best pages.
// Created 2026-09-05. Uses the real reviewer PHOTOS in /public/team. The DISPLAY
// name is chosen deterministically by slug (stable, cache-safe). Role is a single
// generic "Product Reviewer" (passed in) — the About page keeps the per-person
// niche roles, but on a random product page a niche role (e.g. "Audio Expert" on
// a perfume page) reads as a mismatch, so the byline stays generic. Server
// component → rendered into the SSR HTML.
// ============================================

import AuthorAvatar from '@/components/blog/AuthorAvatar';

// Reviewers with real photos in /public/team. `id` = the photo filename (kept
// stable); `name` is the display name (renamed 2026-09-05 per owner).
const REVIEWERS = [
  { id: 'alex', name: 'Alex', avatar: '/team/alex.jpg', gradient: 'from-blue-500 to-blue-600' },
  { id: 'adham', name: 'Adam', avatar: '/team/adham.jpg', gradient: 'from-amber-500 to-amber-600' },
  { id: 'mariam', name: 'Mariam', avatar: '/team/mariam.jpg', gradient: 'from-purple-500 to-purple-600' },
  { id: 'fatima', name: 'Noon', avatar: '/team/fatima.jpg', gradient: 'from-pink-500 to-pink-600' },
  { id: 'abdulla', name: 'Jean', avatar: '/team/abdulla.jpg', gradient: 'from-green-500 to-green-600' },
  { id: 'sara', name: 'Sara', avatar: '/team/sara.jpg', gradient: 'from-rose-500 to-red-600' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface BestAuthorBylineProps {
  slug: string;
  byLabel: string;
  role: string;
  updatedText: string;
}

export default function BestAuthorByline({ slug, byLabel, role, updatedText }: BestAuthorBylineProps) {
  const reviewer = REVIEWERS[hash(slug) % REVIEWERS.length];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6">
      <div className="flex items-center gap-3">
        <AuthorAvatar
          name={reviewer.name}
          avatar={reviewer.avatar}
          sizeClass="w-10 h-10 text-sm"
          gradientClass={reviewer.gradient}
        />
        <div className="text-sm text-gray-600 leading-tight">
          <div>
            {byLabel}{' '}
            <span className="font-semibold text-gray-800">{reviewer.name}</span>
            <span className="text-gray-500"> · {role}</span>
          </div>
          <div className="text-gray-400">{updatedText}</div>
        </div>
      </div>
    </div>
  );
}
