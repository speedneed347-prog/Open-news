import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  FileText,
  Globe,
  MessageSquare,
  Scale,
  Send,
  Sparkles,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { EditorialImage } from '../components/EditorialImage';
import { RichContentRenderer } from '../components/RichContentRenderer';
import { ArticleCard, formatShortDate } from '../components/ArticleCard';
import { apiClient, type AIAnalysisResponse, type AIQAResponse, type AITranslationResponse } from '../lib/apiClient';
import {
  addArticleComment,
  fetchArticleComments,
  recordReadingProgress,
  updateReadingListArticles,
} from '../lib/firestoreService';
import { updatePageSEO } from '../lib/seo';
import { CONTENT_TYPE_LABELS, FACT_CHECK_LABELS, type CommentRecord } from '../types/models';

export function ArticleDetailPage({ slug }: { slug: string }) {
  const {
    navigate,
    publishedArticles,
    allStaffArticles,
    categories,
    factChecks,
    user,
    isStaff,
    bookmarks,
    readingLists,
    handleToggleBookmark,
    refreshUserData,
    setAuthModalOpen,
    showToast,
  } = useHub();

  const article = useMemo(() => {
    const pool = isStaff ? [...publishedArticles, ...allStaffArticles] : publishedArticles;
    return pool.find((a) => a.slug === slug || a.id === slug);
  }, [allStaffArticles, isStaff, publishedArticles, slug]);

  const [readProgress, setReadProgress] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const [translation, setTranslation] = useState<AITranslationResponse | null>(null);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(true);

  const [qaQuestion, setQaQuestion] = useState('');
  const [qaResponse, setQaResponse] = useState<AIQAResponse | null>(null);
  const [loadingQa, setLoadingQa] = useState(false);
  const [aiError, setAiError] = useState('');

  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    setAiAnalysis(null);
    setTranslation(null);
    setShowingOriginal(true);
    setQaResponse(null);
    setAiError('');
  }, [slug]);

  useEffect(() => {
    if (!article) return;
    updatePageSEO({
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.summary,
      path: `/article/${article.slug}`,
      article,
    });
    void fetchArticleComments(article.id).then(setComments);
  }, [article]);

  // Reading depth progress tracker + persisted reading history
  useEffect(() => {
    if (!article) return;
    let lastSaved = 0;
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollTop / docHeight) * 100))) : 100;
      setReadProgress(pct);
      if (user && Math.abs(pct - lastSaved) >= 20) {
        lastSaved = pct;
        void recordReadingProgress(user.uid, article, pct);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    if (user) {
      void recordReadingProgress(user.uid, article, 15);
    }
    return () => window.removeEventListener('scroll', onScroll);
  }, [article, user]);

  if (!article) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
          Article Not Found
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3">
          This publication may have been archived or moved. Browse our latest editions or search the archive.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 px-5 py-2.5 text-sm font-medium bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
        >
          Return to Front Page
        </button>
      </main>
    );
  }

  const category = categories.find((c) => c.id === article.categoryId);
  const subcategory = categories.find((c) => c.id === article.subcategoryId);
  const isSaved = bookmarks.some((b) => b.articleId === article.id);
  const linkedFactChecks = factChecks.filter((fc) => fc.articleId === article.id);

  const relatedArticles = publishedArticles
    .filter(
      (a) =>
        a.id !== article.id &&
        (a.categoryId === article.categoryId ||
          (a.topics || []).some((tp) => (article.topics || []).includes(tp)))
    )
    .slice(0, 3);

  const displayTitle = !showingOriginal && translation ? translation.title : article.title;
  const displaySubtitle = !showingOriginal && translation ? translation.subtitle : article.subtitle;
  const displaySummary = !showingOriginal && translation ? translation.summary : article.summary;
  const displayContent = !showingOriginal && translation ? translation.content : article.content;

  const handleRunAIAnalysis = async () => {
    setAiError('');
    setLoadingAnalysis(true);
    try {
      const res = await apiClient.analyzeArticle({
        title: article.title,
        content: article.content,
        originalSource: article.originalSource,
        availableCategories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
      });
      setAiAnalysis(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleTranslate = async (targetLanguage: string) => {
    if (targetLanguage === article.language) {
      setShowingOriginal(true);
      return;
    }
    setAiError('');
    setLoadingTranslate(true);
    try {
      const res = await apiClient.translateArticle({
        title: article.title,
        subtitle: article.subtitle,
        summary: article.summary,
        content: article.content,
        sourceLanguage: article.language,
        targetLanguage,
      });
      setTranslation(res);
      setShowingOriginal(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoadingTranslate(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaQuestion.trim()) return;
    setAiError('');
    setLoadingQa(true);
    try {
      const corpus = [article, ...relatedArticles].map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        originalSource: a.originalSource,
        originalSourceUrl: a.originalSourceUrl,
        publishedAt: a.publishedAt,
        summary: a.summary,
        content: a.content,
      }));
      const res = await apiClient.askGroundedQuestion({
        question: qaQuestion.trim(),
        articles: corpus,
      });
      setQaResponse(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Question answering failed.');
    } finally {
      setLoadingQa(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (commentText.trim().length < 2) return;
    setSubmittingComment(true);
    try {
      await addArticleComment(article.id, commentText);
      setCommentText('');
      const updated = await fetchArticleComments(article.id);
      setComments(updated);
      showToast('Comment published.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to post comment.', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddToReadingList = async (listId: string) => {
    if (!user) return;
    const list = readingLists.find((l) => l.id === listId);
    if (!list) return;
    if (list.articleIds.includes(article.id)) {
      showToast(`Already in "${list.name}".`, 'info');
      return;
    }
    await updateReadingListArticles(user.uid, list.id, [...list.articleIds, article.id]);
    await refreshUserData();
    showToast(`Added to reading list "${list.name}".`, 'success');
  };

  return (
    <>
      {/* Subtle Top Reading Progress Hairline */}
      <div className="fixed top-14 left-0 right-0 h-[2px] z-30 bg-transparent pointer-events-none">
        <div
          className="h-full bg-[#1E3A8A] dark:bg-[#60A5FA] transition-[width] duration-150"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC] dark:border-[#232A36] text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 hover:text-[#141413] dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Front Page
            </button>
            <span>/</span>
            {category && (
              <button
                type="button"
                onClick={() => navigate(`/category/${category.slug}`)}
                className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                {category.name}
              </button>
            )}
            {subcategory && (
              <>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => navigate(`/category/${subcategory.slug}`)}
                  className="hover:underline cursor-pointer"
                >
                  {subcategory.name}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void handleToggleBookmark(article)}
              className="inline-flex items-center gap-1.5 font-medium text-[#141413] dark:text-[#F3F4F6] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer"
            >
              {isSaved ? <BookmarkCheck className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" /> : <Bookmark className="w-4 h-4" />}
              {isSaved ? 'Bookmarked' : 'Bookmark'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/compare?focus=${encodeURIComponent(article.id)}`)}
              className="inline-flex items-center gap-1.5 hover:text-[#141413] dark:hover:text-white cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" /> Compare Sources
            </button>
          </div>
        </div>

        {/* Asymmetric Editorial Reading Canvas (70% Main / 30% Margin Rail) */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <article className="lg:col-span-8">
            {/* Metadata Kicker */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              <span className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                {CONTENT_TYPE_LABELS[article.contentType]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{article.country}</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase font-mono">{article.language}</span>
              <span aria-hidden="true">·</span>
              <span>Fact-Check: {FACT_CHECK_LABELS[article.factCheckStatus]}</span>
              {article.isSampleData && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="italic font-medium text-[#78350F] dark:text-[#FCD34D]">
                    Sample Editorial Data
                  </span>
                </>
              )}
            </div>

            {/* Translation Banner when Viewing Translated Edition */}
            {!showingOriginal && translation && (
              <div className="mt-4 p-3.5 border border-[#E5E2DC] dark:border-[#232A36] bg-[#F4F1EA] dark:bg-[#171D28] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#141413] dark:text-[#E5E7EB]">
                  {translation.translationNotice}
                </span>
                <button
                  type="button"
                  onClick={() => setShowingOriginal(true)}
                  className="font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                >
                  View Original ({article.language.toUpperCase()})
                </button>
              </div>
            )}

            <h1 className="font-serif text-3xl sm:text-5xl font-semibold leading-[1.15] text-[#141413] dark:text-[#F3F4F6] mt-4">
              {displayTitle}
            </h1>

            {displaySubtitle && (
              <p className="mt-4 text-lg leading-relaxed text-[#44403C] dark:text-[#CBD5E1]">
                {displaySubtitle}
              </p>
            )}

            {/* Byline & Timestamps */}
            <div className="mt-6 py-4 border-y border-[#E5E2DC] dark:border-[#232A36] flex flex-wrap items-center justify-between gap-4 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              <div>
                By{' '}
                <strong className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
                  {article.authorName}
                </strong>{' '}
                for <span>{article.originalSource}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                <span>Published: {formatShortDate(article.publishedAt)}</span>
                {article.collectedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Indexed: {formatShortDate(article.collectedAt)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Language Translation Bar */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Globe className="w-3.5 h-3.5 text-[#57534E] dark:text-[#9CA3AF]" />
              <span className="text-[#57534E] dark:text-[#9CA3AF]">Read in:</span>
              {[
                { code: article.language, label: `Original (${article.language.toUpperCase()})` },
                { code: 'en', label: 'English' },
                { code: 'bn', label: 'বাংলা (Bengali)' },
                { code: 'hi', label: 'हिन्दी (Hindi)' },
              ]
                .filter((opt, idx, arr) => arr.findIndex((o) => o.code === opt.code) === idx)
                .map((opt) => {
                  const isActive =
                    (showingOriginal && opt.code === article.language) ||
                    (!showingOriginal && translation?.targetLanguage === opt.code);
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      disabled={loadingTranslate}
                      onClick={() => void handleTranslate(opt.code)}
                      className={`px-2.5 py-1 border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F3F4F6] dark:text-[#141413] dark:border-[#F3F4F6] font-medium'
                          : 'border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              {loadingTranslate && (
                <span className="text-[#1E3A8A] dark:text-[#60A5FA] ml-2">Translating...</span>
              )}
            </div>

            {/* Featured Editorial Image */}
            {article.featuredImage && (
              <EditorialImage
                src={article.featuredImage}
                alt={displayTitle}
                aspectClass="aspect-[16/9]"
                className="mt-7"
                caption={`Editorial Plate — ${article.originalSource} (${formatShortDate(article.publishedAt)})`}
                priority
              />
            )}

            {/* Editorial Summary Deck */}
            <div className="mt-8 p-5 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
              <p className="text-[11px] uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF] font-semibold">
                Executive Summary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#292524] dark:text-[#E5E7EB]">
                {displaySummary}
              </p>
            </div>

            {/* Main Structured Body Prose */}
            <div className="mt-6">
              <RichContentRenderer content={displayContent} enableDropCap={article.language === 'en'} />
            </div>

            {/* Attachments (PDFs, Datasets, Videos) */}
            {article.attachments && article.attachments.length > 0 && (
              <div className="mt-10 pt-6 border-t border-[#E5E2DC] dark:border-[#232A36]">
                <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6]">
                  Attached Documents & Datasets
                </h3>
                <ul className="mt-3 divide-y divide-[#E5E2DC] dark:divide-[#232A36] border border-[#E5E2DC] dark:border-[#232A36]">
                  {article.attachments.map((att) => (
                    <li
                      key={att.id}
                      className="px-4 py-3 flex items-center justify-between gap-4 bg-white dark:bg-[#141922] text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA] shrink-0" />
                        <span className="text-[#141413] dark:text-[#F3F4F6]">{att.label}</span>
                        {att.sizeLabel && (
                          <span className="text-xs font-mono text-[#78716C]">{att.sizeLabel}</span>
                        )}
                      </div>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        Open {att.type.toUpperCase()} <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics & Keywords Index */}
            <div className="mt-8 pt-6 border-t border-[#E5E2DC] dark:border-[#232A36] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              <span className="font-semibold text-[#141413] dark:text-[#F3F4F6]">Indexed Topics:</span>
              {(article.topics || []).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => navigate(`/topic/${encodeURIComponent(topic)}`)}
                  className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                >
                  {topic}
                </button>
              ))}
              {(article.tags || []).length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Keywords: {(article.tags || []).join(', ')}</span>
                </>
              )}
            </div>

            {/* Reader Comments Section */}
            <section className="mt-12 pt-8 border-t border-[#E5E2DC] dark:border-[#232A36]">
              <h3 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Reader Discussion ({comments.length})
              </h3>
              <form onSubmit={handlePostComment} className="mt-4 space-y-3">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    user
                      ? 'Contribute an evidence-based comment or observation...'
                      : 'Sign in to contribute to reader discussion...'
                  }
                  className="w-full p-3 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="px-4 py-2 text-xs font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] hover:opacity-90 cursor-pointer"
                >
                  {user ? (submittingComment ? 'Posting...' : 'Post Comment') : 'Sign In to Comment'}
                </button>
              </form>

              <div className="mt-6 divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                {comments.map((c) => (
                  <div key={c.id} className="py-4">
                    <p className="text-xs font-semibold text-[#141413] dark:text-[#F3F4F6]">
                      {c.authorName}
                    </p>
                    <p className="text-sm text-[#292524] dark:text-[#D1D5DB] mt-1 leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="py-4 text-xs text-[#57534E] dark:text-[#9CA3AF]">
                    No reader comments yet.
                  </p>
                )}
              </div>
            </section>
          </article>

          {/* RIGHT MARGIN RAIL (30%): Source Transparency, Fact Check, AI Intelligence */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Source Provenance Card */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
                Source Provenance & Rights
              </p>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div className="flex justify-between gap-2 pb-2 border-b border-[#F0EDE6] dark:border-[#1B2230]">
                  <dt className="text-[#57534E] dark:text-[#9CA3AF]">Publisher</dt>
                  <dd className="font-medium text-[#141413] dark:text-[#F3F4F6] text-right">
                    {article.originalSource}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 pb-2 border-b border-[#F0EDE6] dark:border-[#1B2230]">
                  <dt className="text-[#57534E] dark:text-[#9CA3AF]">Collection Method</dt>
                  <dd className="font-mono text-[#141413] dark:text-[#F3F4F6]">
                    {article.collectionMethod}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 pb-2 border-b border-[#F0EDE6] dark:border-[#1B2230]">
                  <dt className="text-[#57534E] dark:text-[#9CA3AF]">Permission Status</dt>
                  <dd className="font-mono text-[#141413] dark:text-[#F3F4F6]">
                    {article.copyrightPermissionStatus}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#57534E] dark:text-[#9CA3AF]">Verification</dt>
                  <dd className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
                    {FACT_CHECK_LABELS[article.factCheckStatus]}
                  </dd>
                </div>
              </dl>
              {article.originalSourceUrl && (
                <a
                  href={article.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold border border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6] hover:bg-[#141413] hover:text-white dark:hover:bg-[#F3F4F6] dark:hover:text-[#141413] transition-colors"
                >
                  Visit Original Source <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {user && readingLists.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E5E2DC] dark:border-[#232A36]">
                  <label className="block text-[11px] font-medium text-[#57534E] dark:text-[#9CA3AF] mb-1.5">
                    Add to Personal Reading List
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) void handleAddToReadingList(e.target.value);
                      e.target.value = '';
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    <option value="">Choose a reading list...</option>
                    {readingLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.articleIds.length})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Linked Fact-Check Panel */}
            {linkedFactChecks.length > 0 && (
              <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#14532D] dark:text-[#86EFAC]">
                  Linked Fact-Check Record
                </p>
                {linkedFactChecks.map((fc) => (
                  <div key={fc.id} className="mt-3 text-xs space-y-2">
                    <p className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
                      Status: {FACT_CHECK_LABELS[fc.status]}
                    </p>
                    <p className="text-[#44403C] dark:text-[#D1D5DB]">“{fc.claim}”</p>
                    <p className="text-[#57534E] dark:text-[#9CA3AF] leading-relaxed">{fc.explanation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* AI Editorial Intelligence Panel */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Intelligence Engine
                </p>
              </div>

              <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] leading-relaxed">
                Generate source-grounded summaries, key index terms, or ask factual questions strictly
                from indexed records. AI outputs are labeled and never replace human verification.
              </p>

              <button
                type="button"
                onClick={() => void handleRunAIAnalysis()}
                disabled={loadingAnalysis}
                className="w-full py-2 px-3 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {loadingAnalysis ? 'Analyzing with Open-Source AI...' : 'Generate AI Brief & Keywords'}
              </button>

              {aiAnalysis && (
                <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#232A36] space-y-3 text-xs">
                  <p className="text-[11px] italic text-[#78716C]">
                    {aiAnalysis.aiLabel} · Engine: {aiAnalysis.provider}
                  </p>
                  <p className="text-[#141413] dark:text-[#E5E7EB] leading-relaxed">
                    {aiAnalysis.summary}
                  </p>
                  {aiAnalysis.shortBrief.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 text-[#44403C] dark:text-[#CBD5E1]">
                      {aiAnalysis.shortBrief.map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[#57534E] dark:text-[#9CA3AF]">
                    <strong>Keywords:</strong> {aiAnalysis.keywords.join(', ')}
                  </p>
                </div>
              )}

              {/* Grounded Article Q&A */}
              <div className="pt-4 border-t border-[#E5E2DC] dark:border-[#232A36]">
                <p className="text-xs font-semibold text-[#141413] dark:text-[#F3F4F6] mb-2">
                  Ask About This Report
                </p>
                <form onSubmit={handleAskQuestion} className="flex gap-2">
                  <input
                    type="text"
                    value={qaQuestion}
                    onChange={(e) => setQaQuestion(e.target.value)}
                    placeholder="Ask a factual question..."
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
                  />
                  <button
                    type="submit"
                    disabled={loadingQa}
                    aria-label="Submit question"
                    className="px-3 py-1.5 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] text-xs font-medium cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                {loadingQa && (
                  <p className="text-xs text-[#1E3A8A] dark:text-[#60A5FA] mt-2">
                    Checking indexed sources...
                  </p>
                )}

                {qaResponse && (
                  <div className="mt-3 p-3 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-xs space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-[#78716C]">
                      {qaResponse.aiLabel}
                    </p>
                    <p className="text-[#141413] dark:text-[#E5E7EB] leading-relaxed">
                      {qaResponse.answer}
                    </p>
                    {qaResponse.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#E5E2DC] dark:border-[#232A36] space-y-1">
                        <p className="font-semibold text-[#57534E] dark:text-[#9CA3AF]">
                          Supporting Citations:
                        </p>
                        {qaResponse.citations.map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => navigate(`/article/${c.slug}`)}
                            className="block text-left text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            [{idx + 1}] {c.title} ({c.source})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {aiError && (
                <p className="text-xs text-[#B91C1C] dark:text-[#FCA5A5]">{aiError}</p>
              )}
            </div>
          </aside>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="mt-14 pt-8 border-t border-[#141413] dark:border-[#F3F4F6]">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mb-6">
              Related Reports & Cross-Category Context
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((art) => (
                <ArticleCard key={art.id} article={art} variant="feature" />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
