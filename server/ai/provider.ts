export interface ArticleAnalysisInput {
  title: string;
  content: string;
  originalSource?: string;
  availableCategories: { id: string; name: string; parentId?: string }[];
}

export interface ArticleAnalysisResult {
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

export interface TranslationInput {
  title: string;
  subtitle?: string;
  summary: string;
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResult {
  targetLanguage: string;
  sourceLanguage: string;
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  translationNotice: string;
  provider: string;
}

export interface ComparisonArticleInput {
  id: string;
  title: string;
  originalSource: string;
  originalSourceUrl?: string;
  publishedAt?: string;
  collectedAt?: string;
  summary: string;
  content: string;
}

export interface SourceComparisonResult {
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

export interface GroundedQAInput {
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
}

export interface GroundedQAResult {
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

export interface TimelineSynthesisResult {
  title: string;
  summary: string;
  events: {
    date: string;
    collectedAt?: string;
    headline: string;
    description: string;
    source: string;
    eventType: string;
    articleSlug?: string;
  }[];
  aiLabel: string;
  provider: string;
}

export interface NaturalLanguageSearchResult {
  keywords: string;
  suggestedCategory: string;
  contentType: string;
  language: string;
  topics: string[];
  explanation: string;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResult>;
  translateArticle(input: TranslationInput): Promise<TranslationResult>;
  compareSources(articles: ComparisonArticleInput[]): Promise<SourceComparisonResult>;
  answerGroundedQuestion(input: GroundedQAInput): Promise<GroundedQAResult>;
  synthesizeTimeline(topic: string, articles: ComparisonArticleInput[]): Promise<TimelineSynthesisResult>;
  parseNaturalLanguageSearch(query: string, categoryNames: string[]): Promise<NaturalLanguageSearchResult>;
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'were', 'been',
  'will', 'would', 'could', 'should', 'about', 'after', 'before', 'into', 'over',
  'under', 'their', 'there', 'which', 'while', 'where', 'when', 'what', 'whose',
  'also', 'more', 'most', 'some', 'such', 'than', 'then', 'they', 'them', 'these',
  'those', 'very', 'only', 'other', 'each', 'many', 'much', 'between', 'through',
  'during', 'including', 'against', 'among', 'across', 'around', 'using', 'based',
  'being', 'make', 'made', 'said', 'says', 'according', 'report', 'reported',
  'reports', 'news', 'article', 'source', 'year', 'years', 'month', 'week', 'today',
  'show', 'shows', 'data', 'percent', 'india', 'global', 'world', 'state', 'national',
]);

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  bn: 'Bengali (বাংলা)',
  hi: 'Hindi (हिन्दी)',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
};

function sanitizeEndpointUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Open-source AI endpoint URL must use http:// or https://.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(fenced) as T;
    } catch {
      const start = fenced.indexOf('{');
      const end = fenced.lastIndexOf('}');
      if (start !== -1 && end > start) {
        try {
          return JSON.parse(fenced.slice(start, end + 1)) as T;
        } catch {
          return fallback;
        }
      }
      return fallback;
    }
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  const cleaned = stripMarkdown(text);
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);
}

function tokenize(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff\u0900-\u097f\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function detectLanguageHeuristic(text: string): string {
  const bengali = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  if (bengali >= 12 && bengali > devanagari) return 'bn';
  if (devanagari >= 12 && devanagari >= bengali) return 'hi';
  if (arabic >= 12) return 'ar';
  return 'en';
}

function extractTopKeywords(text: string, maxCount = 8): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word);
}

function scoreSentences(title: string, content: string): { sentence: string; score: number; index: number }[] {
  const sentences = splitSentences(content);
  if (sentences.length === 0) return [];
  const titleTokens = new Set(tokenize(title));
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokenize(s)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    let score = 0;
    for (const w of words) {
      score += freq.get(w) || 0;
      if (titleTokens.has(w)) score += 3;
    }
    const normalized = words.length > 0 ? score / Math.sqrt(words.length) : 0;
    const positionBoost = index === 0 ? 1.35 : index < 3 ? 1.15 : 1.0;
    return { sentence, score: normalized * positionBoost, index };
  });
}

function titleCase(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// ============================================================================
// 1. BUILT-IN OPEN-SOURCE LOCAL NLP PROVIDER (ZERO PROPRIETARY APIS)
// ============================================================================

export class LocalOpenSourceNLPProvider implements AIProvider {
  readonly name = 'Open-Source Local NLP Engine (Extractive TF-IDF + Lexical)';

  async analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResult> {
    const fullText = `${input.title}. ${input.content}`;
    const detectedLanguage = detectLanguageHeuristic(fullText);
    const ranked = scoreSentences(input.title, input.content);
    const topForSummary = [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.sentence);

    const summary =
      topForSummary.join(' ') || stripMarkdown(input.content).slice(0, 320) || input.title;

    const shortBrief = [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .sort((a, b) => a.index - b.index)
      .map((item) => (item.sentence.length > 200 ? `${item.sentence.slice(0, 197)}...` : item.sentence));

    const keywords = extractTopKeywords(fullText, 8);
    const tokenSet = new Set(tokenize(fullText));

    // Match against database-driven categories
    let bestCat = input.availableCategories[0] || { id: 'general-knowledge', name: 'General Knowledge' };
    let bestScore = -1;
    let bestSubId = '';

    for (const cat of input.availableCategories) {
      const catTokens = tokenize(`${cat.name} ${cat.id.replace(/-/g, ' ')}`);
      let matchScore = 0;
      for (const ct of catTokens) {
        if (tokenSet.has(ct)) matchScore += 3;
        for (const kw of keywords) {
          if (kw.includes(ct) || ct.includes(kw)) matchScore += 1;
        }
      }
      if (matchScore > bestScore) {
        bestScore = matchScore;
        if (cat.parentId) {
          bestSubId = cat.id;
          const parent = input.availableCategories.find((c) => c.id === cat.parentId);
          bestCat = parent || cat;
        } else {
          bestCat = cat;
          bestSubId = '';
        }
      }
    }

    const topics = keywords.slice(0, 4).map(titleCase);

    return {
      summary,
      shortBrief: shortBrief.length > 0 ? shortBrief : [summary],
      keywords,
      detectedLanguage,
      suggestedCategoryId: bestCat.id,
      suggestedCategoryName: bestCat.name,
      suggestedSubcategoryId: bestSubId,
      topics,
      aiLabel:
        'Open-Source Extractive NLP Analysis (Derived strictly from article text; editorial review required)',
      provider: this.name,
    };
  }

  async translateArticle(input: TranslationInput): Promise<TranslationResult> {
    const targetName = LANG_LABELS[input.targetLanguage] || input.targetLanguage;

    // Optional open-source LibreTranslate integration (self-hosted or configured via LIBRETRANSLATE_URL)
    const libreUrl = process.env.LIBRETRANSLATE_URL;
    if (libreUrl) {
      const base = sanitizeEndpointUrl(libreUrl);
      const translateText = async (q: string): Promise<string> => {
        if (!q.trim()) return '';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
          const res = await fetch(`${base}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              q: q.slice(0, 8000),
              source: input.sourceLanguage || 'auto',
              target: input.targetLanguage,
              format: 'text',
              ...(process.env.LIBRETRANSLATE_API_KEY
                ? { api_key: process.env.LIBRETRANSLATE_API_KEY }
                : {}),
            }),
          });
          if (!res.ok) {
            throw new Error(`LibreTranslate responded with HTTP ${res.status}`);
          }
          const data = (await res.json()) as { translatedText?: string };
          return data.translatedText || q;
        } finally {
          clearTimeout(timeout);
        }
      };

      const [title, subtitle, summary, content] = await Promise.all([
        translateText(input.title),
        translateText(input.subtitle || ''),
        translateText(input.summary),
        translateText(input.content.slice(0, 8000)),
      ]);

      return {
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        title,
        subtitle,
        summary,
        content,
        translationNotice: `Open-Source LibreTranslate translation into ${targetName}. Original ${input.sourceLanguage.toUpperCase()} publication is preserved intact.`,
        provider: 'Open-Source LibreTranslate',
      };
    }

    // If source and target match, return faithfully without calling any external service
    if (input.sourceLanguage.toLowerCase() === input.targetLanguage.toLowerCase()) {
      return {
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        title: input.title,
        subtitle: input.subtitle || '',
        summary: input.summary,
        content: input.content,
        translationNotice: `Already published in ${targetName}. Original text preserved intact.`,
        provider: this.name,
      };
    }

    return {
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      title: input.title,
      subtitle: input.subtitle || '',
      summary: input.summary,
      content: input.content,
      translationNotice: `Neural translation into ${targetName} requires connecting an open-source model server (Ollama, Hugging Face Llama/Qwen/Mistral, vLLM) or LibreTranslate via server environment variables. Original ${input.sourceLanguage.toUpperCase()} text is preserved intact below.`,
      provider: this.name,
    };
  }

  async compareSources(articles: ComparisonArticleInput[]): Promise<SourceComparisonResult> {
    const subset = articles.slice(0, 6);
    const tokenSets = subset.map((a) => new Set(tokenize(`${a.title} ${a.summary} ${a.content}`)));

    // Compute pairwise Jaccard token overlap
    let overlapSum = 0;
    let pairs = 0;
    for (let i = 0; i < tokenSets.length; i++) {
      for (let j = i + 1; j < tokenSets.length; j++) {
        const a = tokenSets[i];
        const b = tokenSets[j];
        let inter = 0;
        for (const t of a) if (b.has(t)) inter++;
        const union = a.size + b.size - inter;
        overlapSum += union > 0 ? inter / union : 0;
        pairs++;
      }
    }
    const avgOverlap = pairs > 0 ? overlapSum / pairs : 0;

    // Shared terms across at least 2 publishers
    const docFreq = new Map<string, number>();
    for (const set of tokenSets) {
      for (const token of set) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }
    const sharedTerms = Array.from(docFreq.entries())
      .filter(([, count]) => count >= Math.min(2, subset.length))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word]) => word);

    const sameEventAssessment =
      avgOverlap >= 0.22
        ? `High lexical overlap (${Math.round(avgOverlap * 100)}%) across ${subset.length} sources indicates these reports likely cover the same core event or closely linked announcement (shared focus: ${sharedTerms.slice(0, 5).join(', ')}).`
        : avgOverlap >= 0.09
        ? `Moderate overlap (${Math.round(avgOverlap * 100)}%) suggests these ${subset.length} reports address related developments within a broader theme rather than identical single-event reporting.`
        : `Low lexical overlap (${Math.round(avgOverlap * 100)}%) indicates these ${subset.length} records cover distinct events or different analytical angles — do not assume they describe the exact same incident.`;

    // Extract sentences mentioning shared terms as corroborated context
    const sharedFacts: string[] = [];
    for (const art of subset) {
      const sentences = splitSentences(`${art.summary} ${art.content}`);
      const best = sentences.find((s) => {
        const st = new Set(tokenize(s));
        return sharedTerms.slice(0, 8).filter((t) => st.has(t)).length >= 2;
      });
      if (best && sharedFacts.length < 4) {
        sharedFacts.push(`[${art.originalSource}] ${best}`);
      }
    }
    if (sharedFacts.length === 0 && sharedTerms.length > 0) {
      sharedFacts.push(`Shared key themes across publishers: ${sharedTerms.slice(0, 8).join(', ')}.`);
    }

    // Extract unique angles & numeric figures per publisher
    const reportingDifferences: { aspect: string; details: string }[] = [];
    const missingOrConflictingDetails: string[] = [];

    for (let i = 0; i < subset.length; i++) {
      const art = subset[i];
      const uniqueTerms = Array.from(tokenSets[i])
        .filter((t) => (docFreq.get(t) || 0) === 1)
        .slice(0, 6);
      reportingDifferences.push({
        aspect: `${art.originalSource} — Distinct Emphasis`,
        details:
          uniqueTerms.length > 0
            ? `Highlights distinct terms not emphasized by the other selected sources: ${uniqueTerms.join(', ')}.`
            : `Focuses closely on the shared core framing: "${art.title}".`,
      });

      const numbers = (`${art.summary} ${art.content}`).match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
      if (numbers.length > 0) {
        missingOrConflictingDetails.push(
          `${art.originalSource} cites specific figures (${Array.from(new Set(numbers)).slice(0, 5).join(', ')}); cross-check against primary documents to confirm matching timeframes and units.`
        );
      }
    }

    if (missingOrConflictingDetails.length === 0) {
      missingOrConflictingDetails.push(
        'Selected excerpts did not contain directly contrasting statistics; review full original publisher links for complete context.'
      );
    }

    const publisherBreakdowns = subset.map((a) => ({
      articleId: a.id,
      publisher: a.originalSource,
      headline: a.title,
      angleSummary: a.summary.slice(0, 260) || splitSentences(a.content)[0] || a.title,
    }));

    return {
      sameEventAssessment,
      sharedFacts,
      reportingDifferences,
      missingOrConflictingDetails,
      publisherBreakdowns,
      disclaimer:
        'Open-source lexical comparison derived strictly from indexed records without external assumptions. Verify primary publisher links before drawing conclusions.',
      provider: this.name,
    };
  }

  async answerGroundedQuestion(input: GroundedQAInput): Promise<GroundedQAResult> {
    const qTokens = tokenize(input.question);
    if (qTokens.length === 0 || input.articles.length === 0) {
      return {
        answer:
          'The indexed ALL INFORMATION HUB records do not contain sufficient matching passages to answer this question.',
        citations: [],
        insufficientEvidence: true,
        aiLabel: 'Open-Source Extractive Grounded Q&A (Strictly from indexed records)',
        provider: this.name,
      };
    }

    const qSet = new Set(qTokens);
    const scoredPassages: {
      article: GroundedQAInput['articles'][number];
      sentence: string;
      score: number;
    }[] = [];

    for (const article of input.articles.slice(0, 10)) {
      const sentences = splitSentences(`${article.title}. ${article.summary} ${article.content}`);
      const titleTokens = new Set(tokenize(article.title));
      let titleBoost = 0;
      for (const qt of qSet) {
        if (titleTokens.has(qt)) titleBoost += 1.5;
      }

      for (const sentence of sentences) {
        const sTokens = new Set(tokenize(sentence));
        let hits = 0;
        for (const qt of qSet) {
          if (sTokens.has(qt)) hits += 2;
          else {
            for (const st of sTokens) {
              if (st.startsWith(qt) || qt.startsWith(st)) {
                hits += 0.75;
                break;
              }
            }
          }
        }
        if (hits > 0) {
          scoredPassages.push({ article, sentence, score: hits + titleBoost });
        }
      }
    }

    scoredPassages.sort((a, b) => b.score - a.score);
    const seenArticles = new Set<string>();
    const topMatches: typeof scoredPassages = [];
    for (const match of scoredPassages) {
      if (topMatches.length >= 4) break;
      if (!seenArticles.has(match.article.id) || topMatches.length < 2) {
        topMatches.push(match);
        seenArticles.add(match.article.id);
      }
    }

    if (topMatches.length === 0 || topMatches[0].score < 1.5) {
      return {
        answer:
          'Insufficient evidence in the currently indexed ALL INFORMATION HUB records to answer this question accurately. Try broadening your topic keywords or importing additional sources.',
        citations: [],
        insufficientEvidence: true,
        aiLabel: 'Open-Source Extractive Grounded Q&A (Strictly from indexed records)',
        provider: this.name,
      };
    }

    const answerLines = topMatches.map(
      (m) => `According to ${m.article.originalSource} ("${m.article.title}"): ${m.sentence}`
    );

    const citations = topMatches.map((m) => ({
      articleId: m.article.id,
      slug: m.article.slug,
      title: m.article.title,
      source: m.article.originalSource,
      originalSourceUrl: m.article.originalSourceUrl,
      relevantQuote: m.sentence.slice(0, 260),
    }));

    return {
      answer: answerLines.join('\n\n'),
      citations,
      insufficientEvidence: false,
      aiLabel: 'Open-Source Extractive Grounded Q&A (Quoted verbatim from indexed records)',
      provider: this.name,
    };
  }

  async synthesizeTimeline(topic: string, articles: ComparisonArticleInput[]): Promise<TimelineSynthesisResult> {
    const sorted = [...articles]
      .slice(0, 12)
      .sort(
        (a, b) =>
          new Date(a.publishedAt || a.collectedAt || 0).getTime() -
          new Date(b.publishedAt || b.collectedAt || 0).getTime()
      );

    const events = sorted.map((a, idx) => {
      const lower = `${a.title} ${a.originalSource}`.toLowerCase();
      let eventType = idx === 0 ? 'Initial Indexed Report' : 'Follow-up Coverage';
      if (lower.includes('ministry') || lower.includes('government') || lower.includes('pib') || lower.includes('court')) {
        eventType = 'Official Statement / Notice';
      } else if (lower.includes('study') || lower.includes('research') || lower.includes('journal') || lower.includes('nature') || lower.includes('nasa')) {
        eventType = 'Research Release';
      }
      return {
        date: a.publishedAt ? a.publishedAt.slice(0, 10) : 'Date Unspecified',
        collectedAt: a.collectedAt ? a.collectedAt.slice(0, 10) : undefined,
        headline: a.title,
        description: a.summary.slice(0, 260),
        source: a.originalSource,
        eventType,
      };
    });

    return {
      title: `${topic} — Chronological Timeline`,
      summary: `Chronology compiled strictly from ${events.length} indexed publications ordered from earliest original publication date to latest.`,
      events,
      aiLabel: 'Open-Source Chronology Engine (Compiled strictly from indexed publication dates)',
      provider: this.name,
    };
  }

  async parseNaturalLanguageSearch(query: string, categoryNames: string[]): Promise<NaturalLanguageSearchResult> {
    const lower = query.toLowerCase();
    const tokens = tokenize(query);

    let suggestedCategory = '';
    let bestOverlap = 0;
    for (const cat of categoryNames) {
      const catTokens = tokenize(cat);
      const overlap = catTokens.filter((ct) => lower.includes(ct)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        suggestedCategory = cat;
      }
    }

    let contentType = '';
    if (/\b(research|paper|study|journal|peer[- ]reviewed)\b/.test(lower)) contentType = 'research';
    else if (/\b(government|notification|gazette|notice|scheme|circular)\b/.test(lower)) contentType = 'government_notification';
    else if (/\b(report|whitepaper|pdf|document)\b/.test(lower)) contentType = 'report';
    else if (/\b(history|historical|archive|treaty|constitution)\b/.test(lower)) contentType = 'historical_document';
    else if (/\b(education|note|syllabus|guide|lesson)\b/.test(lower)) contentType = 'educational_note';
    else if (/\b(statistics|statistical|data|census|inflation|gdp)\b/.test(lower)) contentType = 'statistical_info';
    else if (/\b(news|breaking|latest|update)\b/.test(lower)) contentType = 'news';

    let language = '';
    if (/\b(bengali|bangla)\b/.test(lower) || /[\u0980-\u09FF]/.test(query)) language = 'bn';
    else if (/\b(hindi)\b/.test(lower) || /[\u0900-\u097F]/.test(query)) language = 'hi';
    else if (/\b(english)\b/.test(lower)) language = 'en';

    const keywords = tokens.slice(0, 6).join(' ') || query.trim();
    const topics = tokens.slice(0, 4).map(titleCase);

    return {
      keywords,
      suggestedCategory,
      contentType,
      language,
      topics,
      explanation: `Extracted open-source lexical filters${suggestedCategory ? ` (Category: ${suggestedCategory})` : ''}${contentType ? ` (Type: ${contentType})` : ''}${language ? ` (Language: ${language.toUpperCase()})` : ''}.`,
      provider: this.name,
    };
  }
}

// ============================================================================
// 2. OPEN-SOURCE LLM PROVIDER (OLLAMA / HUGGING FACE / VLLM / OPENAI-COMPAT)
// ============================================================================

interface OpenSourceLLMConfig {
  providerLabel: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export class OpenSourceLLMProvider implements AIProvider {
  readonly name: string;
  private readonly config: OpenSourceLLMConfig;
  private readonly fallback = new LocalOpenSourceNLPProvider();

  constructor(config: OpenSourceLLMConfig) {
    this.config = config;
    this.name = `${config.providerLabel} (${config.model})`;
  }

  private async chatJson<T>(systemPrompt: string, userPrompt: string, fallbackValue: T): Promise<T> {
    const endpoint = `${sanitizeEndpointUrl(this.config.baseUrl)}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'AllInformationHub-OpenSourceAI/1.0',
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: `${systemPrompt}\nAlways respond with strictly valid JSON matching the requested schema and no markdown prose outside the JSON object.`,
            },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Open-source LLM endpoint returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const rawContent = data.choices?.[0]?.message?.content;
      return safeJsonParse<T>(rawContent, fallbackValue);
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResult> {
    const localBaseline = await this.fallback.analyzeArticle(input);
    try {
      const categoriesText = input.availableCategories
        .map((c) => `- id: "${c.id}", name: "${c.name}"${c.parentId ? `, parentId: "${c.parentId}"` : ''}`)
        .join('\n');

      const prompt = [
        'Analyze the following article strictly from the provided text and return JSON with keys:',
        '{"summary": string, "shortBrief": string[], "keywords": string[], "detectedLanguage": string, "suggestedCategoryId": string, "suggestedCategoryName": string, "suggestedSubcategoryId": string, "topics": string[]}',
        'Rules: Never invent facts or claim factual verification. Pick suggestedCategoryId from AVAILABLE CATEGORIES.',
        '',
        'AVAILABLE CATEGORIES:',
        categoriesText || '- id: "general-knowledge", name: "General Knowledge"',
        '',
        `ORIGINAL SOURCE: ${input.originalSource || 'Unspecified'}`,
        `TITLE: ${input.title}`,
        `CONTENT:\n${input.content.slice(0, 12000)}`,
      ].join('\n');

      const parsed = await this.chatJson<Omit<ArticleAnalysisResult, 'aiLabel' | 'provider'>>(
        'You are an open-source editorial intelligence engine for ALL INFORMATION HUB.',
        prompt,
        {
          summary: localBaseline.summary,
          shortBrief: localBaseline.shortBrief,
          keywords: localBaseline.keywords,
          detectedLanguage: localBaseline.detectedLanguage,
          suggestedCategoryId: localBaseline.suggestedCategoryId,
          suggestedCategoryName: localBaseline.suggestedCategoryName,
          suggestedSubcategoryId: localBaseline.suggestedSubcategoryId,
          topics: localBaseline.topics,
        }
      );

      return {
        ...parsed,
        aiLabel: 'Open-Source AI Analysis (Editorial review required; does not verify factual accuracy)',
        provider: this.name,
      };
    } catch {
      return localBaseline;
    }
  }

  async translateArticle(input: TranslationInput): Promise<TranslationResult> {
    try {
      const targetName = LANG_LABELS[input.targetLanguage] || input.targetLanguage;
      const prompt = [
        `Translate this article faithfully from ${input.sourceLanguage} into ${targetName}.`,
        'Return JSON with keys: {"title": string, "subtitle": string, "summary": string, "content": string}.',
        'Preserve all proper nouns, dates, figures, citations, and paragraph breaks.',
        '',
        `TITLE: ${input.title}`,
        `SUBTITLE: ${input.subtitle || ''}`,
        `SUMMARY: ${input.summary}`,
        `CONTENT:\n${input.content.slice(0, 12000)}`,
      ].join('\n');

      const parsed = await this.chatJson<{
        title: string;
        subtitle: string;
        summary: string;
        content: string;
      }>(
        'You are a faithful multilingual open-source editorial translator.',
        prompt,
        {
          title: input.title,
          subtitle: input.subtitle || '',
          summary: input.summary,
          content: input.content,
        }
      );

      return {
        ...parsed,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        translationNotice: `Open-Source AI Translation into ${targetName}. Original ${input.sourceLanguage.toUpperCase()} publication is preserved intact.`,
        provider: this.name,
      };
    } catch {
      return this.fallback.translateArticle(input);
    }
  }

  async compareSources(articles: ComparisonArticleInput[]): Promise<SourceComparisonResult> {
    const localBaseline = await this.fallback.compareSources(articles);
    try {
      const serialized = articles
        .slice(0, 6)
        .map(
          (a, idx) =>
            `[Source ${idx + 1}] ID: ${a.id} | Publisher: ${a.originalSource} | Published: ${a.publishedAt || 'Unknown'}\nHeadline: ${a.title}\nSummary: ${a.summary}\nExcerpt: ${a.content.slice(0, 2200)}`
        )
        .join('\n\n---\n\n');

      const prompt = [
        'Compare how these publishers report on their topics and return JSON with keys:',
        '{"sameEventAssessment": string, "sharedFacts": string[], "reportingDifferences": [{"aspect": string, "details": string}], "missingOrConflictingDetails": string[], "publisherBreakdowns": [{"articleId": string, "publisher": string, "headline": string, "angleSummary": string}]}',
        'Never assume articles describe the exact same event without textual evidence.',
        '',
        serialized,
      ].join('\n');

      const parsed = await this.chatJson<Omit<SourceComparisonResult, 'disclaimer' | 'provider'>>(
        'You are an open-source media transparency analyst.',
        prompt,
        {
          sameEventAssessment: localBaseline.sameEventAssessment,
          sharedFacts: localBaseline.sharedFacts,
          reportingDifferences: localBaseline.reportingDifferences,
          missingOrConflictingDetails: localBaseline.missingOrConflictingDetails,
          publisherBreakdowns: localBaseline.publisherBreakdowns,
        }
      );

      return {
        ...parsed,
        disclaimer:
          'Open-source AI comparative summary derived strictly from indexed records. Verify primary publisher links before drawing conclusions.',
        provider: this.name,
      };
    } catch {
      return localBaseline;
    }
  }

  async answerGroundedQuestion(input: GroundedQAInput): Promise<GroundedQAResult> {
    const localBaseline = await this.fallback.answerGroundedQuestion(input);
    try {
      const corpus = input.articles
        .slice(0, 8)
        .map(
          (a) =>
            `ARTICLE_ID: ${a.id}\nSLUG: ${a.slug}\nTITLE: ${a.title}\nSOURCE: ${a.originalSource}\nURL: ${a.originalSourceUrl || ''}\nPUBLISHED: ${a.publishedAt || 'Unknown'}\nTEXT: ${a.summary}\n${a.content.slice(0, 2200)}`
        )
        .join('\n\n===\n\n');

      const prompt = [
        `USER QUESTION: ${input.question}`,
        'Answer ONLY from INDEXED DATABASE SOURCES. Return JSON:',
        '{"answer": string, "citations": [{"articleId": string, "slug": string, "title": string, "source": string, "originalSourceUrl": string, "relevantQuote": string}], "insufficientEvidence": boolean}',
        '',
        'INDEXED DATABASE SOURCES:',
        corpus || 'No matching articles indexed.',
      ].join('\n');

      const parsed = await this.chatJson<Omit<GroundedQAResult, 'aiLabel' | 'provider'>>(
        'You are an open-source strict research assistant. Never invent facts, quotes, or citations.',
        prompt,
        {
          answer: localBaseline.answer,
          citations: localBaseline.citations,
          insufficientEvidence: localBaseline.insufficientEvidence,
        }
      );

      return {
        ...parsed,
        aiLabel: 'Open-Source AI Research Answer grounded exclusively in indexed ALL INFORMATION HUB records',
        provider: this.name,
      };
    } catch {
      return localBaseline;
    }
  }

  async synthesizeTimeline(topic: string, articles: ComparisonArticleInput[]): Promise<TimelineSynthesisResult> {
    const localBaseline = await this.fallback.synthesizeTimeline(topic, articles);
    try {
      const corpus = articles
        .slice(0, 12)
        .map(
          (a) =>
            `TITLE: ${a.title} | SOURCE: ${a.originalSource} | ORIGINAL_PUBLISHED: ${a.publishedAt || 'Unknown'} | COLLECTED_AT: ${a.collectedAt || 'Unknown'} | SUMMARY: ${a.summary}`
        )
        .join('\n');

      const prompt = [
        `Build a chronological timeline for "${topic}" from earliest to latest and return JSON:`,
        '{"title": string, "summary": string, "events": [{"date": string, "collectedAt": string, "headline": string, "description": string, "source": string, "eventType": string}]}',
        'Never invent dates or events not present in the reports.',
        '',
        corpus,
      ].join('\n');

      const parsed = await this.chatJson<Omit<TimelineSynthesisResult, 'aiLabel' | 'provider'>>(
        'You are an open-source chronological synthesis assistant.',
        prompt,
        {
          title: localBaseline.title,
          summary: localBaseline.summary,
          events: localBaseline.events,
        }
      );

      return {
        ...parsed,
        aiLabel: 'Open-Source AI Compiled Chronology from Indexed Records',
        provider: this.name,
      };
    } catch {
      return localBaseline;
    }
  }

  async parseNaturalLanguageSearch(query: string, categoryNames: string[]): Promise<NaturalLanguageSearchResult> {
    const localBaseline = await this.fallback.parseNaturalLanguageSearch(query, categoryNames);
    try {
      const prompt = [
        `Convert this natural language query into structured search filters and return JSON:`,
        '{"keywords": string, "suggestedCategory": string, "contentType": string, "language": string, "topics": string[], "explanation": string}',
        `Query: "${query}"`,
        `Available Categories: ${categoryNames.join(', ')}`,
      ].join('\n');

      const parsed = await this.chatJson<Omit<NaturalLanguageSearchResult, 'provider'>>(
        'Extract concise keywords, matching category name, contentType, language (en/bn/hi or ""), and topics.',
        prompt,
        {
          keywords: localBaseline.keywords,
          suggestedCategory: localBaseline.suggestedCategory,
          contentType: localBaseline.contentType,
          language: localBaseline.language,
          topics: localBaseline.topics,
          explanation: localBaseline.explanation,
        }
      );

      return { ...parsed, provider: this.name };
    } catch {
      return localBaseline;
    }
  }
}

// ============================================================================
// 100% OPEN-SOURCE AI PROVIDER FACTORY
// Supports: Local NLP (default zero-key), Ollama, Hugging Face Inference Router
// (Llama 3 / Qwen / Mistral / Gemma), vLLM / llama.cpp OpenAI-compatible servers.
// ============================================================================

export function getAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER || 'auto').toLowerCase();

  if (configured === 'local') {
    return new LocalOpenSourceNLPProvider();
  }

  if (configured === 'ollama' || (configured === 'auto' && process.env.OLLAMA_BASE_URL)) {
    return new OpenSourceLLMProvider({
      providerLabel: 'Ollama Open-Source LLM',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
      model: process.env.OPENSOURCE_AI_MODEL || 'llama3.2',
      apiKey: process.env.OPENSOURCE_AI_API_KEY,
    });
  }

  if (configured === 'huggingface' || (configured === 'auto' && process.env.HF_TOKEN)) {
    const token = process.env.HF_TOKEN || process.env.OPENSOURCE_AI_API_KEY;
    if (token) {
      return new OpenSourceLLMProvider({
        providerLabel: 'Hugging Face Open-Weights',
        baseUrl: process.env.OPENSOURCE_AI_BASE_URL || 'https://router.huggingface.co/v1',
        model: process.env.OPENSOURCE_AI_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
        apiKey: token,
      });
    }
  }

  if (
    configured === 'openai_compatible' ||
    (configured === 'auto' && process.env.OPENSOURCE_AI_BASE_URL)
  ) {
    if (process.env.OPENSOURCE_AI_BASE_URL) {
      return new OpenSourceLLMProvider({
        providerLabel: 'Open-Source LLM Server',
        baseUrl: process.env.OPENSOURCE_AI_BASE_URL,
        model: process.env.OPENSOURCE_AI_MODEL || 'meta-llama/Llama-3.3-70B-Instruct',
        apiKey: process.env.OPENSOURCE_AI_API_KEY,
      });
    }
  }

  return new LocalOpenSourceNLPProvider();
}
