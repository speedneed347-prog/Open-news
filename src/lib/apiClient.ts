export interface IngestedFeedItem {
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

export interface FeedFetchResponse {
  valid?: boolean;
  feedTitle: string;
  feedDescription: string;
  itemsFetched: number;
  itemsNew: number;
  duplicatesSkipped: number;
  items: IngestedFeedItem[];
}

export interface AIAnalysisResponse {
  summary: string;
  shortBrief: string[];
  keywords: string[];
  detectedLanguage: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  suggestedSubcategoryId: string;
  topics: string[];
  aiLabel: string;
  provider: string;
}

export interface AITranslationResponse {
  targetLanguage: string;
  sourceLanguage: string;
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  translationNotice: string;
  provider: string;
}

export interface AIComparisonResponse {
  sameEventAssessment: string;
  sharedFacts: string[];
  reportingDifferences: { aspect: string; details: string }[];
  missingOrConflictingDetails: string[];
  publisherBreakdowns: {
    articleId: string;
    publisher: string;
    headline: string;
    angleSummary: string;
  }[];
  disclaimer: string;
  provider: string;
}

export interface AIQAResponse {
  answer: string;
  citations: {
    articleId: string;
    slug: string;
    title: string;
    source: string;
    originalSourceUrl?: string;
    relevantQuote: string;
  }[];
  insufficientEvidence: boolean;
  aiLabel: string;
  provider: string;
}

export interface AITimelineResponse {
  title: string;
  summary: string;
  events: {
    date: string;
    collectedAt?: string;
    headline: string;
    description: string;
    source: string;
    eventType: string;
  }[];
  aiLabel: string;
  provider: string;
}

export interface AINLSearchResponse {
  keywords: string;
  suggestedCategory: string;
  contentType: string;
  language: string;
  topics: string[];
  explanation: string;
  provider: string;
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const apiClient = {
  validateFeed: (payload: { feedUrl?: string; apiEndpoint?: string; sourceName?: string }) =>
    postJson<FeedFetchResponse>('/api/ingest/validate', payload),

  fetchSourceFeed: (payload: {
    feedUrl?: string;
    apiEndpoint?: string;
    sourceName: string;
    defaultLanguage?: string;
    contentPermission?: string;
    existingCanonicalUrls?: string[];
    existingTitles?: string[];
    maxItems?: number;
  }) => postJson<FeedFetchResponse>('/api/ingest/fetch', payload),

  analyzeArticle: (payload: {
    title: string;
    content: string;
    originalSource?: string;
    availableCategories: { id: string; name: string; parentId?: string }[];
  }) => postJson<AIAnalysisResponse>('/api/ai/analyze', payload),

  translateArticle: (payload: {
    title: string;
    subtitle?: string;
    summary: string;
    content: string;
    sourceLanguage: string;
    targetLanguage: string;
  }) => postJson<AITranslationResponse>('/api/ai/translate', payload),

  compareSources: (articles: {
    id: string;
    title: string;
    originalSource: string;
    originalSourceUrl?: string;
    publishedAt?: string;
    collectedAt?: string;
    summary: string;
    content: string;
  }[]) => postJson<AIComparisonResponse>('/api/ai/compare', { articles }),

  askGroundedQuestion: (payload: {
    question: string;
    articles: {
      id: string;
      slug: string;
      title: string;
      originalSource: string;
      originalSourceUrl?: string;
      publishedAt?: string;
      summary: string;
      content: string;
    }[];
  }) => postJson<AIQAResponse>('/api/ai/qa', payload),

  synthesizeTimeline: (payload: {
    topic: string;
    articles: {
      id: string;
      title: string;
      originalSource: string;
      publishedAt?: string;
      collectedAt?: string;
      summary: string;
      content: string;
    }[];
  }) => postJson<AITimelineResponse>('/api/ai/timeline', payload),

  parseNaturalLanguageSearch: (payload: { query: string; categoryNames: string[] }) =>
    postJson<AINLSearchResponse>('/api/ai/nl-search', payload),
};
