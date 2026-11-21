import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import Parser from 'rss-parser';

export interface IngestedItem {
  externalId: string;
  fingerprint: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  originalSource: string;
  originalSourceUrl: string;
  canonicalUrl: string;
  authorName: string;
  publishedAt: string;
  collectedAt: string;
  language: string;
  tags: string[];
  featuredImage: string;
  isDuplicate: boolean;
}

export interface FeedFetchResult {
  feedTitle: string;
  feedDescription: string;
  itemsFetched: number;
  itemsNew: number;
  duplicatesSkipped: number;
  items: IngestedItem[];
}

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': 'AllInformationHubBot/1.0 (+https://allinformationhub.org; RSS-Aggregator)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json',
  },
});

function isPrivateOrReservedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true; // 10.0.0.0/8
    if (parts[0] === 127) return true; // 127.0.0.0/8 loopback
    if (parts[0] === 0) return true; // 0.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true; // link-local / cloud metadata
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.0.0/16
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // CGNAT
    if (parts[0] >= 224) return true; // Multicast & reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    if (lower.startsWith('::ffff:')) {
      const mappedV4 = lower.replace('::ffff:', '');
      return isPrivateOrReservedIP(mappedV4);
    }
    return false;
  }
  return true;
}

export async function validateSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL syntax.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http:// and https:// feed URLs are permitted.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Embedded credentials in URLs are not permitted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('Local or internal hostnames are blocked.');
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Only standard HTTP (80) and HTTPS (443) ports are allowed.');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error('Private or reserved IP addresses are blocked.');
    }
  } else {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) {
      throw new Error('Unable to resolve feed host.');
    }
    for (const rec of records) {
      if (isPrivateOrReservedIP(rec.address)) {
        throw new Error('Feed host resolves to a restricted internal network address.');
      }
    }
  }

  return parsed;
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
      'ref',
    ];
    for (const p of trackingParams) {
      u.searchParams.delete(p);
    }
    const cleanPath = u.pathname.replace(/\/+$/, '') || '/';
    u.pathname = cleanPath;
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
  return base || `item-${Date.now().toString(36)}`;
}

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectLanguageHeuristic(text: string, fallback = 'en'): string {
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali script
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari (Hindi)
  if (/[\u0600-\u06FF]/.test(text)) return 'ar'; // Arabic
  return fallback || 'en';
}

function computeFingerprint(canonical: string, title: string): string {
  const normalized = `${canonical.toLowerCase()}|${title.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF\u0900-\u097F]/g, '').slice(0, 80)}`;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export async function fetchRssFeed(options: {
  feedUrl: string;
  sourceName: string;
  defaultLanguage?: string;
  contentPermission?: string;
  existingCanonicalUrls?: string[];
  existingTitles?: string[];
  maxItems?: number;
}): Promise<FeedFetchResult> {
  const validatedUrl = await validateSafeExternalUrl(options.feedUrl);
  const response = await fetch(validatedUrl.toString(), {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
    headers: {
      'User-Agent': 'AllInformationHubBot/1.0 (Authorized RSS/Atom Feed Aggregator)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Upstream feed returned HTTP ${response.status}`);
  }

  // Re-verify final redirected URL against SSRF rules
  if (response.url && response.url !== validatedUrl.toString()) {
    await validateSafeExternalUrl(response.url);
  }

  const xmlText = await response.text();
  if (xmlText.length > 5 * 1024 * 1024) {
    throw new Error('Feed payload exceeds 5MB safety limit.');
  }

  const feed = await parser.parseString(xmlText);
  const existingUrlSet = new Set((options.existingCanonicalUrls || []).map((u) => canonicalizeUrl(u)));
  const existingTitleSet = new Set((options.existingTitles || []).map((t) => t.toLowerCase().trim()));
  const collectedAt = new Date().toISOString();
  const limit = Math.min(options.maxItems || 12, 25);

  const rawItems = (feed.items || []).slice(0, limit);
  const items: IngestedItem[] = [];
  let duplicatesSkipped = 0;

  for (const entry of rawItems) {
    const title = stripHtmlTags(entry.title || '').slice(0, 280);
    if (!title || title.length < 4) continue;

    const rawLink = entry.link || entry.guid || '';
    const canonical = rawLink ? canonicalizeUrl(rawLink) : '';
    const isDuplicate =
      (canonical !== '' && existingUrlSet.has(canonical)) ||
      existingTitleSet.has(title.toLowerCase().trim());

    if (isDuplicate) {
      duplicatesSkipped += 1;
    }

    const rawExcerpt = stripHtmlTags(
      entry.contentSnippet || entry.summary || entry.content || ''
    );
    // Respect copyright permissions: store only permitted excerpt + source link when full text isn't licensed
    const maxChars = options.contentPermission === 'full_authorized' || options.contentPermission === 'public_domain' ? 4000 : 850;
    const excerpt = rawExcerpt.slice(0, maxChars) || `${title} — Reported by ${options.sourceName}.`;
    const summary = excerpt.slice(0, 320);

    const publishedIso = entry.isoDate || (entry.pubDate ? new Date(entry.pubDate).toISOString() : collectedAt);
    const detectedLang = detectLanguageHeuristic(`${title} ${summary}`, options.defaultLanguage || 'en');
    const categories = Array.isArray(entry.categories)
      ? entry.categories
          .map((c) => (typeof c === 'string' ? c : (c as { _?: string })?._ || ''))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const enclosureUrl =
      entry.enclosure?.url && /^https?:\/\//i.test(entry.enclosure.url) ? entry.enclosure.url : '';

    const fingerprint = computeFingerprint(canonical || title, title);
    const uniqueSlug = `${slugify(title)}-${fingerprint.slice(0, 6)}`;

    items.push({
      externalId: fingerprint,
      fingerprint,
      title,
      slug: uniqueSlug,
      summary: summary.length >= 10 ? summary : `${title} — Summary via ${options.sourceName}.`,
      content:
        options.contentPermission === 'excerpt_and_link'
          ? `${excerpt}\n\n[Source Attribution] Full original publication is hosted by ${options.sourceName}. Use the original source link to read the complete edition.`
          : excerpt,
      originalSource: options.sourceName || feed.title || 'External RSS Source',
      originalSourceUrl: rawLink,
      canonicalUrl: canonical,
      authorName: stripHtmlTags(entry.creator || (entry as { author?: string }).author || options.sourceName || 'Staff Desk').slice(0, 120),
      publishedAt: publishedIso,
      collectedAt,
      language: detectedLang,
      tags: categories,
      featuredImage: enclosureUrl,
      isDuplicate,
    });
  }

  return {
    feedTitle: stripHtmlTags(feed.title || options.sourceName),
    feedDescription: stripHtmlTags(feed.description || ''),
    itemsFetched: items.length,
    itemsNew: items.filter((i) => !i.isDuplicate).length,
    duplicatesSkipped,
    items,
  };
}

export async function fetchAuthorizedJsonApi(options: {
  apiEndpoint: string;
  sourceName: string;
  defaultLanguage?: string;
  contentPermission?: string;
  existingCanonicalUrls?: string[];
  existingTitles?: string[];
  maxItems?: number;
}): Promise<FeedFetchResult> {
  const validatedUrl = await validateSafeExternalUrl(options.apiEndpoint);
  const response = await fetch(validatedUrl.toString(), {
    method: 'GET',
    redirect: 'follow',
    signal: AbortSignal.timeout(12000),
    headers: {
      'User-Agent': 'AllInformationHubBot/1.0 (Authorized API Client)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Authorized API returned HTTP ${response.status}`);
  }

  if (response.url && response.url !== validatedUrl.toString()) {
    await validateSafeExternalUrl(response.url);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const candidates: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data.articles)
      ? data.articles
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.data)
            ? data.data
            : [];

  const existingUrlSet = new Set((options.existingCanonicalUrls || []).map((u) => canonicalizeUrl(u)));
  const existingTitleSet = new Set((options.existingTitles || []).map((t) => t.toLowerCase().trim()));
  const collectedAt = new Date().toISOString();
  const limit = Math.min(options.maxItems || 12, 25);

  const items: IngestedItem[] = [];
  let duplicatesSkipped = 0;

  for (const raw of candidates.slice(0, limit)) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const title = stripHtmlTags(String(rec.title || rec.headline || rec.name || '')).slice(0, 280);
    if (!title || title.length < 4) continue;

    const rawLink = String(rec.url || rec.link || rec.webUrl || '');
    const canonical = rawLink ? canonicalizeUrl(rawLink) : '';
    const isDuplicate =
      (canonical !== '' && existingUrlSet.has(canonical)) ||
      existingTitleSet.has(title.toLowerCase().trim());

    if (isDuplicate) duplicatesSkipped += 1;

    const summaryRaw = stripHtmlTags(String(rec.description || rec.summary || rec.abstract || rec.excerpt || title));
    const summary = summaryRaw.slice(0, 320);
    const bodyRaw = stripHtmlTags(String(rec.content || rec.body || summaryRaw));
    const excerpt = bodyRaw.slice(0, 900);
    const publishedAt = String(rec.publishedAt || rec.published_at || rec.date || collectedAt);
    const detectedLang = detectLanguageHeuristic(`${title} ${summary}`, options.defaultLanguage || 'en');
    const fingerprint = computeFingerprint(canonical || title, title);

    items.push({
      externalId: fingerprint,
      fingerprint,
      title,
      slug: `${slugify(title)}-${fingerprint.slice(0, 6)}`,
      summary: summary.length >= 10 ? summary : `${title} — Indexed via ${options.sourceName}.`,
      content: `${excerpt}\n\n[Source Attribution] Collected via authorized API from ${options.sourceName}.`,
      originalSource: options.sourceName,
      originalSourceUrl: rawLink,
      canonicalUrl: canonical,
      authorName: stripHtmlTags(String(rec.author || options.sourceName)).slice(0, 120),
      publishedAt,
      collectedAt,
      language: detectedLang,
      tags: Array.isArray(rec.tags) ? rec.tags.map(String).slice(0, 8) : [],
      featuredImage: typeof rec.urlToImage === 'string' && /^https?:\/\//i.test(rec.urlToImage) ? rec.urlToImage : '',
      isDuplicate,
    });
  }

  return {
    feedTitle: options.sourceName,
    feedDescription: `Authorized JSON API feed (${validatedUrl.hostname})`,
    itemsFetched: items.length,
    itemsNew: items.filter((i) => !i.isDuplicate).length,
    duplicatesSkipped,
    items,
  };
}
