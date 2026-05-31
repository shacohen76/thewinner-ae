import type { BlogAuthor } from '@/lib/blog';
import AuthorAvatar from '@/components/blog/AuthorAvatar';

const AUTHOR_GRADIENTS: Record<string, string> = {
  'sarah-al-rashid': 'from-rose-500 to-red-600',
  'omar-hassan': 'from-blue-500 to-blue-600',
  'lina-mikhail': 'from-pink-500 to-pink-600',
  'youssef-nabil': 'from-green-500 to-green-600',
  'dina-karam': 'from-amber-500 to-amber-600',
  'tariq-sayed': 'from-purple-500 to-purple-600',
  'peter-gods': 'from-slate-600 to-zinc-800',
};

const AUTHOR_BG: Record<string, string> = {
  'sarah-al-rashid': 'bg-rose-50',
  'omar-hassan': 'bg-blue-50',
  'lina-mikhail': 'bg-pink-50',
  'youssef-nabil': 'bg-green-50',
  'dina-karam': 'bg-amber-50',
  'tariq-sayed': 'bg-purple-50',
  'peter-gods': 'bg-slate-50',
};

interface AuthorBioProps {
  author: BlogAuthor;
}

export default function AuthorBio({ author }: AuthorBioProps) {
  const gradient = AUTHOR_GRADIENTS[author.id] || 'from-gray-500 to-gray-600';
  const bg = AUTHOR_BG[author.id] || 'bg-gray-50';

  return (
    <div className={`mt-10 rounded-xl ${bg} p-6`}>
      <div className="flex items-start gap-4">
        <AuthorAvatar
          name={author.name}
          avatar={author.avatar}
          sizeClass="w-14 h-14 text-lg"
          gradientClass={gradient}
        />
        <div>
          <div className="font-bold text-gray-800">{author.name}</div>
          <div className="text-sm text-gray-500 mb-2">{author.role}</div>
          <p className="text-sm text-gray-600 leading-relaxed">{author.bio}</p>
        </div>
      </div>
    </div>
  );
}
