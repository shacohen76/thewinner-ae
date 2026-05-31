'use client';
// ============================================
// Header.tsx — Site header with category navigation
// Created: 2026-03-19
// Adapted from KSP: English LTR, AMZ categories
// ============================================

import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { CONFIG } from '@/lib/utils';

// Main categories — 8 groups linking to /category/{slug}
const categories = [
  { name: 'Home Appliances', slug: 'appliances-main', icon: '🏠' },
  { name: 'Kitchen & Coffee', slug: 'kitchen-main', icon: '☕' },
  { name: 'Computers & Phones', slug: 'computers-main', icon: '💻' },
  { name: 'TV & Audio', slug: 'entertainment-main', icon: '📺' },
  { name: 'Beauty, Care & Family', slug: 'care-main', icon: '✨' },
  { name: 'Hobbies & Leisure', slug: 'hobbies-main', icon: '🎮' },
  { name: 'Home & Garden', slug: 'home-main', icon: '🏡' },
  { name: 'More', slug: 'other-main', icon: '📦' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl shadow-md">
              🏆
            </div>
            <div>
              <div className="font-bold text-gray-800 text-lg">{CONFIG.siteName}</div>
              <div className="text-xs text-gray-500">{CONFIG.siteTagline}</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {/* Categories Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Categories
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute top-full start-0 mt-2 w-56 bg-white rounded-xl shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span>{cat.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link href="/about" className="text-gray-600 hover:text-blue-600 transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-gray-600 hover:text-blue-600 transition-colors">
              Contact
            </Link>
		<Link href="/blog" className="text-gray-600 hover:text-blue-600 transition-colors">
		  Blog
		</Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t pt-4">
            <nav className="flex flex-col gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </Link>
              ))}
              <div className="border-t my-2" />
              <Link
                href="/about"
                className="px-4 py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="/contact"
                className="px-4 py-2 text-gray-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
		<Link
		  href="/blog"
		  className="px-4 py-2 text-gray-600"
		  onClick={() => setMobileMenuOpen(false)}
		>
		  Blog
		</Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
