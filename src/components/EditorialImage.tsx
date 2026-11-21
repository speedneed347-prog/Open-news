import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface EditorialImageProps {
  src?: string;
  alt: string;
  aspectClass?: string;
  className?: string;
  caption?: string;
  priority?: boolean;
}

export function EditorialImage({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
  className = '',
  caption,
  priority = false,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);
  const validSrc = src && !failed && (src.startsWith('/') || src.startsWith('https://') || src.startsWith('http://'));

  return (
    <figure className={`w-full overflow-hidden ${className}`}>
      <div
        className={`relative w-full ${aspectClass} overflow-hidden bg-[#EBE6DF] dark:bg-[#1B2230] border border-[#E5E2DC] dark:border-[#232A36]`}
      >
        {validSrc ? (
          <img
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#F3EFE8] to-[#E5DFD5] dark:from-[#161C27] dark:to-[#1E2636]">
            <BookOpen className="w-7 h-7 text-[#78716C] dark:text-[#64748B] mb-2" strokeWidth={1.5} />
            <span className="font-serif text-sm text-[#44403C] dark:text-[#CBD5E1] line-clamp-2 max-w-[26ch]">
              {alt}
            </span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs font-serif italic text-[#57534E] dark:text-[#9CA3AF]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
