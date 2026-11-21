import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Clock, Search, Send, Sparkles } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ArticleCard, formatShortDate } from '../components/ArticleCard';
import { searchProvider } from '../lib/searchProvider';
import { apiClient, type AIQAResponse } from '../lib/apiClient';
import { addSavedSearch } from '../lib/firestoreService';
import { updatePageSEO } from '../lib/seo';
import { CONTENT_TYPE_LABELS, type ContentType } from '../types/models';

export function KnowledgeDiscoveryPage({ initialTopic }: { initialTopic?: string }) {
  const { navigate, publishedArticles, timelines, factChecks } = useHub();
  const [topicQuery, setTopicQuery] = useState(initialTopic ? decodeURIComponent(initialTopic) : 'Inflation');
  const [activeTopic, setActiveTopic] = useState(initialTopic ? decodeURIComponent(initialTopic) : 'Inflation');
  const [researchQuestion, setResearchQuestion] = useState('');
  const [qaResult, setQaResult] = useState<AIQAResponse | null>(null);
  const [loadingQa, setLoadingQa] = useState(false);
  const [qaError, setQaError] = useState('');

  useEffect(() => {
    if (initialTopic) {
      const decoded = decodeURIComponent(initialTopic);
      setTopicQuery(decoded);
      setActiveTopic(decoded);
    }
  }, [initialTopic]);

  useEffect(() => {
    updatePageSEO({
      title: `${activeTopic} — Knowledge Discovery Hub`,
      description: `Cross-category knowledge synthesis for ${activeTopic}: news, academic research, official government reports, timelines, and multi-source comparisons.`,
      path: `/topic/${encodeURIComponent(activeTopic)}`,
    });
  }, [activeTopic]);

  const allTopics = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of publishedArticles) {
      for (const tp of a.topics || []) {
        map.set(tp, (map.get(tp) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [publishedArticles]);

  const matched = useMemo(() => {
    const res = searchProvider.search(publishedArticles, { query: activeTopic, pageSize: 50 });
    return res.items;
  }, [activeTopic, publishedArticles]);

  const newsItems = matched.filter((a) => ['news', 'article', 'editorial', 'opinion'].includes(a.contentType));
  const researchItems = matched.filter((a) =>
    ['research', 'scientific_discovery', 'educational_note'].includes(a.contentType)
  );
  const govAndStats = matched.filter((a) =>
    ['government_notification', 'report', 'statistical_info', 'historical_document', 'pdf_document'].includes(
      a.contentType
    )
  );
  const matchingTimelines = timelines.filter(
    (tl) =>
      tl.topic.toLowerCase().includes(activeTopic.toLowerCase()) ||
      tl.title.toLowerCase().includes(activeTopic.toLowerCase())
  );
  const matchingFactChecks = factChecks.filter(
    (fc) =>
      fc.claim.toLowerCase().includes(activeTopic.toLowerCase()) ||
      (fc.category || '').toLowerCase().includes(activeTopic.toLowerCase())
  );

  const handleExploreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicQuery.trim()) return;
    setActiveTopic(topicQuery.trim());
    setQaResult(null);
  };

  const handleResearchAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchQuestion.trim()) return;
    setQaError('');
    setLoadingQa(true);
    try {
      const corpus = (matched.length > 0 ? matched : publishedArticles).slice(0, 8).map((a) => ({
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
        question: researchQuestion.trim(),
        articles: corpus,
      });
      setQaResult(res);
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Research query failed.');
    } finally {
      setLoadingQa(false);
    }
  };

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      {/* Discovery Hero */}
      <section className="pb-8 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">
          Cross-Category Knowledge Discovery Engine
        </p>
        <h1 className="font-serif text-3xl sm:text-5xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
          Subject Dossier: {activeTopic}
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-3xl">
          Unified synthesis connecting breaking news, peer-reviewed research, government publications,
          statistical briefs, fact-checks, and chronological timelines across our central index.
        </p>

        <form onSubmit={handleExploreSubmit} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              placeholder="Explore any topic (e.g. Inflation, Artificial Intelligence, Space, Climate)..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
          >
            Build Dossier
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <span className="font-semibold text-[#141413] dark:text-[#F3F4F6]">Indexed Topics:</span>
          {allTopics.slice(0, 10).map(([tp, count]) => (
            <button
              key={tp}
              type="button"
              onClick={() => {
                setTopicQuery(tp);
                setActiveTopic(tp);
                setQaResult(null);
              }}
              className={`hover:underline cursor-pointer ${
                activeTopic.toLowerCase() === tp.toLowerCase()
                  ? 'font-semibold text-[#1E3A8A] dark:text-[#60A5FA] underline'
                  : ''
              }`}
            >
              {tp} ({count})
            </button>
          ))}
        </div>
      </section>

      {/* Dossier Quantitative Strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-[#E5E2DC] dark:border-[#232A36] pb-8">
        {[
          ['Total Indexed Records', matched.length],
          ['News & Briefings', newsItems.length],
          ['Research & Academic', researchItems.length],
          ['Government & Reports', govAndStats.length],
        ].map(([label, val]) => (
          <div key={String(label)} className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4">
            <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">{label}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-[#141413] dark:text-[#F3F4F6] mt-1">
              {val}
            </p>
          </div>
        ))}
      </section>

      {/* Grounded Research Assistant for This Topic */}
      <section className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" />
            Source-Grounded Research Assistant ({activeTopic})
          </h2>
          <button
            type="button"
            onClick={() => navigate('/compare')}
            className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
          >
            Compare Publishers on {activeTopic} →
          </button>
        </div>
        <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
          Ask any factual question about {activeTopic}. Answers are generated strictly from indexed
          ALL INFORMATION HUB documents with clickable source citations.
        </p>

        <form onSubmit={handleResearchAsk} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={researchQuestion}
            onChange={(e) => setResearchQuestion(e.target.value)}
            placeholder={`e.g. What do indexed studies and official reports say about ${activeTopic}?`}
            className="flex-1 px-3.5 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
          />
          <button
            type="submit"
            disabled={loadingQa}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {loadingQa ? 'Searching Index...' : 'Ask Research Engine'}
          </button>
        </form>

        {qaError && <p className="mt-3 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">{qaError}</p>}

        {qaResult && (
          <div className="mt-5 p-4 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-[#78716C]">{qaResult.aiLabel}</p>
            <p className="text-sm leading-relaxed text-[#141413] dark:text-[#E5E7EB]">
              {qaResult.answer}
            </p>
            {qaResult.citations.length > 0 && (
              <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#232A36] space-y-1.5 text-xs">
                <p className="font-semibold text-[#57534E] dark:text-[#9CA3AF]">Cited Sources:</p>
                {qaResult.citations.map((c, idx) => (
                  <div key={idx} className="flex flex-wrap items-baseline gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/article/${c.slug}`)}
                      className="text-[#1E3A8A] dark:text-[#60A5FA] font-medium hover:underline cursor-pointer"
                    >
                      [{idx + 1}] {c.title}
                    </button>
                    <span className="text-[#78716C]">— {c.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Multi-Faceted Subject Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div>
          <h2 className="font-serif text-xl font-semibold pb-3 border-b border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6]">
            News & Analysis ({newsItems.length})
          </h2>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {newsItems.length > 0 ? (
              newsItems.map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)
            ) : (
              <p className="py-4 text-xs text-[#57534E]">No news articles indexed for this topic yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold pb-3 border-b border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6]">
            Research & Explainers ({researchItems.length})
          </h2>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {researchItems.length > 0 ? (
              researchItems.map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)
            ) : (
              <p className="py-4 text-xs text-[#57534E]">No research papers indexed for this topic yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold pb-3 border-b border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6]">
            Government & Statistical Records ({govAndStats.length})
          </h2>
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] mt-2">
            {govAndStats.length > 0 ? (
              govAndStats.map((a) => <ArticleCard key={a.id} article={a} variant="compact" />)
            ) : (
              <p className="py-4 text-xs text-[#57534E]">No official bulletins indexed for this topic yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Matching Chronological Timeline & Fact-Checks */}
      {(matchingTimelines.length > 0 || matchingFactChecks.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6 border-t border-[#E5E2DC] dark:border-[#232A36]">
          {matchingTimelines.length > 0 && (
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Historical Timeline
              </h2>
              {matchingTimelines.map((tl) => (
                <div key={tl.id} className="space-y-4">
                  <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">{tl.summary}</p>
                  <ol className="space-y-4 border-t border-[#E5E2DC] dark:border-[#232A36] pt-4">
                    {tl.events.map((ev, idx) => (
                      <li key={idx} className="pb-4 border-b border-[#F0EDE6] dark:border-[#1B2230]">
                        <p className="font-mono text-[11px] tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                          Published {formatShortDate(ev.date)}
                          {ev.collectedAt ? ` · Indexed ${formatShortDate(ev.collectedAt)}` : ''} ·{' '}
                          {ev.eventType}
                        </p>
                        <p className="font-serif text-base font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
                          {ev.headline}
                        </p>
                        <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                          {ev.description} — <strong>{ev.source}</strong>
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {matchingFactChecks.length > 0 && (
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] mb-4">
                Related Fact-Check Verifications
              </h2>
              <div className="space-y-4">
                {matchingFactChecks.map((fc) => (
                  <div
                    key={fc.id}
                    className="p-4 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1E3A8A] dark:text-[#60A5FA]">
                      Verdict: {fc.status.replace('_', ' ')}
                    </p>
                    <p className="font-serif text-base font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
                      “{fc.claim}”
                    </p>
                    <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-2 leading-relaxed">
                      {fc.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export function AdvancedSearchPage() {
  const {
    publishedArticles,
    categories,
    publishers,
    user,
    recentSearches,
    addRecentSearch,
    refreshUserData,
    setAuthModalOpen,
    showToast,
  } = useHub();

  const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [publisher, setPublisher] = useState('');
  const [author, setAuthor] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [contentType, setContentType] = useState<ContentType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'oldest' | 'most_read'>('relevance');
  const [page, setPage] = useState(1);

  const [nlExplanation, setNlExplanation] = useState('');
  const [parsingNl, setParsingNl] = useState(false);

  useEffect(() => {
    updatePageSEO({
      title: query ? `Search: ${query}` : 'Advanced Search Engine',
      description: 'Search across global news, peer-reviewed research, government notices, historical archives, and multilingual reports.',
      path: '/search',
    });
  }, [query]);

  const subcategories = categories.filter((c) => c.parentId === categoryId);

  const searchResult = useMemo(
    () =>
      searchProvider.search(publishedArticles, {
        query,
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        publisher: publisher || undefined,
        author: author || undefined,
        country: country || undefined,
        language: language || undefined,
        contentType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        page,
        pageSize: 9,
      }),
    [
      author,
      categoryId,
      contentType,
      country,
      dateFrom,
      dateTo,
      language,
      page,
      publishedArticles,
      publisher,
      query,
      sortBy,
      subcategoryId,
    ]
  );

  const countries = useMemo(
    () => Array.from(new Set(publishedArticles.map((a) => a.country))).sort(),
    [publishedArticles]
  );

  const handleNaturalLanguageSearch = async () => {
    if (!query.trim()) return;
    setParsingNl(true);
    setNlExplanation('');
    try {
      const parsed = await apiClient.parseNaturalLanguageSearch({
        query: query.trim(),
        categoryNames: categories.map((c) => c.name),
      });
      setQuery(parsed.keywords || query);
      if (parsed.suggestedCategory) {
        const matchCat = categories.find(
          (c) => c.name.toLowerCase() === parsed.suggestedCategory.toLowerCase()
        );
        if (matchCat) setCategoryId(matchCat.id);
      }
      if (parsed.contentType) setContentType(parsed.contentType as ContentType);
      if (parsed.language) setLanguage(parsed.language);
      setNlExplanation(parsed.explanation);
      addRecentSearch(query.trim());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI query parsing failed.', 'error');
    } finally {
      setParsingNl(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!query.trim()) return;
    await addSavedSearch(user.uid, query.trim(), categoryId, language);
    await refreshUserData();
    showToast('Search saved to your dashboard.', 'success');
  };

  const popularQueries = ['Inflation', 'Artificial Intelligence', 'Space', 'Constitution', 'Agriculture', 'Education'];

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
          {searchResult.providerName}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Advanced Information Search
        </h1>

        <div className="mt-5 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) addRecentSearch(query.trim());
              }}
              placeholder="Search headlines, content, authors, keywords, or enter a natural language question..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleNaturalLanguageSearch()}
            disabled={parsingNl || !query.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {parsingNl ? 'Interpreting...' : 'AI Natural Search'}
          </button>
          <button
            type="button"
            onClick={() => void handleSaveSearch()}
            disabled={!query.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold border border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6] disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5" /> Save Search
          </button>
        </div>

        {/* Autocomplete Suggestions */}
        {searchResult.suggestions.length > 0 && query.trim().length >= 2 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#57534E] dark:text-[#9CA3AF]">
            <span>Suggestions:</span>
            {searchResult.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setQuery(s);
                  addRecentSearch(s);
                }}
                className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {nlExplanation && (
          <p className="mt-3 text-xs text-[#1E3A8A] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#172554]/40 border border-[#BFDBFE] dark:border-[#1E3A8A] px-3 py-2">
            AI Search Filter Interpretation: {nlExplanation}
          </p>
        )}

        {/* Popular & Recent Searches */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <span className="font-semibold text-[#141413] dark:text-[#F3F4F6]">Popular:</span>
          {popularQueries.map((pq) => (
            <button
              key={pq}
              type="button"
              onClick={() => {
                setQuery(pq);
                setPage(1);
              }}
              className="hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] hover:underline cursor-pointer"
            >
              {pq}
            </button>
          ))}
          {recentSearches.length > 0 && (
            <>
              <span aria-hidden="true">|</span>
              <span className="font-semibold text-[#141413] dark:text-[#F3F4F6]">Recent:</span>
              {recentSearches.slice(0, 4).map((rq) => (
                <button
                  key={rq}
                  type="button"
                  onClick={() => setQuery(rq)}
                  className="hover:underline cursor-pointer"
                >
                  {rq}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Filter Matrix */}
      <section className="py-5 border-b border-[#E5E2DC] dark:border-[#232A36] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubcategoryId('');
            setPage(1);
          }}
          aria-label="Filter by category"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="">All Categories</option>
          {categories
            .filter((c) => !c.parentId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>

        <select
          value={subcategoryId}
          onChange={(e) => {
            setSubcategoryId(e.target.value);
            setPage(1);
          }}
          disabled={subcategories.length === 0}
          aria-label="Filter by subcategory"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] disabled:opacity-50"
        >
          <option value="">All Subcategories</option>
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={contentType}
          onChange={(e) => {
            setContentType(e.target.value as ContentType | '');
            setPage(1);
          }}
          aria-label="Filter by content type"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="">All Content Types</option>
          {Object.entries(CONTENT_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={publisher}
          onChange={(e) => {
            setPublisher(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by publisher"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="">All Publishers</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by language"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="bn">Bengali (বাংলা)</option>
          <option value="hi">Hindi (हिन्दी)</option>
        </select>

        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by country"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={author}
          onChange={(e) => {
            setAuthor(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by author..."
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          aria-label="Sort results"
          className="px-2.5 py-2 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
        >
          <option value="relevance">Sort: Relevance</option>
          <option value="newest">Sort: Newest First</option>
          <option value="oldest">Sort: Oldest First</option>
          <option value="most_read">Sort: Most Read</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            setCategoryId('');
            setSubcategoryId('');
            setPublisher('');
            setAuthor('');
            setCountry('');
            setLanguage('');
            setContentType('');
            setDateFrom('');
            setDateTo('');
            setNlExplanation('');
            setPage(1);
          }}
          className="px-3 py-2 border border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white cursor-pointer"
        >
          Reset Filters
        </button>
      </section>

      {/* Results Header */}
      <div className="mt-6 flex items-center justify-between text-xs text-[#57534E] dark:text-[#9CA3AF]">
        <span className="font-mono tabular-nums">
          Showing {searchResult.items.length} of {searchResult.total} matching records (Page {searchResult.page} of{' '}
          {searchResult.totalPages})
        </span>
      </div>

      {/* Results Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {searchResult.items.map((art) => (
          <ArticleCard key={art.id} article={art} variant="feature" />
        ))}
      </div>

      {searchResult.items.length === 0 && (
        <div className="mt-8 p-12 text-center border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
          <p className="font-serif text-xl text-[#141413] dark:text-[#F3F4F6]">
            No matching publications found
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-2">
            Try clearing a filter, using broader keywords, or switching to AI Natural Search.
          </p>
        </div>
      )}

      {/* Pagination */}
      {searchResult.totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-4 py-2 border border-[#E5E2DC] dark:border-[#232A36] disabled:opacity-40 cursor-pointer"
          >
            Previous
          </button>
          <span className="font-mono tabular-nums">
            Page {page} / {searchResult.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= searchResult.totalPages}
            onClick={() => setPage((p) => Math.min(searchResult.totalPages, p + 1))}
            className="px-4 py-2 border border-[#E5E2DC] dark:border-[#232A36] disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </main>
  );
}
