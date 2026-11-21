import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, Rss, Trash2 } from 'lucide-react';
import { useHub } from '../../context/HubContext';
import { apiClient, type FeedFetchResponse } from '../../lib/apiClient';
import {
  createIngestionLog,
  deleteSourceById,
  fetchIngestionLogs,
  saveArticle,
  saveSource,
} from '../../lib/firestoreService';
import { formatShortDate } from '../../components/ArticleCard';
import type { IngestionLog, SourceConfig, SourceType } from '../../types/models';

export function SourceCollectionManager() {
  const {
    sources,
    categories,
    allStaffArticles,
    siteSettings,
    effectiveRole,
    refreshStaffData,
    showToast,
  } = useHub();

  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<FeedFetchResponse | null>(null);
  const [validationError, setValidationError] = useState('');

  // New Source Form
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [sourceType, setSourceType] = useState<SourceType>('rss_feed');
  const [country, setCountry] = useState('International');
  const [language, setLanguage] = useState('en');
  const [rssFeedUrl, setRssFeedUrl] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [fetchIntervalMinutes, setFetchIntervalMinutes] = useState(60);
  const [trustClassification, setTrustClassification] =
    useState<SourceConfig['trustClassification']>('tier_2_major_media');
  const [contentPermission, setContentPermission] =
    useState<SourceConfig['contentPermission']>('excerpt_and_link');
  const [defaultCategoryId, setDefaultCategoryId] = useState(categories[0]?.id || 'international-news');
  const [autoPublishEligible, setAutoPublishEligible] = useState(false);

  const loadLogs = async () => {
    try {
      const data = await fetchIngestionLogs();
      setLogs(data);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const handleValidate = async () => {
    if (!rssFeedUrl.trim() && !apiEndpoint.trim()) {
      setValidationError('Enter an RSS Feed URL or Authorized JSON API Endpoint to validate.');
      return;
    }
    setValidationError('');
    setValidationResult(null);
    setValidating(true);
    try {
      const res = await apiClient.validateFeed({
        feedUrl: rssFeedUrl.trim() || undefined,
        apiEndpoint: apiEndpoint.trim() || undefined,
        sourceName: name.trim() || 'Feed Preview',
      });
      setValidationResult(res);
      if (!name.trim() && res.feedTitle) setName(res.feedTitle);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Validation failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !websiteUrl.trim()) return;
    try {
      await saveSource({
        name,
        websiteUrl,
        sourceType,
        country,
        language,
        rssFeedUrl: rssFeedUrl.trim() || undefined,
        apiEndpoint: apiEndpoint.trim() || undefined,
        authMode: 'none',
        fetchIntervalMinutes,
        status: 'active',
        trustClassification,
        contentPermission,
        autoPublishEligible,
        defaultCategoryId,
        totalImported: 0,
      });
      setName('');
      setWebsiteUrl('');
      setRssFeedUrl('');
      setApiEndpoint('');
      setValidationResult(null);
      await refreshStaffData();
      showToast('Authorized source registered in Firestore.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save source.', 'error');
    }
  };

  const handleFetchSourceNow = async (src: SourceConfig) => {
    if (!src.rssFeedUrl && !src.apiEndpoint) {
      showToast('Configure an RSS Feed URL or API Endpoint on this source first.', 'error');
      return;
    }
    setFetchingId(src.id);
    try {
      const existingUrls = allStaffArticles.map((a) => a.canonicalUrl || a.originalSourceUrl || '').filter(Boolean);
      const existingTitles = allStaffArticles.map((a) => a.title);

      const res = await apiClient.fetchSourceFeed({
        feedUrl: src.rssFeedUrl || undefined,
        apiEndpoint: src.apiEndpoint || undefined,
        sourceName: src.name,
        defaultLanguage: src.language,
        contentPermission: src.contentPermission,
        existingCanonicalUrls: existingUrls,
        existingTitles,
        maxItems: 8,
      });

      const newItems = res.items.filter((item) => !item.isDuplicate);
      const targetEditorialStatus =
        !siteSettings.defaultRequireApproval && src.autoPublishEligible
          ? 'published'
          : 'pending_review';

      let importedCount = 0;
      for (const item of newItems) {
        const contentType =
          src.sourceType === 'research_journal'
            ? 'research'
            : src.sourceType === 'government_portal'
              ? 'government_notification'
              : 'news';
        await saveArticle(
          {
            title: item.title,
            slug: item.slug,
            summary: item.summary,
            content: item.content,
            contentType,
            originalSource: item.originalSource,
            originalSourceUrl: item.originalSourceUrl,
            canonicalUrl: item.canonicalUrl,
            authorName: item.authorName,
            categoryId: src.defaultCategoryId || 'international-news',
            tags: item.tags,
            topics: [src.country, src.sourceType.replace(/_/g, ' ')],
            country: src.country,
            language: item.language,
            featuredImage: item.featuredImage,
            publishedAt: item.publishedAt,
            collectedAt: item.collectedAt,
            collectionMethod: src.rssFeedUrl ? 'rss' : 'api',
            copyrightPermissionStatus:
              src.contentPermission === 'public_domain'
                ? 'public_domain'
                : src.contentPermission === 'cc_by'
                  ? 'cc_licensed'
                  : src.contentPermission === 'full_authorized'
                    ? 'full_licensed'
                    : 'excerpt_and_link',
            editorialStatus: targetEditorialStatus,
            factCheckStatus: 'unverified',
            sourceId: src.id,
            isSampleData: false,
          },
          {
            changeNote: `Auto-collected from ${src.name} (${targetEditorialStatus})`,
            actorRole: effectiveRole,
          }
        );
        importedCount += 1;
      }

      await saveSource({
        ...src,
        status: 'active',
        lastFetchTime: new Date().toISOString(),
        errorStatus: '',
        totalImported: (src.totalImported || 0) + importedCount,
      });

      await createIngestionLog({
        sourceId: src.id,
        sourceName: src.name,
        status: 'success',
        itemsFetched: res.itemsFetched,
        itemsImported: importedCount,
        duplicatesSkipped: res.duplicatesSkipped,
      });

      await refreshStaffData();
      await loadLogs();
      showToast(
        `Collected from ${src.name}: ${importedCount} new items added to ${targetEditorialStatus.replace('_', ' ')}, ${res.duplicatesSkipped} duplicates skipped.`,
        'success'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Feed fetch failed.';
      await saveSource({
        ...src,
        status: 'error',
        errorStatus: msg.slice(0, 480),
      }).catch(() => {});
      await createIngestionLog({
        sourceId: src.id,
        sourceName: src.name,
        status: 'failed',
        itemsFetched: 0,
        itemsImported: 0,
        duplicatesSkipped: 0,
        errorMessage: msg,
      }).catch(() => {});
      await loadLogs();
      showToast(`Collection error (${src.name}): ${msg}`, 'error');
    } finally {
      setFetchingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
          Automatic Collection Engine & Source Manager
        </h2>
        <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
          Server-side SSRF-protected RSS/Atom & authorized JSON API collector with URL
          canonicalization, duplicate detection, copyright mode enforcement, and default editorial
          approval routing.
        </p>
      </div>

      {/* Configured Sources Table */}
      <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF9F6] dark:bg-[#11151D] border-b border-[#E5E2DC] dark:border-[#232A36]">
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Type & Feed</th>
              <th className="px-4 py-3 font-semibold">Rights / Auto-Publish</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Imported</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
            {sources.map((src) => (
              <tr key={src.id}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[#141413] dark:text-[#F3F4F6]">{src.name}</p>
                  <p className="text-[11px] text-[#57534E] dark:text-[#9CA3AF]">
                    {src.country} · {src.language.toUpperCase()} · {src.trustClassification.replace(/_/g, ' ')}
                  </p>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="font-mono text-[11px] text-[#141413] dark:text-[#E5E7EB]">
                    {src.sourceType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-[#57534E] dark:text-[#9CA3AF] truncate">
                    {src.rssFeedUrl || src.apiEndpoint || src.websiteUrl}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono text-[11px]">
                  <p>{src.contentPermission}</p>
                  <p className="text-[#57534E] dark:text-[#9CA3AF]">
                    Auto-Pub: {src.autoPublishEligible ? 'Eligible' : 'Approval Required'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-semibold uppercase ${
                      src.status === 'active'
                        ? 'text-[#166534] dark:text-[#86EFAC]'
                        : src.status === 'error'
                          ? 'text-[#B91C1C] dark:text-[#FCA5A5]'
                          : 'text-[#78716C]'
                    }`}
                  >
                    {src.status}
                  </span>
                  {src.errorStatus && (
                    <p className="text-[11px] text-[#B91C1C] dark:text-[#FCA5A5] max-w-[180px] truncate">
                      {src.errorStatus}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  <p>{src.totalImported || 0}</p>
                  <p className="text-[10px] text-[#78716C]">{formatShortDate(src.lastFetchTime)}</p>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      disabled={fetchingId === src.id}
                      onClick={() => void handleFetchSourceNow(src)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${fetchingId === src.id ? 'animate-spin' : ''}`} />
                      {fetchingId === src.id ? 'Fetching...' : 'Fetch Now'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteSourceById(src.id);
                        await refreshStaffData();
                      }}
                      aria-label="Delete source"
                      className="p-1.5 text-[#78716C] hover:text-[#B91C1C] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add & Validate New RSS / Authorized API Source */}
      <form
        onSubmit={handleAddSource}
        className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 space-y-4 text-xs"
      >
        <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] inline-flex items-center gap-2">
          <Rss className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" />
          Register Authorized RSS Feed or API Source
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Source Name (e.g. Reuters Science RSS)"
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          />
          <input
            type="url"
            required
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="Publisher Website URL (https://...)"
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          />
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          >
            <option value="rss_feed">RSS Feed</option>
            <option value="news_publisher">News Publisher</option>
            <option value="newspaper_website">Newspaper Website</option>
            <option value="news_channel">News Channel</option>
            <option value="government_portal">Government Portal</option>
            <option value="educational_institution">Educational Institution</option>
            <option value="research_journal">Research Journal</option>
            <option value="press_release">Official Press Release</option>
            <option value="authorized_api">Authorized API</option>
            <option value="custom_feed">Custom Permitted Feed</option>
          </select>

          <input
            type="url"
            value={rssFeedUrl}
            onChange={(e) => setRssFeedUrl(e.target.value)}
            placeholder="RSS / Atom Feed URL (https://...)"
            className="md:col-span-2 px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          />
          <input
            type="url"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="Or Authorized JSON API Endpoint (https://...)"
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          />

          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          >
            <option value="en">English (en)</option>
            <option value="bn">Bengali (bn)</option>
            <option value="hi">Hindi (hi)</option>
          </select>
          <select
            value={defaultCategoryId}
            onChange={(e) => setDefaultCategoryId(e.target.value)}
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          >
            {categories
              .filter((c) => !c.parentId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Default Category: {c.name}
                </option>
              ))}
          </select>

          <select
            value={trustClassification}
            onChange={(e) => setTrustClassification(e.target.value as SourceConfig['trustClassification'])}
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          >
            <option value="tier_1_official">Tier 1 — Official Government</option>
            <option value="tier_1_journal">Tier 1 — Peer-Reviewed Journal</option>
            <option value="tier_2_major_media">Tier 2 — Major Newsroom</option>
            <option value="tier_3_verified">Tier 3 — Verified Publisher</option>
          </select>

          <select
            value={contentPermission}
            onChange={(e) => setContentPermission(e.target.value as SourceConfig['contentPermission'])}
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
          >
            <option value="excerpt_and_link">Metadata + Excerpt & Link Only</option>
            <option value="public_domain">Public Domain</option>
            <option value="cc_by">Creative Commons (CC-BY)</option>
            <option value="full_authorized">Full Republication Authorized</option>
          </select>

          <input
            type="number"
            min={5}
            max={10080}
            value={fetchIntervalMinutes}
            onChange={(e) => setFetchIntervalMinutes(Number(e.target.value))}
            placeholder="Fetch interval (min)"
            className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] tabular-nums"
          />
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoPublishEligible}
            onChange={(e) => setAutoPublishEligible(e.target.checked)}
          />
          Trusted source eligible for automatic publication (requires global editorial approval setting to allow auto-publish)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={validating}
            onClick={() => void handleValidate()}
            className="px-4 py-2 border border-[#1E3A8A] dark:border-[#60A5FA] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold cursor-pointer"
          >
            {validating ? 'Validating Feed...' : 'Validate Feed Server-Side'}
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Save Authorized Source
          </button>
        </div>

        {validationError && <p className="text-[#B91C1C] dark:text-[#FCA5A5]">{validationError}</p>}

        {validationResult && (
          <div className="p-3.5 bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#14532D] space-y-1.5">
            <p className="font-semibold text-[#166534] dark:text-[#86EFAC] inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Feed Validated: {validationResult.feedTitle} ({validationResult.itemsFetched} preview items)
            </p>
            <ul className="list-disc pl-5 text-[#14532D] dark:text-[#BBF7D0] space-y-0.5">
              {validationResult.items.slice(0, 3).map((item) => (
                <li key={item.externalId}>{item.title}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      {/* Collection History & Logs */}
      <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
        <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mb-3">
          Collection History & Duplicate Detection Logs ({logs.length})
        </h3>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF]">
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Fetched</th>
                  <th className="py-2 pr-4 text-right">Imported</th>
                  <th className="py-2 pr-4 text-right">Duplicates Skipped</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6] dark:divide-[#1B2230]">
                {logs.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 pr-4 font-medium">{log.sourceName}</td>
                    <td className="py-2.5 pr-4 font-mono uppercase">{log.status}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{log.itemsFetched}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{log.itemsImported}</td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums">{log.duplicatesSkipped}</td>
                    <td className="py-2.5 text-[#57534E] dark:text-[#9CA3AF]">{log.errorMessage || 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">
            Click “Fetch Now” on any RSS feed above to execute live collection and record duplicate-detection logs.
          </p>
        )}
      </div>
    </div>
  );
}
