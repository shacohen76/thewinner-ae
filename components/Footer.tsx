// ============================================
// Footer.tsx — Site footer with Amazon disclosure
// Created: 2026-03-19
// Last Modified: 2026-05-21 (GEOS1 — geo-aware tagline via FooterTagline)
// Adapted from KSP: English, Amazon Associates disclosure
//
// Tagline country name is swapped client-side by <FooterTagline /> so the
// cached layout HTML stays geo-agnostic. See FooterTagline.tsx.
// ============================================

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { CONFIG, getCurrentYear } from '@/lib/utils';
import FooterTagline from '@/components/FooterTagline';
import CookieSettingsLink from '@/components/CookieSettingsLink';

export default function Footer() {
  const t = useTranslations('Footer');
  const tc = useTranslations('Categories');
  return (
    <footer className="bg-gray-800 text-gray-300">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl">
                🏆
              </div>
              <div className="font-bold text-white text-lg">{CONFIG.siteName}</div>
            </div>
            <FooterTagline />
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-white mb-4">{t('categories')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/category/appliances-main" className="hover:text-white transition-colors">
                  {tc('appliances-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/kitchen-main" className="hover:text-white transition-colors">
                  {tc('kitchen-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/computers-main" className="hover:text-white transition-colors">
                  {tc('computers-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/entertainment-main" className="hover:text-white transition-colors">
                  {tc('entertainment-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/care-main" className="hover:text-white transition-colors">
                  {tc('care-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/hobbies-main" className="hover:text-white transition-colors">
                  {tc('hobbies-main')}
                </Link>
              </li>
              <li>
                <Link href="/category/home-main" className="hover:text-white transition-colors">
                  {tc('home-main')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular */}
          <div>
            <h4 className="font-bold text-white mb-4">{t('popular')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/best/portable-speakers" className="hover:text-white transition-colors">
                  {t('popularItems.portable-speakers')}
                </Link>
              </li>
              <li>
                <Link href="/best/coffee-machines" className="hover:text-white transition-colors">
                  {t('popularItems.coffee-machines')}
                </Link>
              </li>
              <li>
                <Link href="/best/washing-machines" className="hover:text-white transition-colors">
                  {t('popularItems.washing-machines')}
                </Link>
              </li>
              <li>
                <Link href="/best/televisions" className="hover:text-white transition-colors">
                  {t('popularItems.televisions')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4">{t('info')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t('about')}
                </Link>
              </li>
		<li>
		  <Link href="/blog" className="hover:text-white transition-colors">
		    {t('blog')}
		  </Link>
		</li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {t('contact')}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {t('terms')}
                </Link>
              </li>
              <li>
                <CookieSettingsLink />
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Disclosure */}
        <div className="border-t border-gray-700 pt-8">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-2">
              {t('disclosure')}
            </p>
            <p className="text-xs text-gray-600 mt-4">
              {t('copyright', {
                year: getCurrentYear(),
                siteName: CONFIG.siteName,
                tagline: CONFIG.siteTagline,
              })}
            </p>
            <p className="text-xs text-gray-600 mt-2">
              {t('trademark')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
