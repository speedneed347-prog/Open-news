import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Database } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ArticleCard } from '../components/ArticleCard';
import { t } from '../lib/i18n';
import { updatePageSEO } from '../lib/seo';

export function HomePage() {
  const {
    navigate,
    uiLang,
    contentLangFilter,
    publishedArticles,
    categories,
    factChecks,
    timelines,
    userProfile,
    isAdmin,
    usingSampleFallback,
    seedInitialDatabase,
  } = useHub();

  const [selectedHighlightCat, setSelectedHighlightCat] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    updatePageSEO({
      title: 'ALL INFORMATION HUB — All Information. One Intelligent Platform.',
      description:
        'Global digital news portal, multi-source RSS/API aggregator, research library, transparent fact-check center, and AI-powered knowledge discovery platform.',
      path: '/',
    });
  }, []);

  const filteredArticles = useMemo(() => {
    if (contentLangFilter === 'all') return publishedArticles;
    return publishedArticles.filter((a) => a.language === contentLangFilter);
  }, [contentLangFilter, publishedArticles]);

  const leadArticle = filteredArticles.find((a) => a.isFeatured) || filteredArticles[0];
  const secondaryFeatures = filteredArticles
    .filter((a) => a.id !== leadArticle?.id && a.isFeatured)
    .slice(0, 2);
  const latestWire = filteredArticles
    .filter((a) => a.id !== leadArticle?.id)
    .slice(0, 6);

  const researchItems = filteredArticles
    .filter((a) => ['research', 'scientific_discovery', 'educational_note'].includes(a.contentType))
    .slice(0, 4);

  const governmentItems = filteredArticles
    .filter((a) =>
      ['government_notification', 'historical_document', 'report', 'statistical_info'].includes(
        a.contentType
      )
    )
    .slice(0, 4);

  const mostRead = [...filteredArticles]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  const recommended = useMemo(() => {
    if (userProfile?.followedCategories?.length) {
      const matched = filteredArticles.filter(
        (a) =>
          userProfile.followedCategories.includes(a.categoryId) ||
          (a.topics || []).some((tp) => userProfile.followedTopics?.includes(tp))
      );
      if (matched.length > 0) return matched.slice(0, 3);
    }
    return filteredArticles.slice(1, 4);
  }, [filteredArticles, userProfile]);

  const trendingTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of publishedArticles) {
      for (const tp of art.topics || []) {
        counts.set(tp, (counts.get(tp) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [publishedArticles]);

  const highlightCats = categories.filter((c) => !c.parentId && c.isActive).slice(0, 8);

  const categoryHighlightItems = useMemo(() => {
    if (selectedHighlightCat === 'all') return filteredArticles.slice(0, 6);
    return filteredArticles.filter((a) => a.categoryId === selectedHighlightCat).slice(0, 6);
  }, [filteredArticles, selectedHighlightCat]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedInitialDatabase();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-14">
      {/* Transparent Sample Data / Admin Firestore Initialization Strip */}
      {usingSampleFallback && (
        <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#44403C] dark:text-[#D1D5DB]">
            <strong className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Demonstration Edition:
            </strong>{' '}
            Displaying clearly labeled sample editorial records while Firestore is uninitialized.
            {isAdmin
              ? ' Click Initialize Firestore to write all 30 dynamic categories, RSS sources, fact-checks, and sample records into Cloud Firestore.'
              : ' Sign in as an administrator to initialize Firestore and collect live RSS feeds.'}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleSeed()}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] hover:opacity-90 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              {seeding ? 'Initializing Firestore...' : 'Initialize Firestore Catalog'}
            </button>
          )}
        </div>
      )}

      {/* 1. FRONT-PAGE 3-TIER EDITORIAL BROADSHEET */}
      <section aria-label="Featured Front Page">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Tier 1: Lead Story (7 columns) */}
          <div className="lg:col-span-7 lg:pr-8 lg:border-r border-[#E5E2DC] dark:border-[#232A36]">
            {leadArticle ? (
              <ArticleCard article={leadArticle} variant="lead" />
            ) : (
              <div className="p-10 border border-[#E5E2DC] dark:border-[#232A36] text-sm text-[#57534E]">
                No published articles match the active language filter.
              </div>
            )}
          </div>

          {/* Tier 2 & 3: Secondary Features + Latest Wire (5 columns) */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#141413] dark:border-[#F3F4F6]">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#141413] dark:text-[#F3F4F6]">
                  {t(uiLang, 'latest_updates')}
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/latest')}
                  className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  All Latest <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                {latestWire.map((art) => (
                  <ArticleCard key={art.id} article={art} variant="compact" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Features Row */}
        {secondaryFeatures.length > 0 && (
          <div className="mt-10 pt-8 border-t border-[#E5E2DC] dark:border-[#232A36] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {secondaryFeatures.map((art) => (
              <ArticleCard key={art.id} article={art} variant="feature" />
            ))}
            {/* Knowledge Discovery Highlight Column */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
                  Knowledge Discovery
                </p>
                <h3 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
                  Explore Connections Across News, Research & Policy
                </h3>
                <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3 leading-relaxed">
                  Select a subject such as <strong>Inflation</strong> or{' '}
                  <strong>Artificial Intelligence</strong> to inspect news coverage, peer-reviewed
                  studies, official government bulletins, publisher comparisons, and chronological
                  timelines together.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                  {trendingTopics.slice(0, 6).map(([topic, count]) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => navigate(`/topic/${encodeURIComponent(topic)}`)}
                      className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                    >
                      {topic} <span className="font-mono text-[#78716C]">({count})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#E5E2DC] dark:border-[#232A36] flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/discover')}
                  className="font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Open Discovery Hub <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/compare')}
                  className="text-[#57534E] dark:text-[#9CA3AF] hover:underline cursor-pointer"
                >
                  Compare Sources
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. CATEGORY HIGHLIGHTS (DATABASE-DRIVEN DYNAMIC CATEGORIES) */}
      <section className="pt-8 border-t border-[#141413] dark:border-[#F3F4F6]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              {t(uiLang, 'category_highlights')}
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
              Dynamically configured across {categories.filter((c) => !c.parentId).length} primary desks and{' '}
              {categories.filter((c) => Boolean(c.parentId)).length} specialized subcategories.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Browse All {categories.length} Categories <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Filter Segmented Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-6 border-b border-[#E5E2DC] dark:border-[#232A36]">
          <button
            type="button"
            onClick={() => setSelectedHighlightCat('all')}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              selectedHighlightCat === 'all'
                ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413]'
                : 'text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white'
            }`}
          >
            All Desks
          </button>
          {highlightCats.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedHighlightCat(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedHighlightCat === cat.id
                  ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413]'
                  : 'text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {categoryHighlightItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {categoryHighlightItems.map((art) => (
              <ArticleCard key={art.id} article={art} variant="feature" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] py-8">
            No published items in this category yet. Staff can publish manually or collect via RSS in the Control Center.
          </p>
        )}
      </section>

      {/* 3. RESEARCH & DISCOVERIES + GOVERNMENT & CIVIC UPDATES */}
      <section className="pt-8 border-t border-[#E5E2DC] dark:border-[#232A36] grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#141413] dark:border-[#F3F4F6] mb-4">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              {t(uiLang, 'research_discoveries')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/research')}
              className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Research Library <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
            {researchItems.map((art) => (
              <ArticleCard key={art.id} article={art} variant="compact" />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between pb-3 border-b border-[#141413] dark:border-[#F3F4F6] mb-4">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              {t(uiLang, 'government_updates')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/documents')}
              className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Document Archive <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
            {governmentItems.map((art) => (
              <ArticleCard key={art.id} article={art} variant="compact" />
            ))}
          </div>
        </div>
      </section>

      {/* 4. MOST READ, FACT CHECK SNAPSHOT & RECOMMENDED INFORMATION */}
      <section className="pt-8 border-t border-[#E5E2DC] dark:border-[#232A36] grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Most Read Ranked List */}
        <div className="lg:col-span-4">
          <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#141413] dark:text-[#F3F4F6] pb-3 border-b border-[#141413] dark:border-[#F3F4F6]">
            {t(uiLang, 'most_read')}
          </h2>
          <ol className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {mostRead.map((art, index) => (
              <li key={art.id} className="py-3.5 flex items-start gap-4">
                <span className="font-serif text-2xl font-semibold text-[#A8A29E] dark:text-[#4B5563] tabular-nums leading-none pt-0.5">
                  0{index + 1}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/article/${art.slug}`)}
                    className="text-left font-serif text-base font-semibold leading-snug text-[#141413] dark:text-[#F3F4F6] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer"
                  >
                    {art.title}
                  </button>
                  <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1 font-mono tabular-nums">
                    {art.originalSource} · {(art.viewCount || 0).toLocaleString()} reads
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Fact-Check & Chronology Desk */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#141413] dark:border-[#F3F4F6]">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#141413] dark:text-[#F3F4F6]">
              Fact Check & Timelines
            </h2>
            <button
              type="button"
              onClick={() => navigate('/fact-check')}
              className="text-xs text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
            >
              All Reviews
            </button>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {factChecks.slice(0, 3).map((fc) => (
              <div key={fc.id} className="py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E3A8A] dark:text-[#60A5FA]">
                  Verdict: {fc.status.replace('_', ' ')} {fc.isSampleData ? '· Sample' : ''}
                </p>
                <p className="font-serif text-sm font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1 leading-snug">
                  “{fc.claim}”
                </p>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1 line-clamp-2">
                  {fc.explanation}
                </p>
              </div>
            ))}
          </div>
          {timelines[0] && (
            <button
              type="button"
              onClick={() => navigate('/timelines')}
              className="mt-4 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Explore {timelines.length} Chronological Timelines <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Personalized Recommendations */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#141413] dark:border-[#F3F4F6]">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-widest text-[#141413] dark:text-[#F3F4F6]">
              {t(uiLang, 'recommended')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-xs text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
            >
              Personalize
            </button>
          </div>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {recommended.map((art) => (
              <ArticleCard key={art.id} article={art} variant="compact" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
