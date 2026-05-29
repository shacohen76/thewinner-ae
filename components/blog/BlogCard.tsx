import Link from 'next/link';
import type { BlogPostMeta } from '@/lib/blog';
import AuthorAvatar from '@/components/blog/AuthorAvatar';

const AUTHOR_COLORS: Record<string, string> = {
  'sarah-al-rashid': 'from-rose-500 to-red-600',
  'omar-hassan': 'from-blue-500 to-blue-600',
  'lina-mikhail': 'from-pink-500 to-pink-600',
  'youssef-nabil': 'from-green-500 to-green-600',
  'dina-karam': 'from-amber-500 to-amber-600',
  'tariq-sayed': 'from-purple-500 to-purple-600',
  'peter-gods': 'from-slate-600 to-zinc-800',
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-amber-100 text-amber-700',
};

const TIER_LABELS: Record<number, string> = {
  1: 'Guide',
  2: 'Deep Dive',
  3: 'Lifestyle',
  4: 'Entertainment',
};

interface BlogCardProps {
  post: BlogPostMeta;
  compact?: boolean;
}

export default function BlogCard({ post, compact = false }: BlogCardProps) {
  const authorGradient = AUTHOR_COLORS[post.author_id] || 'from-gray-500 to-gray-600';

  if (compact) {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all group"
      >
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[post.tier]}`}>
          {TIER_LABELS[post.tier]}
        </span>
        <h3 className="font-bold text-gray-800 text-sm mt-2 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2">
          {post.title}
        </h3>
        <p className="text-xs text-gray-400">
          {post.read_time} min read
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden group flex flex-col"
    >
      {/* Color bar top */}
      <div className={`h-1.5 bg-gradient-to-r ${authorGradient}`} />

      <div className="p-5 flex flex-col flex-grow">
        {/* Tier + read time */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${TIER_COLORS[post.tier]}`}
          >
            {TIER_LABELS[post.tier]}
          </span>
          <span className="text-xs text-gray-400">{post.read_time} min</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 text-[15px] leading-snug">
          {post.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-grow">
          {post.description}
        </p>

        {/* Author row */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <AuthorAvatar
            name={post.author.name}
            avatar={post.author.avatar}
            sizeClass="w-7 h-7 text-[10px]"
            gradientClass={authorGradient}
          />
          <div>
            <div className="text-xs font-medium text-gray-700">{post.author.name}</div>
            <div className="text-[10px] text-gray-400">{post.publish_date}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
