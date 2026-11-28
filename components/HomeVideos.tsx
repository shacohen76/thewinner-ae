// ============================================
// HomeVideos.tsx — homepage "Watch & Learn" row.
// Server component → <a href> links are in the raw SSR HTML. Reads the static
// VIDEOS list (lib/videos); renders NOTHING while that list is empty, so it is a
// no-op until the VID 1 lane populates lib/videos.ts. Each link points at our own
// on-site video page (sitePath), never a bare youtube.com URL.
// ============================================

import { getVideosFor } from '@/lib/videos';

interface Props {
  title: string;
  sub: string;
  locale: string;
}

export default function HomeVideos({ title, sub, locale }: Props) {
  const vids = getVideosFor(locale);
  if (vids.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">{title}</h2>
          <p className="text-gray-500 text-lg">{sub}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vids.map((v) => (
            <a
              key={v.slug}
              href={v.sitePath}
              className="block group rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-white"
            >
              {v.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt={v.title} loading="lazy" className="w-full aspect-video object-cover" />
              ) : null}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{v.title}</h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
