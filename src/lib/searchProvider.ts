import type { Article, ContentType } from '../types/models';

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  subcategoryId?: string;
  publisher?: string;
  author?: string;
  country?: string;
  language?: string;
  contentType?: ContentType | '';
  topic?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'newest' | 'oldest' | 'most_read';
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  items: Article[];
  total: number;
  page: number;
  totalPages: number;
  suggestions: string[];
  relatedTopics: string[];
  providerName: string;
}

/**
 * Pluggable Search Provider Abstraction.
 * Swap FirestoreLocalSearchProvider with TypesenseSearchProvider or MeilisearchProvider
 * without altering any UI component.
 */
export interface SearchProvider {
  readonly name: string;
  search(corpus: Article[], filters: SearchFilters): SearchResult;
  autocomplete(corpus: Article[], prefix: string): string[];
}

function scoreArticle(article: Article, tokens: string[]): number {
  if (!tokens.length) return 1;
  let score = 0;
  const title = article.title.toLowerCase();
  const subtitle = (article.subtitle || '').toLowerCase();
  const summary = article.summary.toLowerCase();
  const content = article.content.toLowerCase();
  const tags = (article.tags || []).join(' ').toLowerCase();
  const topics = (article.topics || []).join(' ').toLowerCase();
  const source = article.originalSource.toLowerCase();
  const author = article.authorName.toLowerCase();

  for (const token of tokens) {
    if (title.includes(token)) score += 10;
    if (subtitle.includes(token)) score += 6;
    if (topics.includes(token)) score += 6;
    if (tags.includes(token)) score += 5;
    if (source.includes(token) || author.includes(token)) score += 4;
    if (summary.includes(token)) score += 3;
    if (content.includes(token)) score += 1;
  }
  return score;
}

export class FirestoreLocalSearchProvider implements SearchProvider {
  readonly name = 'Indexed Firestore Search Engine';

  search(corpus: Article[], filters: SearchFilters): SearchResult {
    const queryClean = (filters.query || '').trim().toLowerCase();
    const tokens = queryClean ? queryClean.split(/\s+/).filter((w) => w.length >= 2) : [];

    const filtered = corpus.filter((a) => {
      if (filters.categoryId && a.categoryId !== filters.categoryId) return false;
      if (filters.subcategoryId && a.subcategoryId !== filters.subcategoryId) return false;
      if (
        filters.publisher &&
        !a.originalSource.toLowerCase().includes(filters.publisher.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.author &&
        !a.authorName.toLowerCase().includes(filters.author.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.country &&
        a.country.toLowerCase() !== filters.country.toLowerCase()
      ) {
        return false;
      }
      if (
        filters.language &&
        a.language.toLowerCase() !== filters.language.toLowerCase()
      ) {
        return false;
      }
      if (filters.contentType && a.contentType !== filters.contentType) return false;
      if (
        filters.topic &&
        !(a.topics || []).some((tp) => tp.toLowerCase() === filters.topic!.toLowerCase())
      ) {
        return false;
      }
      if (
        filters.tag &&
        !(a.tags || []).some((tg) => tg.toLowerCase() === filters.tag!.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateFrom && a.publishedAt) {
        if (new Date(a.publishedAt).getTime() < new Date(filters.dateFrom).getTime()) {
          return false;
        }
      }
      if (filters.dateTo && a.publishedAt) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(a.publishedAt).getTime() > end.getTime()) {
          return false;
        }
      }
      if (tokens.length > 0 && scoreArticle(a, tokens) === 0) {
        return false;
      }
      return true;
    });

    const scored = filtered.map((article) => ({
      article,
      score: scoreArticle(article, tokens),
    }));

    const sortBy = filters.sortBy || (tokens.length ? 'relevance' : 'newest');
    scored.sort((a, b) => {
      if (sortBy === 'relevance' && b.score !== a.score) return b.score - a.score;
      if (sortBy === 'most_read') return (b.article.viewCount || 0) - (a.article.viewCount || 0);
      const timeA = new Date(a.article.publishedAt || 0).getTime();
      const timeB = new Date(b.article.publishedAt || 0).getTime();
      return sortBy === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    const pageSize = Math.max(1, filters.pageSize || 10);
    const total = scored.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, filters.page || 1), totalPages);
    const start = (page - 1) * pageSize;
    const items = scored.slice(start, start + pageSize).map((s) => s.article);

    const topicCounts = new Map<string, number>();
    for (const s of scored) {
      for (const tp of s.article.topics || []) {
        topicCounts.set(tp, (topicCounts.get(tp) || 0) + 1);
      }
    }
    const relatedTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const suggestions = queryClean ? this.autocomplete(corpus, queryClean) : [];

    return {
      items,
      total,
      page,
      totalPages,
      suggestions,
      relatedTopics,
      providerName: this.name,
    };
  }

  autocomplete(corpus: Article[], prefix: string): string[] {
    const clean = prefix.trim().toLowerCase();
    if (clean.length < 2) return [];
    const matches = new Set<string>();
    for (const a of corpus) {
      for (const tp of a.topics || []) {
        if (tp.toLowerCase().includes(clean)) matches.add(tp);
      }
      for (const tg of a.tags || []) {
        if (tg.toLowerCase().includes(clean)) matches.add(tg);
      }
      if (a.title.toLowerCase().includes(clean)) {
        matches.add(a.title);
      }
      if (matches.size >= 6) break;
    }
    return Array.from(matches).slice(0, 6);
  }
}

export const searchProvider: SearchProvider = new FirestoreLocalSearchProvider();
