import React, { useEffect, useState } from 'react';
import { Clock, ExternalLink, Scale, ShieldCheck, Sparkles } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { formatShortDate } from '../components/ArticleCard';
import { apiClient, type AIComparisonResponse, type AITimelineResponse } from '../lib/apiClient';
import { updatePageSEO } from '../lib/seo';
import { FACT_CHECK_LABELS, type FactCheckStatus } from '../types/models';

export function FactCheckPage() {
  const { factChecks, navigate } = useHub();
  const [statusFilter, setStatusFilter] = useState<FactCheckStatus | 'all'>('all');

  useEffect(() => {
    updatePageSEO({
      title: 'Fact Check & Source Verification Center',
      description: 'Transparent evidence-based verification records with documented methodology and primary references.',
      path: '/fact-check',
    });
  }, []);

  const filtered =
    statusFilter === 'all' ? factChecks : factChecks.filter((fc) => fc.status === statusFilter);

  const statusTone = (status: FactCheckStatus) => {
    switch (status) {
      case 'verified':
        return 'text-[#166534] dark:text-[#86EFAC]';
      case 'partially_verified':
        return 'text-[#1E3A8A] dark:text-[#60A5FA]';
      case 'disputed':
      case 'under_review':
        return 'text-[#92400E] dark:text-[#FCD34D]';
      case 'false':
        return 'text-[#B91C1C] dark:text-[#FCA5A5]';
      default:
        return 'text-[#57534E] dark:text-[#9CA3AF]';
    }
  };

  return (
    <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold inline-flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" /> Transparent Verification Methodology
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Fact Check Center
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-3xl">
          Every verdict documents the exact claim, primary evidence, review methodology, reviewer
          identity, and external references. AI processing never substitutes for human fact-checking.
        </p>

        {/* Interactive Status Filter Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413]'
                : 'border border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF]'
            }`}
          >
            All ({factChecks.length})
          </button>
          {(Object.keys(FACT_CHECK_LABELS) as FactCheckStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413]'
                  : 'border border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF]'
              }`}
            >
              {FACT_CHECK_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        {filtered.map((fc) => (
          <article
            key={fc.id}
            className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pb-3 border-b border-[#F0EDE6] dark:border-[#1B2230]">
              <span className={`font-semibold uppercase tracking-wider ${statusTone(fc.status)}`}>
                Verdict: {FACT_CHECK_LABELS[fc.status]}
              </span>
              <div className="flex items-center gap-2 text-[#57534E] dark:text-[#9CA3AF]">
                <span>Reviewer: {fc.reviewerName}</span>
                {fc.category && (
                  <>
                    <span>·</span>
                    <span>{fc.category}</span>
                  </>
                )}
                {fc.isSampleData && (
                  <>
                    <span>·</span>
                    <span className="italic">Sample Record</span>
                  </>
                )}
              </div>
            </div>

            <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-4">
              Claim: “{fc.claim}”
            </h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#9CA3AF] mb-1">
                  Documentary Evidence
                </p>
                <p className="text-[#292524] dark:text-[#D1D5DB] leading-relaxed">{fc.evidence}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#57534E] dark:text-[#9CA3AF] mb-1">
                  Editorial Explanation
                </p>
                <p className="text-[#292524] dark:text-[#D1D5DB] leading-relaxed">{fc.explanation}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#F0EDE6] dark:border-[#1B2230] flex flex-wrap items-center justify-between gap-4 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              <div>
                <strong className="text-[#141413] dark:text-[#F3F4F6]">Methodology:</strong>{' '}
                {fc.methodology || 'Primary institutional source cross-verification.'}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(fc.references || []).map((refUrl, idx) => (
                  <a
                    key={idx}
                    href={refUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1"
                  >
                    Reference [{idx + 1}] <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
                {fc.articleId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/article/${fc.articleId}`)}
                    className="font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline cursor-pointer"
                  >
                    View Related Report →
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] py-10 text-center">
            No fact-check records match this status filter.
          </p>
        )}
      </div>
    </main>
  );
}

export function SourceComparisonPage() {
  const { publishedArticles, navigate } = useHub();
  const focusParam = new URLSearchParams(window.location.search).get('focus');

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initial = focusParam ? [focusParam] : [];
    const inflationSet = publishedArticles
      .filter((a) => (a.topics || []).includes('Inflation'))
      .map((a) => a.id);
    const merged = Array.from(new Set([...initial, ...inflationSet])).slice(0, 3);
    return merged.length >= 2 ? merged : publishedArticles.slice(0, 2).map((a) => a.id);
  });

  const [comparison, setComparison] = useState<AIComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    updatePageSEO({
      title: 'Multi-Source Reporting Comparison',
      description: 'Compare headlines, publication timestamps, reporting angles, and missing or conflicting details across publishers.',
      path: '/compare',
    });
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const selectedArticles = publishedArticles.filter((a) => selectedIds.includes(a.id));

  const runComparison = async () => {
    if (selectedArticles.length < 2) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.compareSources(
        selectedArticles.map((a) => ({
          id: a.id,
          title: a.title,
          originalSource: a.originalSource,
          originalSourceUrl: a.originalSourceUrl,
          publishedAt: a.publishedAt,
          collectedAt: a.collectedAt,
          summary: a.summary,
          content: a.content,
        }))
      );
      setComparison(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold inline-flex items-center gap-1.5">
          <Scale className="w-4 h-4" /> Media Transparency Desk
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Multi-Source Reporting Comparison
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-3xl">
          Select 2 to 4 indexed publications to compare original headlines, timestamps, corroborated
          facts, reporting emphases, and missing or conflicting details. Similar topics are never
          assumed to describe the exact same event.
        </p>
      </div>

      {/* Article Selector Table */}
      <section className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-xs font-semibold text-[#141413] dark:text-[#F3F4F6]">
            Select 2–4 Indexed Reports ({selectedArticles.length} selected)
          </p>
          <button
            type="button"
            disabled={selectedArticles.length < 2 || loading}
            onClick={() => void runComparison()}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] disabled:opacity-40 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? 'Analyzing Reporting Differences...' : 'Run Multi-Source Comparison'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
          {publishedArticles.map((art) => {
            const active = selectedIds.includes(art.id);
            return (
              <button
                key={art.id}
                type="button"
                onClick={() => toggleSelect(art.id)}
                className={`text-left p-3 border transition-colors cursor-pointer ${
                  active
                    ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#EFF6FF]/60 dark:bg-[#172554]/40'
                    : 'border-[#E5E2DC] dark:border-[#232A36] hover:bg-[#FAF9F6] dark:hover:bg-[#19202D]'
                }`}
              >
                <p className="text-[11px] font-mono text-[#57534E] dark:text-[#9CA3AF]">
                  {art.originalSource} · {formatShortDate(art.publishedAt)}
                </p>
                <p className="font-serif text-sm font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1 line-clamp-2">
                  {art.title}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Side-by-Side Publisher Table */}
      {selectedArticles.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedArticles.map((art) => (
            <div
              key={art.id}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                  {art.originalSource}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-[#57534E] dark:text-[#9CA3AF] mt-1">
                  Published: {formatShortDate(art.publishedAt)} · Indexed: {formatShortDate(art.collectedAt)}
                </p>
                <h2 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mt-3">
                  {art.title}
                </h2>
                <p className="text-xs text-[#44403C] dark:text-[#CBD5E1] mt-2 leading-relaxed">
                  {art.summary}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F0EDE6] dark:border-[#1B2230] flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate(`/article/${art.slug}`)}
                  className="font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline cursor-pointer"
                >
                  Open Indexed Copy
                </button>
                {art.originalSourceUrl && (
                  <a
                    href={art.originalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1E3A8A] dark:text-[#60A5FA] hover:underline"
                  >
                    Original <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {error && (
        <p className="text-xs text-[#B91C1C] dark:text-[#FCA5A5]">{error}</p>
      )}

      {/* AI Comparative Analysis Output */}
      {comparison && (
        <section className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 space-y-6">
          <div className="pb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
            <p className="text-[11px] uppercase tracking-wider text-[#78716C]">
              {comparison.disclaimer} ({comparison.provider})
            </p>
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
              Event Scope Assessment
            </h2>
            <p className="text-sm text-[#292524] dark:text-[#D1D5DB] mt-2 leading-relaxed">
              {comparison.sameEventAssessment}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#166534] dark:text-[#86EFAC] mb-2">
                Corroborated / Shared Facts
              </h3>
              <ul className="list-disc pl-4 space-y-2 text-[#292524] dark:text-[#D1D5DB] text-xs leading-relaxed">
                {comparison.sharedFacts.map((fact, idx) => (
                  <li key={idx}>{fact}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#1E3A8A] dark:text-[#60A5FA] mb-2">
                Differences in Reporting
              </h3>
              <ul className="space-y-2.5 text-xs text-[#292524] dark:text-[#D1D5DB] leading-relaxed">
                {comparison.reportingDifferences.map((diff, idx) => (
                  <li key={idx}>
                    <strong className="text-[#141413] dark:text-[#F3F4F6]">{diff.aspect}:</strong>{' '}
                    {diff.details}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-sans text-xs font-semibold uppercase tracking-wider text-[#92400E] dark:text-[#FCD34D] mb-2">
                Missing or Conflicting Details
              </h3>
              <ul className="list-disc pl-4 space-y-2 text-[#292524] dark:text-[#D1D5DB] text-xs leading-relaxed">
                {comparison.missingOrConflictingDetails.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export function TimelineExplorerPage() {
  const { timelines, publishedArticles, navigate } = useHub();
  const [customTopic, setCustomTopic] = useState('');
  const [aiTimeline, setAiTimeline] = useState<AITimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    updatePageSEO({
      title: 'Chronological Timeline Explorer',
      description: 'Trace major events, official statements, and research updates chronologically with clear publication vs. indexing timestamps.',
      path: '/timelines',
    });
  }, []);

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    setError('');
    setLoading(true);
    try {
      const relevant = publishedArticles.filter(
        (a) =>
          a.title.toLowerCase().includes(customTopic.toLowerCase()) ||
          a.summary.toLowerCase().includes(customTopic.toLowerCase()) ||
          (a.topics || []).some((tp) => tp.toLowerCase().includes(customTopic.toLowerCase()))
      );
      const res = await apiClient.synthesizeTimeline({
        topic: customTopic.trim(),
        articles: (relevant.length > 0 ? relevant : publishedArticles.slice(0, 5)).map((a) => ({
          id: a.id,
          title: a.title,
          originalSource: a.originalSource,
          publishedAt: a.publishedAt,
          collectedAt: a.collectedAt,
          summary: a.summary,
          content: a.content,
        })),
      });
      setAiTimeline(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate timeline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold inline-flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Chronological Information Archive
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Timeline Explorer
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-3xl">
          Every chronology explicitly distinguishes the original source publication date from the
          timestamp when ALL INFORMATION HUB collected and indexed the record.
        </p>

        <form onSubmit={handleSynthesize} className="mt-5 flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Generate live timeline from indexed articles (e.g. Inflation, Space)..."
            className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {loading ? 'Compiling...' : 'Synthesize Timeline'}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">{error}</p>}
      </div>

      {/* Live AI-Compiled Timeline */}
      {aiTimeline && (
        <section className="border border-[#1E3A8A] dark:border-[#60A5FA] bg-white dark:bg-[#141922] p-6">
          <p className="text-[11px] uppercase tracking-wider text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">
            {aiTimeline.aiLabel} · {aiTimeline.provider}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
            {aiTimeline.title}
          </h2>
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">{aiTimeline.summary}</p>
          <ol className="mt-6 space-y-5 divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
            {aiTimeline.events.map((ev, idx) => (
              <li key={idx} className="pt-4 first:pt-0">
                <p className="font-mono text-[11px] tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                  Original Published: {formatShortDate(ev.date)}
                  {ev.collectedAt ? ` · Platform Indexed: ${formatShortDate(ev.collectedAt)}` : ''} ·{' '}
                  {ev.eventType}
                </p>
                <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
                  {ev.headline}
                </h3>
                <p className="text-xs text-[#44403C] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                  {ev.description} — <strong>{ev.source}</strong>
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Curated Database Timelines */}
      <div className="space-y-8">
        {timelines.map((tl) => (
          <section
            key={tl.id}
            className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
              <div>
                <p className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">
                  Topic: {tl.topic} {tl.isSampleData ? '· Sample Chronology' : ''}
                </p>
                <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
                  {tl.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/topic/${encodeURIComponent(tl.topic)}`)}
                className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                Explore Topic Dossier →
              </button>
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-3">{tl.summary}</p>

            <ol className="mt-6 space-y-5">
              {tl.events.map((ev, idx) => (
                <li
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-5 border-b border-[#F0EDE6] dark:border-[#1B2230] last:border-b-0"
                >
                  <div className="md:col-span-3 text-xs font-mono tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                    <p className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
                      {formatShortDate(ev.date)}
                    </p>
                    {ev.collectedAt && (
                      <p className="text-[11px] mt-0.5">Indexed: {formatShortDate(ev.collectedAt)}</p>
                    )}
                    <p className="text-[11px] text-[#1E3A8A] dark:text-[#60A5FA] mt-1">
                      {ev.eventType}
                    </p>
                  </div>
                  <div className="md:col-span-9">
                    <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6]">
                      {ev.headline}
                    </h3>
                    <p className="text-sm text-[#44403C] dark:text-[#CBD5E1] mt-1 leading-relaxed">
                      {ev.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-[#57534E] dark:text-[#9CA3AF]">
                      <span>Source: {ev.source}</span>
                      {ev.articleSlug && (
                        <>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={() => navigate(`/article/${ev.articleSlug}`)}
                            className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                          >
                            Read Indexed Report
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}
