// ============================================
// Footer.tsx — Site footer with Amazon disclosure
// Created: 2026-03-19
// Adapted from KSP: English, Amazon Associates disclosure
// ============================================

import Link from 'next/link';
import { CONFIG, getCurrentYear } from '@/lib/utils';

export default function Footer() {
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
            <p className="text-sm text-gray-400">
              The leading product comparison site for the UAE. We help you find the perfect product.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-white mb-4">Categories</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/category/appliances-main" className="hover:text-white transition-colors">
                  Home Appliances
                </Link>
              </li>
              <li>
                <Link href="/category/kitchen-main" className="hover:text-white transition-colors">
                  Kitchen & Coffee
                </Link>
              </li>
              <li>
                <Link href="/category/computers-main" className="hover:text-white transition-colors">
                  Computers & Phones
                </Link>
              </li>
              <li>
                <Link href="/category/entertainment-main" className="hover:text-white transition-colors">
                  TV & Audio
                </Link>
              </li>
              <li>
                <Link href="/category/care-main" className="hover:text-white transition-colors">
                  Beauty, Care & Family
                </Link>
              </li>
              <li>
                <Link href="/category/hobbies-main" className="hover:text-white transition-colors">
                  Hobbies & Leisure
                </Link>
              </li>
              <li>
                <Link href="/category/home-main" className="hover:text-white transition-colors">
                  Home & Garden
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular */}
          <div>
            <h4 className="font-bold text-white mb-4">Popular</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/best/portable-speakers" className="hover:text-white transition-colors">
                  Portable Speakers
                </Link>
              </li>
              <li>
                <Link href="/best/coffee-machines" className="hover:text-white transition-colors">
                  Coffee Machines
                </Link>
              </li>
              <li>
                <Link href="/best/washing-machines" className="hover:text-white transition-colors">
                  Washing Machines
                </Link>
              </li>
              <li>
                <Link href="/best/televisions" className="hover:text-white transition-colors">
                  Televisions
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4">Info</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider & Disclosure */}
        <div className="border-t border-gray-700 pt-8">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-2">
              Disclosure: We work with premium partners to ensure great results for our users.
              We may receive a commission separately and never on the behalf of our users.
              As an Amazon Associates we earn from qualifying purchases.
              Loyalty and trust above all, always.
            </p>
            <p className="text-xs text-gray-600 mt-4">
              © {getCurrentYear()} {CONFIG.siteName} — {CONFIG.siteTagline}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
