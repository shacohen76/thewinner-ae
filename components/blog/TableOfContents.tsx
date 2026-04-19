'use client';

import { useEffect, useState, useMemo } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  html: string;
}

export default function TableOfContents({ html }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  // Parse headings from HTML
  const headings = useMemo(() => {
    const items: TocItem[] = [];
    // Match h2 and h3 tags
    const regex = /<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      items.push({
        level: parseInt(match[1]),
        id: match[2],
        text: match[3].replace(/<[^>]*>/g, ''), // strip inner HTML
      });
    }

    // Fallback: if no IDs in headings, parse text-only h2s
    if (items.length === 0) {
      const simpleRegex = /<h2[^>]*>(.*?)<\/h2>/gi;
      let idx = 0;
      while ((match = simpleRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]*>/g, '');
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        items.push({ level: 2, id, text });
        idx++;
      }
    }

    return items;
  }, [html]);

  // Scroll spy
  useEffect(() => {
    if (headings.length === 0) return;

    // Add IDs to headings in the DOM if they don't have them
    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (!el) {
        // Try to find by text content
        const allHeadings = document.querySelectorAll('h2, h3');
        allHeadings.forEach((domH) => {
          const text = (domH.textContent || '').trim();
          if (text === h.text && !domH.id) {
            domH.id = h.id;
          }
        });
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="bg-white rounded-xl border border-gray-100 p-5">
      <h4 className="font-bold text-gray-800 text-sm mb-3">In This Article</h4>
      <ul className="space-y-1">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setActiveId(h.id);
                }
              }}
              className={`block text-xs py-1 transition-colors ${
                h.level === 3 ? 'pl-4' : ''
              } ${
                activeId === h.id
                  ? 'text-blue-600 font-medium'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
