import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAIProvider } from './server/ai/provider.ts';
import { fetchAuthorizedJsonApi, fetchRssFeed } from './server/ingestion/feedService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Simple in-memory sliding-window rate limiter per IP
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before retrying.',
      });
    }
    bucket.count += 1;
    return next();
  };
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Basic security headers (iFrame compatible)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: 'ALL INFORMATION HUB',
      aiProvider: getAIProvider().name,
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // SEO: ROBOTS.TXT & XML SITEMAP
  // =========================================================================

  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /dashboard',
        'Disallow: /api/',
        `Sitemap: ${baseUrl.replace(/\/$/, '')}/sitemap.xml`,
      ].join('\n')
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const staticRoutes = [
      '/',
      '/latest',
      '/breaking',
      '/trending',
      '/national',
      '/international',
      '/state',
      '/categories',
      '/research',
      '/documents',
      '/publishers',
      '/sources',
      '/discover',
      '/timelines',
      '/compare',
      '/search',
      '/fact-check',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
    ];
    const lastmod = new Date().toISOString().split('T')[0];
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticRoutes.map(
        (route) =>
          `  <url><loc>${baseUrl}${route}</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq></url>`
      ),
      '</urlset>',
    ].join('\n');
    res.type('application/xml').send(xml);
  });

  // =========================================================================
  // AUTOMATIC INFORMATION COLLECTION ROUTES (SSRF-SAFE RSS & API)
  // =========================================================================

  app.post('/api/ingest/validate', rateLimit(20, 60_000), async (req, res) => {
    try {
      const { feedUrl, apiEndpoint, sourceName } = req.body as {
        feedUrl?: string;
        apiEndpoint?: string;
        sourceName?: string;
      };
      if (!feedUrl && !apiEndpoint) {
        return res.status(400).json({ error: 'Provide either feedUrl or apiEndpoint to validate.' });
      }
      const result = feedUrl
        ? await fetchRssFeed({
            feedUrl,
            sourceName: sourceName || 'Validation Preview',
            maxItems: 5,
          })
        : await fetchAuthorizedJsonApi({
            apiEndpoint: apiEndpoint!,
            sourceName: sourceName || 'API Validation Preview',
            maxItems: 5,
          });
      return res.json({ valid: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feed validation failed.';
      return res.status(400).json({ valid: false, error: message });
    }
  });

  app.post('/api/ingest/fetch', rateLimit(25, 60_000), async (req, res) => {
    try {
      const {
        feedUrl,
        apiEndpoint,
        sourceName,
        defaultLanguage,
        contentPermission,
        existingCanonicalUrls,
        existingTitles,
        maxItems,
      } = req.body as {
        feedUrl?: string;
        apiEndpoint?: string;
        sourceName?: string;
        defaultLanguage?: string;
        contentPermission?: string;
        existingCanonicalUrls?: string[];
        existingTitles?: string[];
        maxItems?: number;
      };

      if (!sourceName || (!feedUrl && !apiEndpoint)) {
        return res.status(400).json({ error: 'sourceName and either feedUrl or apiEndpoint are required.' });
      }

      const result = feedUrl
        ? await fetchRssFeed({
            feedUrl,
            sourceName,
            defaultLanguage,
            contentPermission,
            existingCanonicalUrls,
            existingTitles,
            maxItems,
          })
        : await fetchAuthorizedJsonApi({
            apiEndpoint: apiEndpoint!,
            sourceName,
            defaultLanguage,
            contentPermission,
            existingCanonicalUrls,
            existingTitles,
            maxItems,
          });

      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Automatic collection failed.';
      return res.status(502).json({ error: message });
    }
  });

  // =========================================================================
  // SERVER-SIDE AI INTELLIGENCE ROUTES (INTERCHANGEABLE PROVIDER)
  // =========================================================================

  app.post('/api/ai/analyze', rateLimit(20, 60_000), async (req, res) => {
    try {
      const { title, content, originalSource, availableCategories } = req.body as {
        title?: string;
        content?: string;
        originalSource?: string;
        availableCategories?: { id: string; name: string; parentId?: string }[];
      };
      if (!title || !content) {
        return res.status(400).json({ error: 'title and content are required.' });
      }
      const provider = getAIProvider();
      const analysis = await provider.analyzeArticle({
        title: String(title).slice(0, 300),
        content: String(content).slice(0, 15000),
        originalSource: originalSource ? String(originalSource).slice(0, 160) : undefined,
        availableCategories: Array.isArray(availableCategories) ? availableCategories.slice(0, 100) : [],
      });
      return res.json(analysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI analysis failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/translate', rateLimit(20, 60_000), async (req, res) => {
    try {
      const { title, subtitle, summary, content, sourceLanguage, targetLanguage } = req.body as {
        title?: string;
        subtitle?: string;
        summary?: string;
        content?: string;
        sourceLanguage?: string;
        targetLanguage?: string;
      };
      if (!title || !content || !targetLanguage) {
        return res.status(400).json({ error: 'title, content, and targetLanguage are required.' });
      }
      const provider = getAIProvider();
      const translated = await provider.translateArticle({
        title: String(title).slice(0, 300),
        subtitle: subtitle ? String(subtitle).slice(0, 400) : '',
        summary: summary ? String(summary).slice(0, 2000) : '',
        content: String(content).slice(0, 15000),
        sourceLanguage: String(sourceLanguage || 'en').slice(0, 16),
        targetLanguage: String(targetLanguage).slice(0, 16),
      });
      return res.json(translated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI translation failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/compare', rateLimit(15, 60_000), async (req, res) => {
    try {
      const { articles } = req.body as { articles?: unknown[] };
      if (!Array.isArray(articles) || articles.length < 2) {
        return res.status(400).json({ error: 'Provide at least 2 articles to compare.' });
      }
      const provider = getAIProvider();
      const comparison = await provider.compareSources(articles as Parameters<typeof provider.compareSources>[0]);
      return res.json(comparison);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Source comparison failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/qa', rateLimit(25, 60_000), async (req, res) => {
    try {
      const { question, articles } = req.body as { question?: string; articles?: unknown[] };
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'question is required.' });
      }
      const provider = getAIProvider();
      const result = await provider.answerGroundedQuestion({
        question: question.slice(0, 500),
        articles: Array.isArray(articles) ? (articles as Parameters<typeof provider.answerGroundedQuestion>[0]['articles']) : [],
      });
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Grounded Q&A failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/timeline', rateLimit(15, 60_000), async (req, res) => {
    try {
      const { topic, articles } = req.body as { topic?: string; articles?: unknown[] };
      if (!topic || !Array.isArray(articles) || articles.length === 0) {
        return res.status(400).json({ error: 'topic and at least one indexed article are required.' });
      }
      const provider = getAIProvider();
      const timeline = await provider.synthesizeTimeline(
        String(topic).slice(0, 120),
        articles as Parameters<typeof provider.synthesizeTimeline>[1]
      );
      return res.json(timeline);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Timeline synthesis failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/nl-search', rateLimit(30, 60_000), async (req, res) => {
    try {
      const { query, categoryNames } = req.body as { query?: string; categoryNames?: string[] };
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'query is required.' });
      }
      const provider = getAIProvider();
      const structured = await provider.parseNaturalLanguageSearch(
        query.slice(0, 300),
        Array.isArray(categoryNames) ? categoryNames.map(String).slice(0, 60) : []
      );
      return res.json(structured);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Natural language search parsing failed.';
      return res.status(500).json({ error: message });
    }
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC HOSTING
  // =========================================================================

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ALL INFORMATION HUB server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ALL INFORMATION HUB server:', err);
  process.exit(1);
});
