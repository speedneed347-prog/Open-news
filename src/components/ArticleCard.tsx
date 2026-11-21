import React from 'react';
import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { EditorialImage } from './EditorialImage';
import { CONTENT_TYPE_LABELS, FACT_CHECK_LABELS, type Article } from '../types/models';

export function formatShortDate(iso?: string): string {
  if (!iso) return 'Recent';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

interface ArticleCardProps {
  article: Article;
  variant?: 'lead' | 'feature' | 'compact';
}

export function ArticleCard({ article, variant = 'feature' }: ArticleCardProps) {
  const { navigate, categories, bookmarks, handleToggleBookmark } = useHub();
  const category = categories.find((c) => c.id === article.categoryId);
  const isSaved = bookmarks.some((b) => b.articleId === article.id);

  const openArticle = () => navigate(`/article/${article.slug}`);

  if (variant === 'compact') {
    return (
      <article className="py-3.5 border-b border-[#E5E2DC] dark:border-[#232A36] last:border-b-0 group">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#57534E] dark:text-[#9CA3AF]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
              {category?.name || article.categoryId}
            </span>
            <span aria-hidden="true">·</span>
            <span>{CONTENT_TYPE_LABELS[article.contentType]}</span>
            {article.isSampleData && (
              <>
                <span aria-hidden="true">·</span>
                <span className="italic">Sample</span>
              </>
            )}
          </div>
          <span className="font-mono tabular-nums shrink-0">{formatShortDate(article.publishedAt)}</span>
        </div>
        <button
          type="button"
          onClick={openArticle}
          className="mt-1.5 text-left block w-full cursor-pointer"
        >
          <h3 className="font-serif text-[16px] font-semibold leading-snug text-[#141413] dark:text-[#F3F4F6] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors">
            {article.title}
          </h3>
        </button>
        <div className="mt-1.5 flex items-center justify-between text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <span className="truncate">{article.originalSource}</span>
          <button
            type="button"
            onClick={() => void handleToggleBookmark(article)}
            aria-label={isSaved ? 'Remove bookmark' : 'Bookmark article'}
            className="p-1 hover:text-[#141413] dark:hover:text-white shrink-0 cursor-pointer"
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" /> : <Bookmark className="w-3.5 h-3.5" />}
          </button>
        </div>
      </article>
    );
  }

  if (variant === 'lead') {
    return (
      <article className="group flex flex-col h-full">
        <button type="button" onClick={openArticle} className="block w-full text-left cursor-pointer">
          <EditorialImage
            src={article.featuredImage}
            alt={article.title}
            aspectClass="aspect-[16/9]"
            priority
          />
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <button
            type="button"
            onClick={() => category && navigate(`/category/${category.slug}`)}
            className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
          >
            {category?.name || article.categoryId}
          </button>
          <span aria-hidden="true">·</span>
          <span>{CONTENT_TYPE_LABELS[article.contentType]}</span>
          <span aria-hidden="true">·</span>
          <span>{article.originalSource}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{formatShortDate(article.publishedAt)}</span>
          {article.factCheckStatus !== 'unverified' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[#14532D] dark:text-[#86EFAC]">
                {FACT_CHECK_LABELS[article.factCheckStatus]}
              </span>
            </>
          )}
          {article.isSampleData && (
            <>
              <span aria-hidden="true">·</span>
              <span className="italic text-[#78716C]">Sample Data</span>
            </>
          )}
        </div>

        <button type="button" onClick={openArticle} className="text-left mt-2.5 cursor-pointer">
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-[1.16] text-[#141413] dark:text-[#F3F4F6] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors">
            {article.title}
          </h1>
        </button>

        {article.subtitle && (
          <p className="mt-3 text-base leading-relaxed text-[#44403C] dark:text-[#CBD5E1]">
            {article.subtitle}
          </p>
        )}

        <p className="mt-2.5 text-sm leading-relaxed text-[#57534E] dark:text-[#9CA3AF] line-clamp-3">
          {article.summary}
        </p>

        <div className="mt-auto pt-5 flex items-center justify-between text-xs text-[#57534E] dark:text-[#9CA3AF] border-t border-[#F0EDE6] dark:border-[#1B2230]">
          <span>
            By <strong className="font-medium text-[#141413] dark:text-[#E5E7EB]">{article.authorName}</strong>
            {' · '}
            <span className="uppercase font-mono">{article.language}</span>
          </span>
          <div className="flex items-center gap-3">
            {article.originalSourceUrl && (
              <a
                href={article.originalSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#141413] dark:hover:text-white"
              >
                Source <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleToggleBookmark(article)}
              className="inline-flex items-center gap-1 hover:text-[#141413] dark:hover:text-white cursor-pointer"
            >
              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" /> : <Bookmark className="w-3.5 h-3.5" />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </article>
    );
  }

  // Feature variant
  return (
    <article className="group flex flex-col h-full">
      <button type="button" onClick={openArticle} className="block w-full text-left cursor-pointer">
        <EditorialImage
          src={article.featuredImage}
          alt={article.title}
          aspectClass="aspect-[4/3]"
        />
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#57534E] dark:text-[#9CA3AF]">
        <button
          type="button"
          onClick={() => category && navigate(`/category/${category.slug}`)}
          className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
        >
          {category?.name || article.categoryId}
        </button>
        <span aria-hidden="true">·</span>
        <span className="font-mono tabular-nums">{formatShortDate(article.publishedAt)}</span>
        {article.isSampleData && (
          <>
            <span aria-hidden="true">·</span>
            <span className="italic">Sample</span>
          </>
        )}
      </div>

      <button type="button" onClick={openArticle} className="text-left mt-1.5 cursor-pointer">
        <h3 className="font-serif text-xl font-semibold leading-snug text-[#141413] dark:text-[#F3F4F6] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors">
          {article.title}
        </h3>
      </button>

      <p className="mt-2 text-sm leading-relaxed text-[#57534E] dark:text-[#9CA3AF] line-clamp-2">
        {article.summary}
      </p>

      <div className="mt-auto pt-3 flex items-center justify-between text-xs text-[#57534E] dark:text-[#9CA3AF]">
        <span className="truncate max-w-[75%]">{article.originalSource}</span>
        <button
          type="button"
          onClick={() => void handleToggleBookmark(article)}
          aria-label={isSaved ? 'Remove bookmark' : 'Bookmark article'}
          className="p-1 hover:text-[#141413] dark:hover:text-white cursor-pointer"
        >
          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      </div>
    </article>
  );
}
