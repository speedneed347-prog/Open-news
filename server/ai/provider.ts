import { GoogleGenAI, Type } from '@google/genai';

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

const DEFAULT_MODEL = 'gemini-4-hydrogen';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as T;
  }
}

export class GeminiAIProvider implements AIProvider {
  readonly name = 'Gemini (gemini-4-hydrogen)';

  async analyzeArticle(input: ArticleAnalysisInput): Promise<ArticleAnalysisResult> {
    const ai = createGeminiClient();
    const categoriesText = input.availableCategories
      .map((c) => `- id: "${c.id}", name: "${c.name}"${c.parentId ? `, parentId: "${c.parentId}"` : ''}`)
      .join('\n');

    const prompt = [
      'Analyze the following article/document strictly based on its provided text.',
      'Rules:',
      '- Never invent facts, statistics, quotes, or sources not present in the text.',
      '- Never claim the article is fact-checked or verified.',
      '- Choose the best matching category ID from the provided catalog list.',
      '',
      'AVAILABLE CATEGORIES:',
      categoriesText || '- id: "general-knowledge", name: "General Knowledge"',
      '',
      `ORIGINAL SOURCE: ${input.originalSource || 'Unspecified'}`,
      `TITLE: ${input.title}`,
      `CONTENT:\n${input.content.slice(0, 14000)}`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an editorial intelligence assistant for ALL INFORMATION HUB. Summarize objectively without inventing facts, preserve source attribution, and classify accurately against the supplied database categories.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'Objective 2-3 sentence editorial summary.' },
            shortBrief: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 concise bullet takeaways.',
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '5 to 10 key index terms.',
            },
            detectedLanguage: { type: Type.STRING, description: 'ISO 639-1 language code like en, bn, hi.' },
            suggestedCategoryId: { type: Type.STRING, description: 'Exact category id from the available list.' },
            suggestedCategoryName: { type: Type.STRING, description: 'Display name of the suggested category.' },
            suggestedSubcategoryId: { type: Type.STRING, description: 'Matching subcategory id or empty string.' },
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 5 broader knowledge-discovery topics.',
            },
          },
          required: [
            'summary',
            'shortBrief',
            'keywords',
            'detectedLanguage',
            'suggestedCategoryId',
            'suggestedCategoryName',
            'suggestedSubcategoryId',
            'topics',
          ],
        },
      },
    });

    const parsed = safeJsonParse<Omit<ArticleAnalysisResult, 'aiLabel' | 'provider'>>(response.text, {
      summary: input.content.slice(0, 260),
      shortBrief: [],
      keywords: [],
      detectedLanguage: 'en',
      suggestedCategoryId: input.availableCategories[0]?.id || 'national-news',
      suggestedCategoryName: input.availableCategories[0]?.name || 'National News',
      suggestedSubcategoryId: '',
      topics: [],
    });

    return {
      ...parsed,
      aiLabel: 'AI-Generated Analysis (Editorial review required; does not verify factual accuracy)',
      provider: this.name,
    };
  }

  async translateArticle(input: TranslationInput): Promise<TranslationResult> {
    const ai = createGeminiClient();
    const langLabels: Record<string, string> = {
      en: 'English',
      bn: 'Bengali (বাংলা)',
      hi: 'Hindi (हिन्दी)',
      es: 'Spanish',
      fr: 'French',
      ar: 'Arabic',
    };
    const targetName = langLabels[input.targetLanguage] || input.targetLanguage;

    const prompt = [
      `Translate the following editorial article faithfully from ${input.sourceLanguage} into ${targetName}.`,
      'Rules:',
      '- Preserve all proper nouns, dates, figures, citations, and original meaning.',
      '- Do not add, remove, or embellish facts.',
      '- Preserve paragraph breaks.',
      '',
      `TITLE: ${input.title}`,
      `SUBTITLE: ${input.subtitle || ''}`,
      `SUMMARY: ${input.summary}`,
      `CONTENT:\n${input.content.slice(0, 14000)}`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a faithful multilingual editorial translator. Preserve exact meaning and attributions without adding commentary.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subtitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ['title', 'subtitle', 'summary', 'content'],
        },
      },
    });

    const parsed = safeJsonParse<{ title: string; subtitle: string; summary: string; content: string }>(
      response.text,
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
      translationNotice: `AI Translation into ${targetName}. Original ${input.sourceLanguage.toUpperCase()} publication is preserved intact.`,
      provider: this.name,
    };
  }

  async compareSources(articles: ComparisonArticleInput[]): Promise<SourceComparisonResult> {
    const ai = createGeminiClient();
    const serialized = articles
      .slice(0, 6)
      .map(
        (a, idx) =>
          `[Source ${idx + 1}] ID: ${a.id} | Publisher: ${a.originalSource} | Published: ${a.publishedAt || 'Unknown'} | Collected: ${a.collectedAt || 'Unknown'}\nHeadline: ${a.title}\nSummary: ${a.summary}\nExcerpt: ${a.content.slice(0, 2500)}`
      )
      .join('\n\n---\n\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Compare how these publishers report on their topics:\n\n${serialized}`,
      config: {
        systemInstruction:
          'You are a media transparency analyst. Never assume multiple articles about similar topics describe the exact same event — state clearly whether they cover the same event or related developments. Highlight concrete reporting differences, shared corroborated points, and missing or conflicting details strictly from the provided texts.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sameEventAssessment: {
              type: Type.STRING,
              description: 'Explicit assessment of whether these articles cover the exact same event or distinct related developments.',
            },
            sharedFacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            reportingDifferences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  aspect: { type: Type.STRING },
                  details: { type: Type.STRING },
                },
                required: ['aspect', 'details'],
              },
            },
            missingOrConflictingDetails: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            publisherBreakdowns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  articleId: { type: Type.STRING },
                  publisher: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  angleSummary: { type: Type.STRING },
                },
                required: ['articleId', 'publisher', 'headline', 'angleSummary'],
              },
            },
          },
          required: [
            'sameEventAssessment',
            'sharedFacts',
            'reportingDifferences',
            'missingOrConflictingDetails',
            'publisherBreakdowns',
          ],
        },
      },
    });

    const parsed = safeJsonParse<Omit<SourceComparisonResult, 'disclaimer' | 'provider'>>(response.text, {
      sameEventAssessment: 'Unable to parse comparison output.',
      sharedFacts: [],
      reportingDifferences: [],
      missingOrConflictingDetails: [],
      publisherBreakdowns: [],
    });

    return {
      ...parsed,
      disclaimer:
        'AI-assisted comparative summary derived strictly from indexed records. Verify primary publisher links before drawing conclusions.',
      provider: this.name,
    };
  }

  async answerGroundedQuestion(input: GroundedQAInput): Promise<GroundedQAResult> {
    const ai = createGeminiClient();
    const corpus = input.articles
      .slice(0, 8)
      .map(
        (a) =>
          `ARTICLE_ID: ${a.id}\nSLUG: ${a.slug}\nTITLE: ${a.title}\nSOURCE: ${a.originalSource}\nURL: ${a.originalSourceUrl || ''}\nPUBLISHED: ${a.publishedAt || 'Unknown'}\nTEXT: ${a.summary}\n${a.content.slice(0, 2600)}`
      )
      .join('\n\n===\n\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `USER QUESTION: ${input.question}\n\nINDEXED DATABASE SOURCES:\n${corpus || 'No matching articles indexed.'}`,
      config: {
        systemInstruction:
          'You are a strict research assistant for ALL INFORMATION HUB. Answer ONLY using the provided INDEXED DATABASE SOURCES. Never invent facts, quotes, citations, or statistics. If the indexed sources do not contain enough information, set insufficientEvidence to true and explicitly state what is missing.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING, description: 'Clear, source-grounded answer referencing the publishers.' },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  articleId: { type: Type.STRING },
                  slug: { type: Type.STRING },
                  title: { type: Type.STRING },
                  source: { type: Type.STRING },
                  originalSourceUrl: { type: Type.STRING },
                  relevantQuote: { type: Type.STRING },
                },
                required: ['articleId', 'slug', 'title', 'source', 'relevantQuote'],
              },
            },
            insufficientEvidence: { type: Type.BOOLEAN },
          },
          required: ['answer', 'citations', 'insufficientEvidence'],
        },
      },
    });

    const parsed = safeJsonParse<Omit<GroundedQAResult, 'aiLabel' | 'provider'>>(response.text, {
      answer: 'The indexed database does not currently contain sufficient information to answer this question.',
      citations: [],
      insufficientEvidence: true,
    });

    return {
      ...parsed,
      aiLabel: 'AI-Assisted Research Answer grounded exclusively in indexed ALL INFORMATION HUB records',
      provider: this.name,
    };
  }

  async synthesizeTimeline(topic: string, articles: ComparisonArticleInput[]): Promise<TimelineSynthesisResult> {
    const ai = createGeminiClient();
    const corpus = articles
      .slice(0, 12)
      .map(
        (a) =>
          `TITLE: ${a.title} | SOURCE: ${a.originalSource} | ORIGINAL_PUBLISHED: ${a.publishedAt || 'Unknown'} | COLLECTED_AT: ${a.collectedAt || 'Unknown'} | SUMMARY: ${a.summary}`
      )
      .join('\n');

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Create a chronological timeline for the topic "${topic}" strictly from these indexed reports:\n\n${corpus}`,
      config: {
        systemInstruction:
          'Construct an accurate chronological timeline ordered from earliest to latest. Distinguish original publication date from platform collection time. Never invent dates or events not present in the provided reports.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            events: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  collectedAt: { type: Type.STRING },
                  headline: { type: Type.STRING },
                  description: { type: Type.STRING },
                  source: { type: Type.STRING },
                  eventType: { type: Type.STRING, description: 'e.g. Initial Report, Official Statement, Research Release, Update' },
                },
                required: ['date', 'headline', 'description', 'source', 'eventType'],
              },
            },
          },
          required: ['title', 'summary', 'events'],
        },
      },
    });

    const parsed = safeJsonParse<Omit<TimelineSynthesisResult, 'aiLabel' | 'provider'>>(response.text, {
      title: `${topic} — Chronological Timeline`,
      summary: 'Timeline compiled from indexed publications.',
      events: [],
    });

    return {
      ...parsed,
      aiLabel: 'AI-Compiled Chronology from Indexed Records',
      provider: this.name,
    };
  }

  async parseNaturalLanguageSearch(query: string, categoryNames: string[]): Promise<NaturalLanguageSearchResult> {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: `Convert this natural language information query into structured search filters.\nQuery: "${query}"\nAvailable Categories: ${categoryNames.join(', ')}`,
      config: {
        systemInstruction:
          'Extract concise keywords, best matching category name (or empty string if broad), contentType (one of "", "news", "research", "government_notification", "report", "historical_document", "educational_note", "statistical_info"), language code ("" or en/bn/hi), and topic tags.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: { type: Type.STRING },
            suggestedCategory: { type: Type.STRING },
            contentType: { type: Type.STRING },
            language: { type: Type.STRING },
            topics: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING },
          },
          required: ['keywords', 'suggestedCategory', 'contentType', 'language', 'topics', 'explanation'],
        },
      },
    });

    const parsed = safeJsonParse<Omit<NaturalLanguageSearchResult, 'provider'>>(response.text, {
      keywords: query,
      suggestedCategory: '',
      contentType: '',
      language: '',
      topics: [],
      explanation: 'Standard keyword search applied.',
    });

    return { ...parsed, provider: this.name };
  }
}

// Interchangeable AI provider factory (swap provider via AI_PROVIDER env var without rebuilding app)
export function getAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  switch (configured) {
    case 'gemini':
    default:
      return new GeminiAIProvider();
  }
}
