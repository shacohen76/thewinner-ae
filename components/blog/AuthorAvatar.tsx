'use client';

import { useState } from 'react';

interface AuthorAvatarProps {
  name: string;
  avatar?: string;
  /** Tailwind size + text classes, e.g. "w-10 h-10 text-sm" */
  sizeClass: string;
  /** Tailwind gradient classes for the initials fallback, e.g. "from-blue-500 to-indigo-600" */
  gradientClass: string;
}

/**
 * Renders an author's photo when one is available, otherwise falls back to a
 * gradient circle with the author's initials. The image is treated as
 * optional: if the file is missing or fails to load, we drop back to initials
 * so authors without a photo still render cleanly.
 */
export default function AuthorAvatar({
  name,
  avatar,
  sizeClass,
  gradientClass,
}: AuthorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('');

  const showPhoto = Boolean(avatar) && !failed;

  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0 bg-gradient-to-br ${gradientClass}`}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
