// ============================================
// BestAuthorByline.tsx — E-E-A-T byline for /best pages.
// Created 2026-09-05; updated 2026-09-05 to use the real reviewer PHOTOS in
// /public/team (the About-page team) instead of the blog authors, whose images
// live under a non-existent /blog/authors path. Roles come from the About.team.*
// messages so they localize (en/ar/ja). Server component → in the SSR HTML.
// Reviewer is chosen DETERMINISTICALLY by slug (stable, cache-safe).
// ============================================

import { getTranslations } from 'next-intl/server';
import AuthorAvatar from '@/components/blog/AuthorAvatar';

// Reviewers who have real photos in /public/team + a role in About.team.*.
const REVIEWERS = [
  { id: 'alex', name: 'Alex', avatar: '/team/alex.jpg', gradient: 'from-blue-500 to-blue-600' },
  { id: 'adham', name: 'Adham', avatar: '/team/adham.jpg', gradient: 'from-amber-500 to-amber-600' },
  { id: 'mariam', name: 'Mariam', avatar: '/team/mariam.jpg', gradient: 'from-purple-500 to-purple-600' },
  { id: 'fatima', name: 'Fatima', avatar: '/team/fatima.jpg', gradient: 'from-pink-500 to-pink-600' },
  { id: 'abdulla', name: 'Abdulla', avatar: '/team/abdulla.jpg', gradient: 'from-green-500 to-green-600' },
  { id: 'sara', name: 'Sara', avatar: '/team/sara.jpg', gradient: 'from-rose-500 to-red-600' },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface BestAuthorBylineProps {
  slug: string;
  locale: string;
  byLabel: string;
  updatedText: string;
}

export default async function BestAuthorByline({ slug, locale, byLabel, updatedText }: BestAuthorBylineProps) {
  const tAbout = await getTranslations({ locale, namespace: 'About' });
  const reviewer = REVIEWERS[hash(slug) % REVIEWERS.length];
  const role = tAbout(`team.${reviewer.id}.role`);

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
