import type { Article } from '../types/models';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function updatePageSEO(options: {
  title: string;
  description: string;
  path?: string;
  article?: Article;
}) {
  const fullTitle = options.title.includes('ALL INFORMATION HUB')
    ? options.title
    : `${options.title} — ALL INFORMATION HUB`;
  document.title = fullTitle;

  const canonical =
    window.location.origin + (options.path || window.location.pathname);

  upsertMeta('name', 'description', options.description);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', options.description);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:type', options.article ? 'article' : 'website');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', options.description);
  upsertCanonical(canonical);

  const existingScript = document.getElementById('dynamic-json-ld');
  if (existingScript) {
    existingScript.remove();
  }

  if (options.article) {
    const a = options.article;
    const schemaType =
      a.contentType === 'research' || a.contentType === 'scientific_discovery'
        ? 'ScholarlyArticle'
        : 'NewsArticle';
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      headline: a.seoTitle || a.title,
      description: a.seoDescription || a.summary,
      datePublished: a.publishedAt || new Date().toISOString(),
      author: {
        '@type': 'Person',
        name: a.authorName,
      },
      publisher: {
        '@type': 'Organization',
        name: a.originalSource || 'ALL INFORMATION HUB',
      },
      inLanguage: a.language,
      mainEntityOfPage: canonical,
      keywords: [...(a.tags || []), ...(a.topics || [])].join(', '),
    };

    const script = document.createElement('script');
    script.id = 'dynamic-json-ld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }
}
