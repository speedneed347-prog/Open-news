/**
 * Firebase Cloud Functions v2 — ALL INFORMATION HUB
 * Scheduled RSS/API Information Collector & Editorial Pipeline Triggers
 *
 * Deploy with:
 *   cd functions && npm install && firebase deploy --only functions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Parser from 'rss-parser';
import crypto from 'node:crypto';

initializeApp();
const db = getFirestore();
const parser = new Parser({ timeout: 12000 });

function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((k) =>
      url.searchParams.delete(k)
    );
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Scheduled Automatic Collector — runs every 30 minutes via Cloud Scheduler.
 * Fetches all active sources whose rssFeedUrl is configured, performs duplicate
 * detection via canonicalUrl hash, respects publisher copyright permissions,
 * and saves items to `articles` in `pending_review` (or `published` only if
 * explicitly authorized by Admin `autoPublishEligible: true`).
 */
export const scheduledSourceIngestion = onSchedule('every 30 minutes', async () => {
  const sourcesSnap = await db.collection('sources').where('status', '==', 'active').get();
  const settingsDoc = await db.collection('site_settings').doc('public').get();
  const defaultRequireApproval = settingsDoc.exists
    ? settingsDoc.data()?.defaultRequireApproval !== false
    : true;

  for (const sourceDoc of sourcesSnap.docs) {
    const source = sourceDoc.data();
    if (!source.rssFeedUrl) continue;

    let itemsFetched = 0;
    let itemsImported = 0;
    let duplicatesSkipped = 0;
    let errorMessage = '';

    try {
      const feed = await parser.parseURL(source.rssFeedUrl);
      const entries = (feed.items || []).slice(0, 15);
      itemsFetched = entries.length;

      for (const entry of entries) {
        const title = (entry.title || '').trim().slice(0, 280);
        const link = entry.link || '';
        if (!title || !link) continue;

        const canonicalUrl = canonicalizeUrl(link);
        const docId = 'rss_' + crypto.createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 20);
        const existing = await db.collection('articles').doc(docId).get();

        if (existing.exists) {
          duplicatesSkipped += 1;
          continue;
        }

        const summary = (entry.contentSnippet || entry.summary || title).replace(/<[^>]+>/g, '').trim().slice(0, 360);
        const editorialStatus = !defaultRequireApproval && source.autoPublishEligible ? 'published' : 'pending_review';
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)}-${docId.slice(4, 10)}`;

        await db.collection('articles').doc(docId).set({
          title,
          slug,
          summary,
          content: `${summary}\n\n[Source Attribution] Collected via scheduled RSS ingestion from ${source.name}.`,
          contentType: source.sourceType === 'research_journal' ? 'research' : 'news',
          originalSource: source.name,
          originalSourceUrl: link,
          canonicalUrl,
          authorName: entry.creator || source.name,
          authorUid: 'system_scheduler',
          categoryId: source.defaultCategoryId || 'international-news',
          tags: Array.isArray(entry.categories) ? entry.categories.slice(0, 8) : [],
          topics: [],
          country: source.country || 'Global',
          language: source.language || 'en',
          publishedAt: entry.isoDate || new Date().toISOString(),
          collectedAt: new Date().toISOString(),
          collectionMethod: 'rss',
          copyrightPermissionStatus: source.contentPermission || 'excerpt_and_link',
          editorialStatus,
          factCheckStatus: 'unverified',
          isBreaking: false,
          isFeatured: false,
          isSampleData: false,
          viewCount: 0,
          aiProcessed: false,
          sourceId: sourceDoc.id,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        itemsImported += 1;
      }

      await sourceDoc.ref.update({
        lastFetchTime: new Date().toISOString(),
        errorStatus: '',
        totalImported: FieldValue.increment(itemsImported),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Scheduled fetch error';
      await sourceDoc.ref.update({
        status: 'error',
        errorStatus: errorMessage.slice(0, 480),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await db.collection('ingestion_logs').add({
      sourceId: sourceDoc.id,
      sourceName: source.name,
      triggeredByUid: 'system_scheduler',
      status: errorMessage ? 'failed' : 'success',
      itemsFetched,
      itemsImported,
      duplicatesSkipped,
      errorMessage,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
});

/**
 * Audit trigger whenever a new article enters the pipeline.
 */
export const onArticleCreatedAudit = onDocumentCreated('articles/{articleId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  await db.collection('audit_logs').add({
    actorUid: data.authorUid || 'system',
    actorEmail: 'pipeline@allinformationhub.local',
    actorRole: data.collectionMethod === 'manual' ? 'editor' : 'scheduler',
    action: 'ARTICLE_CREATED',
    targetType: 'article',
    targetId: event.params.articleId,
    details: `${data.title} (${data.collectionMethod} -> ${data.editorialStatus})`,
    createdAt: FieldValue.serverTimestamp(),
  });
});
