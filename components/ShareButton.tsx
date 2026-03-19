/**
 * ShareButton.tsx — Share page link with one click
 * Created: 2026-03-19
 * Adapted from KSP: English text, LTR arrow direction
 */

'use client';

import { useState, useEffect } from 'react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [glowActive, setGlowActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setGlowActive(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
        setShowTooltip(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('utm_source', 'share');
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setShowTooltip(true);
    } catch (err) {
      const url = new URL(window.location.href);
      url.searchParams.set('utm_source', 'share');
      const textArea = document.createElement('textarea');
      textArea.value = url.toString();
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setShowTooltip(true);
    }
  };

  return (
    <div className="relative">
      <button
        id="share-button-copy-link"
        data-ga-action="click"
        data-ga-category="share"
        data-ga-label="copy-link"
        onClick={handleCopy}
        onMouseEnter={() => !copied && setShowTooltip(true)}
        onMouseLeave={() => !copied && setShowTooltip(false)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-white shadow-sm border border-green-200
          hover:bg-green-50 hover:border-green-300
          transition-all duration-200
          ${glowActive ? 'animate-glow' : ''}
        `}
        aria-label="Share this page"
      >
        {/* Share Arrow SVG — pointing right for LTR */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          className="text-green-500"
        >
          <defs>
            <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d="M17 8L21 12L17 16"
            stroke="url(#arrowGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12H10C6.68629 12 4 9.31371 4 6V4"
            stroke="url(#arrowGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className="text-sm text-gray-600 font-medium">Share</span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={`
            absolute top-full mt-2 left-0 z-50
            px-4 py-3 rounded-lg shadow-lg
            text-sm whitespace-nowrap
            ${copied
              ? 'bg-green-600 text-white max-w-xs whitespace-normal'
              : 'bg-gray-800 text-white'
            }
          `}
          role="tooltip"
        >
          {copied
            ? <>✓ Link copied!<br />Now paste in WhatsApp and share with friends & family</>
            : 'Share this page'
          }
          <div
            className={`
              absolute -top-2 left-4
              border-8 border-transparent
              ${copied ? 'border-b-green-600' : 'border-b-gray-800'}
            `}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(34, 197, 94, 0.4);
          }
          50% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 30px rgba(132, 204, 22, 0.3);
          }
        }

        .animate-glow {
          animation: glow 1s ease-in-out 2;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
