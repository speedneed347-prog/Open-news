import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_FACT_CHECKS,
  INITIAL_PUBLISHERS,
  INITIAL_SOURCES,
  INITIAL_TIMELINES,
  SAMPLE_ARTICLES,
} from './seedData';
import type {
  AdminRoleRecord,
  AdminRoleType,
  Article,
  ArticleVersion,
  AuditLogRecord,
  BookmarkRecord,
  Category,
  CommentRecord,
  FactCheckRecord,
  IngestionLog,
  Publisher,
  ReadingHistoryRecord,
  ReadingListRecord,
  SavedSearchRecord,
  SiteSettings,
  SourceConfig,
  TimelineRecord,
  UserProfile,
} from '../types/models';

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 120);
  return cleaned || `id_${Date.now().toString(36)}`;
}

export function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);
  return cleaned || `item-${Date.now().toString(36)}`;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return sanitizeId(`${prefix}_${Date.now().toString(36)}_${rand}`);
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function writeAuditLog(params: {
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  actorRole: string;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const id = generateDocId('audit');
  const path = `audit_logs/${id}`;
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      actorUid: user.uid,
      actorEmail: (user.email || 'staff@allinformationhub.local').slice(0, 250),
      actorRole: params.actorRole.slice(0, 58),
      action: params.action.slice(0, 118),
      targetType: params.targetType.slice(0, 78),
      targetId: sanitizeId(params.targetId),
      details: (params.details || '').slice(0, 990),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Audit log write skipped:', error);
  }
}

// ============================================================================
// DATABASE INITIALIZATION / SEEDING (ADMIN ONE-CLICK BATCH)
// ============================================================================

export async function seedDatabaseToFirestore(): Promise<{
  categories: number;
  articles: number;
  sources: number;
  publishers: number;
  factChecks: number;
  timelines: number;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in as an administrator to initialize Firestore.');

  const batch1 = writeBatch(db);
  for (const cat of INITIAL_CATEGORIES) {
    const ref = doc(db, 'categories', sanitizeId(cat.id));
    batch1.set(
      ref,
      stripUndefined({
        ...cat,
        id: undefined,
        slug: sanitizeSlug(cat.slug),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }
  for (const pub of INITIAL_PUBLISHERS) {
    const ref = doc(db, 'publishers', sanitizeId(pub.id));
    batch1.set(
      ref,
      stripUndefined({
        ...pub,
        id: undefined,
        slug: sanitizeSlug(pub.slug),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }
  for (const src of INITIAL_SOURCES) {
    const ref = doc(db, 'sources', sanitizeId(src.id));
    batch1.set(
      ref,
      stripUndefined({
        ...src,
        id: undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }

  try {
    await batch1.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_batch_1');
  }

  const batch2 = writeBatch(db);
  for (const art of SAMPLE_ARTICLES) {
    const ref = doc(db, 'articles', sanitizeId(art.id));
    batch2.set(
      ref,
      stripUndefined({
        ...art,
        id: undefined,
        authorUid: user.uid,
        slug: sanitizeSlug(art.slug),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }
  for (const fc of INITIAL_FACT_CHECKS) {
    const ref = doc(db, 'fact_checks', sanitizeId(fc.id));
    batch2.set(
      ref,
      stripUndefined({
        ...fc,
        id: undefined,
        reviewerUid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }
  for (const tl of INITIAL_TIMELINES) {
    const ref = doc(db, 'timelines', sanitizeId(tl.id));
    batch2.set(
      ref,
      stripUndefined({
        ...tl,
        id: undefined,
        slug: sanitizeSlug(tl.slug),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  }
  batch2.set(doc(db, 'site_settings', 'public'), {
    ...DEFAULT_SITE_SETTINGS,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch2.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_batch_2');
  }

  await writeAuditLog({
    action: 'INITIALIZE_DATABASE_CATALOG',
    targetType: 'system',
    targetId: 'firestore_seed',
    details: `Seeded ${INITIAL_CATEGORIES.length} categories, ${SAMPLE_ARTICLES.length} sample articles, ${INITIAL_SOURCES.length} RSS sources.`,
    actorRole: 'super_admin',
  });

  return {
    categories: INITIAL_CATEGORIES.length,
    articles: SAMPLE_ARTICLES.length,
    sources: INITIAL_SOURCES.length,
    publishers: INITIAL_PUBLISHERS.length,
    factChecks: INITIAL_FACT_CHECKS.length,
    timelines: INITIAL_TIMELINES.length,
  };
}

// ============================================================================
// USER PROFILE & RBAC
// ============================================================================

export async function ensureUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<{ profile: UserProfile; effectiveRole: string }> {
  const userRef = doc(db, 'users', user.uid);
  let profile: UserProfile | null = null;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      profile = snap.data() as UserProfile;
    } else {
      const newProfile: Record<string, unknown> = {
        uid: user.uid,
        email: (user.email || 'reader@example.com').slice(0, 250),
        displayName: (user.displayName || user.email?.split('@')[0] || 'Reader').slice(0, 118),
        photoURL: (user.photoURL || '').slice(0, 490),
        bio: '',
        role: 'reader',
        preferredLanguage: 'en',
        followedCategories: ['economy', 'science', 'technology'],
        followedTopics: ['Inflation', 'Artificial Intelligence'],
        followedPublishers: [],
        notificationPrefs: {
          breakingNews: true,
          followedCategories: true,
          followedTopics: true,
          governmentNotices: true,
          newResearch: false,
          personalizedDigest: true,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      profile = newProfile as unknown as UserProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }

  let effectiveRole: string = profile?.role || 'reader';
  if (user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()) {
    effectiveRole = 'super_admin';
  } else {
    try {
      const roleSnap = await getDoc(doc(db, 'admin_roles', user.uid));
      if (roleSnap.exists() && roleSnap.data().active === true) {
        effectiveRole = roleSnap.data().role as string;
      }
    } catch {
      // No elevated role doc
    }
  }

  return { profile: profile!, effectiveRole };
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'bio'
      | 'preferredLanguage'
      | 'followedCategories'
      | 'followedTopics'
      | 'followedPublishers'
      | 'notificationPrefs'
    >
  >
) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...stripUndefined(updates as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function assignAdminRole(payload: {
  uid: string;
  email: string;
  role: AdminRoleType;
  active: boolean;
}) {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Authentication required');
  const targetId = sanitizeId(payload.uid);
  const ref = doc(db, 'admin_roles', targetId);
  const path = `admin_roles/${targetId}`;
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        role: payload.role,
        active: payload.active,
        assignedBy: actor.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: targetId,
        email: payload.email.trim().slice(0, 250),
        role: payload.role,
        assignedBy: actor.uid,
        active: payload.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await writeAuditLog({
      action: 'ASSIGN_ROLE',
      targetType: 'admin_role',
      targetId,
      details: `${payload.email} -> ${payload.role} (active: ${payload.active})`,
      actorRole: 'super_admin',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllAdminRoles(): Promise<AdminRoleRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'admin_roles'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminRoleRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_roles');
  }
}

export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

// ============================================================================
// ARTICLES CRUD + REVISION HISTORY
// ============================================================================

export async function fetchPublishedArticles(): Promise<Article[]> {
  try {
    const q = query(collection(db, 'articles'), where('editorialStatus', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Article, 'id'>) }))
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'articles');
  }
}

export async function fetchAllArticlesForStaff(): Promise<Article[]> {
  try {
    const snap = await getDocs(collection(db, 'articles'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Article, 'id'>) }))
      .sort((a, b) => new Date(b.publishedAt || b.collectedAt || 0).getTime() - new Date(a.publishedAt || a.collectedAt || 0).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'articles');
  }
}

export async function saveArticle(
  article: Partial<Article> & {
    id?: string;
    title: string;
    summary: string;
    content: string;
    categoryId: string;
  },
  options?: { changeNote?: string; actorRole?: string }
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to save articles.');

  const isUpdate = Boolean(article.id);
  const id = article.id ? sanitizeId(article.id) : generateDocId('art');
  const ref = doc(db, 'articles', id);
  const slug = sanitizeSlug(article.slug || article.title);
  const nowIso = new Date().toISOString();

  try {
    if (isUpdate) {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const updatePayload = stripUndefined({
          title: article.title.trim().slice(0, 295),
          slug,
          subtitle: (article.subtitle || '').slice(0, 395),
          summary: article.summary.trim().slice(0, 1990),
          content: article.content.trim().slice(0, 119000),
          contentType: article.contentType || existing.data().contentType || 'article',
          originalSource: (article.originalSource || existing.data().originalSource || 'ALL INFORMATION HUB').slice(0, 155),
          originalSourceUrl: (article.originalSourceUrl || '').slice(0, 990),
          canonicalUrl: (article.canonicalUrl || '').slice(0, 990),
          authorName: (article.authorName || user.displayName || 'Editorial Desk').slice(0, 138),
          categoryId: sanitizeId(article.categoryId),
          subcategoryId: article.subcategoryId ? sanitizeId(article.subcategoryId) : '',
          tags: (article.tags || []).slice(0, 20),
          topics: (article.topics || []).slice(0, 15),
          country: (article.country || 'International').slice(0, 78),
          language: (article.language || 'en').slice(0, 15),
          featuredImage: (article.featuredImage || '').slice(0, 990),
          attachments: (article.attachments || []).slice(0, 15),
          publishedAt: article.editorialStatus === 'published' ? article.publishedAt || nowIso : article.publishedAt || '',
          scheduledAt: article.scheduledAt || '',
          copyrightPermissionStatus: article.copyrightPermissionStatus || existing.data().copyrightPermissionStatus || 'original',
          editorialStatus: article.editorialStatus || existing.data().editorialStatus || 'draft',
          factCheckStatus: article.factCheckStatus || existing.data().factCheckStatus || 'unverified',
          isBreaking: Boolean(article.isBreaking),
          isFeatured: Boolean(article.isFeatured),
          aiSummary: (article.aiSummary || '').slice(0, 1990),
          aiKeywords: (article.aiKeywords || []).slice(0, 20),
          aiProcessed: Boolean(article.aiProcessed),
          seoTitle: (article.seoTitle || article.title).slice(0, 158),
          seoDescription: (article.seoDescription || article.summary).slice(0, 315),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(ref, updatePayload);

        // Append editorial revision history snapshot
        const verId = generateDocId('ver');
        await setDoc(doc(db, 'articles', id, 'versions', verId), {
          articleId: id,
          versionNumber: Date.now() % 100000,
          title: article.title.trim().slice(0, 295),
          summary: article.summary.trim().slice(0, 1990),
          content: article.content.trim().slice(0, 119000),
          editorUid: user.uid,
          editorName: (user.displayName || user.email || 'Editor').slice(0, 118),
          changeNote: (options?.changeNote || 'Editorial update').slice(0, 390),
          editorialStatus: article.editorialStatus || 'draft',
          createdAt: serverTimestamp(),
        });

        await writeAuditLog({
          action: 'ARTICLE_UPDATED',
          targetType: 'article',
          targetId: id,
          details: `${article.title} -> ${article.editorialStatus || 'draft'} (${options?.changeNote || 'edited'})`,
          actorRole: options?.actorRole || 'editor',
        });

        return id;
      }
    }

    const createPayload = stripUndefined({
      title: article.title.trim().slice(0, 295),
      slug,
      subtitle: (article.subtitle || '').slice(0, 395),
      summary: article.summary.trim().slice(0, 1990),
      content: article.content.trim().slice(0, 119000),
      contentType: article.contentType || 'article',
      originalSource: (article.originalSource || 'ALL INFORMATION HUB').slice(0, 155),
      originalSourceUrl: (article.originalSourceUrl || '').slice(0, 990),
      canonicalUrl: (article.canonicalUrl || '').slice(0, 990),
      authorName: (article.authorName || user.displayName || 'Editorial Desk').slice(0, 138),
      authorUid: user.uid,
      categoryId: sanitizeId(article.categoryId),
      subcategoryId: article.subcategoryId ? sanitizeId(article.subcategoryId) : '',
      tags: (article.tags || []).slice(0, 20),
      topics: (article.topics || []).slice(0, 15),
      country: (article.country || 'International').slice(0, 78),
      language: (article.language || 'en').slice(0, 15),
      featuredImage: (article.featuredImage || '').slice(0, 990),
      attachments: (article.attachments || []).slice(0, 15),
      publishedAt: article.publishedAt || nowIso,
      collectedAt: article.collectedAt || nowIso,
      scheduledAt: article.scheduledAt || '',
      collectionMethod: article.collectionMethod || 'manual',
      copyrightPermissionStatus: article.copyrightPermissionStatus || 'original',
      editorialStatus: article.editorialStatus || 'draft',
      factCheckStatus: article.factCheckStatus || 'unverified',
      isBreaking: Boolean(article.isBreaking),
      isFeatured: Boolean(article.isFeatured),
      isSampleData: Boolean(article.isSampleData),
      viewCount: article.viewCount || 0,
      aiSummary: (article.aiSummary || '').slice(0, 1990),
      aiKeywords: (article.aiKeywords || []).slice(0, 20),
      aiProcessed: Boolean(article.aiProcessed),
      sourceId: article.sourceId ? sanitizeId(article.sourceId) : '',
      seoTitle: (article.seoTitle || article.title).slice(0, 158),
      seoDescription: (article.seoDescription || article.summary).slice(0, 315),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(ref, createPayload);

    // Save initial revision version
    const verId = generateDocId('ver');
    await setDoc(doc(db, 'articles', id, 'versions', verId), {
      articleId: id,
      versionNumber: 1,
      title: article.title.trim().slice(0, 295),
      summary: article.summary.trim().slice(0, 1990),
      content: article.content.trim().slice(0, 119000),
      editorUid: user.uid,
      editorName: (user.displayName || user.email || 'Editor').slice(0, 118),
      changeNote: (options?.changeNote || 'Initial creation').slice(0, 390),
      editorialStatus: article.editorialStatus || 'draft',
      createdAt: serverTimestamp(),
    });

    await writeAuditLog({
      action: 'ARTICLE_CREATED',
      targetType: 'article',
      targetId: id,
      details: `${article.title} (${article.collectionMethod || 'manual'} -> ${article.editorialStatus || 'draft'})`,
      actorRole: options?.actorRole || 'editor',
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `articles/${id}`);
  }
}

export async function updateArticleEditorialStatus(
  articleId: string,
  editorialStatus: Article['editorialStatus'],
  actorRole = 'editor'
) {
  const id = sanitizeId(articleId);
  try {
    const payload: Record<string, unknown> = {
      editorialStatus,
      updatedAt: serverTimestamp(),
    };
    if (editorialStatus === 'published') {
      payload.publishedAt = new Date().toISOString();
    }
    await updateDoc(doc(db, 'articles', id), payload);
    await writeAuditLog({
      action: `EDITORIAL_${editorialStatus.toUpperCase()}`,
      targetType: 'article',
      targetId: id,
      details: `Changed editorial status to ${editorialStatus}`,
      actorRole,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `articles/${id}`);
  }
}

export async function deleteArticleById(articleId: string, actorRole = 'super_admin') {
  const id = sanitizeId(articleId);
  try {
    await deleteDoc(doc(db, 'articles', id));
    await writeAuditLog({
      action: 'ARTICLE_DELETED',
      targetType: 'article',
      targetId: id,
      actorRole,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `articles/${id}`);
  }
}

export async function fetchArticleVersions(articleId: string): Promise<ArticleVersion[]> {
  const id = sanitizeId(articleId);
  try {
    const snap = await getDocs(collection(db, 'articles', id, 'versions'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ArticleVersion, 'id'>) }))
      .sort((a, b) => b.versionNumber - a.versionNumber);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `articles/${id}/versions`);
  }
}

// ============================================================================
// DYNAMIC CATEGORIES & SUBCATEGORIES
// ============================================================================

export async function fetchCategories(includeInactive = false): Promise<Category[]> {
  try {
    const q = includeInactive
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'categories');
  }
}

export async function saveCategory(
  cat: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const isUpdate = Boolean(cat.id);
  const slug = sanitizeSlug(cat.slug || cat.name);
  const id = cat.id ? sanitizeId(cat.id) : sanitizeId(slug);
  const ref = doc(db, 'categories', id);

  try {
    const existing = isUpdate ? await getDoc(ref) : null;
    if (existing?.exists()) {
      await updateDoc(ref, {
        name: cat.name.trim().slice(0, 98),
        slug,
        description: (cat.description || '').slice(0, 590),
        parentId: cat.parentId ? sanitizeId(cat.parentId) : '',
        icon: (cat.icon || '').slice(0, 58),
        imageUrl: (cat.imageUrl || '').slice(0, 590),
        displayOrder: Number(cat.displayOrder) || 1,
        isActive: Boolean(cat.isActive),
        tags: (cat.tags || []).slice(0, 20),
        allowedContentTypes: (cat.allowedContentTypes || []).slice(0, 20),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        name: cat.name.trim().slice(0, 98),
        slug,
        description: (cat.description || '').slice(0, 590),
        parentId: cat.parentId ? sanitizeId(cat.parentId) : '',
        icon: (cat.icon || '').slice(0, 58),
        imageUrl: (cat.imageUrl || '').slice(0, 590),
        displayOrder: Number(cat.displayOrder) || 1,
        isActive: Boolean(cat.isActive),
        tags: (cat.tags || []).slice(0, 20),
        allowedContentTypes: (cat.allowedContentTypes || []).slice(0, 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await writeAuditLog({
      action: existing?.exists() ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED',
      targetType: 'category',
      targetId: id,
      details: `${cat.name} (parent: ${cat.parentId || 'root'})`,
      actorRole: 'editor',
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${id}`);
  }
}

export async function deleteCategoryById(categoryId: string) {
  const id = sanitizeId(categoryId);
  try {
    await deleteDoc(doc(db, 'categories', id));
    await writeAuditLog({
      action: 'CATEGORY_DELETED',
      targetType: 'category',
      targetId: id,
      actorRole: 'super_admin',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
  }
}

// ============================================================================
// SOURCES, PUBLISHERS & INGESTION LOGS
// ============================================================================

export async function fetchSources(): Promise<SourceConfig[]> {
  try {
    const q = query(collection(db, 'sources'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SourceConfig, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sources');
  }
}

export async function saveSource(
  source: Omit<SourceConfig, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const id = source.id ? sanitizeId(source.id) : generateDocId('src');
  const ref = doc(db, 'sources', id);
  try {
    const existing = source.id ? await getDoc(ref) : null;
    const body = stripUndefined({
      name: source.name.trim().slice(0, 158),
      websiteUrl: source.websiteUrl.trim().slice(0, 490),
      sourceType: source.sourceType,
      country: source.country.trim().slice(0, 78),
      language: source.language.trim().slice(0, 15),
      rssFeedUrl: (source.rssFeedUrl || '').trim().slice(0, 990),
      apiEndpoint: (source.apiEndpoint || '').trim().slice(0, 990),
      authMode: source.authMode || 'none',
      fetchIntervalMinutes: Math.max(5, Math.min(10080, Number(source.fetchIntervalMinutes) || 60)),
      status: source.status || 'active',
      trustClassification: source.trustClassification || 'tier_3_verified',
      contentPermission: source.contentPermission || 'excerpt_and_link',
      autoPublishEligible: Boolean(source.autoPublishEligible),
      defaultCategoryId: source.defaultCategoryId ? sanitizeId(source.defaultCategoryId) : '',
      lastFetchTime: source.lastFetchTime || '',
      nextFetchTime: source.nextFetchTime || '',
      errorStatus: (source.errorStatus || '').slice(0, 490),
      totalImported: Number(source.totalImported) || 0,
    });
    if (existing?.exists()) {
      await updateDoc(ref, { ...body, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...body, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await writeAuditLog({
      action: existing?.exists() ? 'SOURCE_UPDATED' : 'SOURCE_CREATED',
      targetType: 'source',
      targetId: id,
      details: `${source.name} (${source.sourceType})`,
      actorRole: 'source_manager',
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `sources/${id}`);
  }
}

export async function deleteSourceById(sourceId: string) {
  const id = sanitizeId(sourceId);
  try {
    await deleteDoc(doc(db, 'sources', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `sources/${id}`);
  }
}

export async function createIngestionLog(payload: {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'partial' | 'failed';
  itemsFetched: number;
  itemsImported: number;
  duplicatesSkipped: number;
  errorMessage?: string;
}) {
  const user = auth.currentUser;
  if (!user) return;
  const id = generateDocId('log');
  try {
    await setDoc(doc(db, 'ingestion_logs', id), {
      sourceId: sanitizeId(payload.sourceId),
      sourceName: payload.sourceName.slice(0, 158),
      triggeredByUid: user.uid,
      status: payload.status,
      itemsFetched: payload.itemsFetched,
      itemsImported: payload.itemsImported,
      duplicatesSkipped: payload.duplicatesSkipped,
      errorMessage: (payload.errorMessage || '').slice(0, 990),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `ingestion_logs/${id}`);
  }
}

export async function fetchIngestionLogs(): Promise<IngestionLog[]> {
  try {
    const snap = await getDocs(collection(db, 'ingestion_logs'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IngestionLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'ingestion_logs');
  }
}

export async function fetchPublishers(): Promise<Publisher[]> {
  try {
    const q = query(collection(db, 'publishers'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Publisher, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'publishers');
  }
}

export async function savePublisher(
  pub: Omit<Publisher, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const slug = sanitizeSlug(pub.slug || pub.name);
  const id = pub.id ? sanitizeId(pub.id) : sanitizeId(`pub-${slug}`);
  const ref = doc(db, 'publishers', id);
  try {
    const existing = pub.id ? await getDoc(ref) : null;
    const body = {
      name: pub.name.trim().slice(0, 158),
      slug,
      websiteUrl: pub.websiteUrl.trim().slice(0, 490),
      country: pub.country.trim().slice(0, 78),
      language: pub.language.trim().slice(0, 15),
      publisherType: (pub.publisherType || 'Newsroom').slice(0, 58),
      trustClassification: pub.trustClassification,
      description: (pub.description || '').slice(0, 790),
    };
    if (existing?.exists()) {
      await updateDoc(ref, { ...body, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...body, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publishers/${id}`);
  }
}

// ============================================================================
// FACT CHECKS & TIMELINES
// ============================================================================

export async function fetchFactChecks(): Promise<FactCheckRecord[]> {
  try {
    const q = query(collection(db, 'fact_checks'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FactCheckRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'fact_checks');
  }
}

export async function saveFactCheck(
  fc: Omit<FactCheckRecord, 'id' | 'reviewerUid' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required');
  const id = fc.id ? sanitizeId(fc.id) : generateDocId('fc');
  const ref = doc(db, 'fact_checks', id);
  try {
    const existing = fc.id ? await getDoc(ref) : null;
    const body = {
      claim: fc.claim.trim().slice(0, 595),
      status: fc.status,
      evidence: fc.evidence.trim().slice(0, 3990),
      explanation: fc.explanation.trim().slice(0, 3990),
      methodology: (fc.methodology || 'Primary documentary cross-verification').slice(0, 990),
      references: (fc.references || []).slice(0, 20),
      reviewerName: (fc.reviewerName || user.displayName || 'Verification Desk').slice(0, 138),
      reviewerUid: user.uid,
      articleId: fc.articleId ? sanitizeId(fc.articleId) : '',
      category: (fc.category || 'General').slice(0, 98),
      isSampleData: Boolean(fc.isSampleData),
    };
    if (existing?.exists()) {
      await updateDoc(ref, { ...body, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...body, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    await writeAuditLog({
      action: 'FACT_CHECK_SAVED',
      targetType: 'fact_check',
      targetId: id,
      details: `${fc.status}: ${fc.claim.slice(0, 100)}`,
      actorRole: 'reviewer',
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `fact_checks/${id}`);
  }
}

export async function fetchTimelines(): Promise<TimelineRecord[]> {
  try {
    const q = query(collection(db, 'timelines'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TimelineRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'timelines');
  }
}

export async function saveTimeline(
  tl: Omit<TimelineRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> {
  const id = tl.id ? sanitizeId(tl.id) : generateDocId('tl');
  const slug = sanitizeSlug(tl.slug || tl.title);
  const ref = doc(db, 'timelines', id);
  try {
    const existing = tl.id ? await getDoc(ref) : null;
    const body = {
      title: tl.title.trim().slice(0, 198),
      slug,
      topic: tl.topic.trim().slice(0, 98),
      summary: (tl.summary || '').slice(0, 990),
      events: (tl.events || []).slice(0, 50),
      isSampleData: Boolean(tl.isSampleData),
    };
    if (existing?.exists()) {
      await updateDoc(ref, { ...body, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, { ...body, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `timelines/${id}`);
  }
}

// ============================================================================
// USER PERSONALIZATION: BOOKMARKS, READING HISTORY, LISTS, SAVED SEARCHES
// ============================================================================

export async function fetchUserBookmarks(userId: string): Promise<BookmarkRecord[]> {
  try {
    const q = query(collection(db, 'users', userId, 'bookmarks'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookmarkRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/bookmarks`);
  }
}

export async function toggleBookmark(userId: string, article: Article, currentlySaved: boolean) {
  const id = sanitizeId(article.id);
  const ref = doc(db, 'users', userId, 'bookmarks', id);
  try {
    if (currentlySaved) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        userId,
        articleId: id,
        articleTitle: article.title.slice(0, 295),
        articleSlug: sanitizeSlug(article.slug),
        categoryId: sanitizeId(article.categoryId),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/bookmarks/${id}`);
  }
}

export async function fetchReadingHistory(userId: string): Promise<ReadingHistoryRecord[]> {
  try {
    const q = query(collection(db, 'users', userId, 'reading_history'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReadingHistoryRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/reading_history`);
  }
}

export async function recordReadingProgress(userId: string, article: Article, progressPercent: number) {
  const id = sanitizeId(article.id);
  const ref = doc(db, 'users', userId, 'reading_history', id);
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        progressPercent: clamped,
        articleTitle: article.title.slice(0, 295),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId,
        articleId: id,
        articleTitle: article.title.slice(0, 295),
        articleSlug: sanitizeSlug(article.slug),
        progressPercent: clamped,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking background progress tracking
  }
}

export async function fetchReadingLists(userId: string): Promise<ReadingListRecord[]> {
  try {
    const q = query(collection(db, 'users', userId, 'reading_lists'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReadingListRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/reading_lists`);
  }
}

export async function createReadingList(userId: string, name: string, description = '', articleIds: string[] = []) {
  const id = generateDocId('list');
  try {
    await setDoc(doc(db, 'users', userId, 'reading_lists', id), {
      userId,
      name: name.trim().slice(0, 118),
      description: description.trim().slice(0, 390),
      articleIds: articleIds.slice(0, 50),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/reading_lists/${id}`);
  }
}

export async function updateReadingListArticles(userId: string, listId: string, articleIds: string[]) {
  const id = sanitizeId(listId);
  try {
    await updateDoc(doc(db, 'users', userId, 'reading_lists', id), {
      articleIds: articleIds.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/reading_lists/${id}`);
  }
}

export async function deleteReadingList(userId: string, listId: string) {
  const id = sanitizeId(listId);
  try {
    await deleteDoc(doc(db, 'users', userId, 'reading_lists', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/reading_lists/${id}`);
  }
}

export async function fetchSavedSearches(userId: string): Promise<SavedSearchRecord[]> {
  try {
    const q = query(collection(db, 'users', userId, 'saved_searches'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedSearchRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `users/${userId}/saved_searches`);
  }
}

export async function addSavedSearch(userId: string, queryText: string, category = '', language = '') {
  const id = generateDocId('srch');
  try {
    await setDoc(doc(db, 'users', userId, 'saved_searches', id), {
      userId,
      query: queryText.trim().slice(0, 195),
      category: category.slice(0, 98),
      language: language.slice(0, 18),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${userId}/saved_searches/${id}`);
  }
}

export async function removeSavedSearch(userId: string, searchId: string) {
  const id = sanitizeId(searchId);
  try {
    await deleteDoc(doc(db, 'users', userId, 'saved_searches', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}/saved_searches/${id}`);
  }
}

// ============================================================================
// COMMENTS, AUDIT LOGS & SITE SETTINGS
// ============================================================================

export async function fetchArticleComments(articleId: string): Promise<CommentRecord[]> {
  const id = sanitizeId(articleId);
  try {
    const q = query(collection(db, 'articles', id, 'comments'), where('articleId', '==', id));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommentRecord, 'id'>) }));
  } catch {
    return [];
  }
}

export async function addArticleComment(articleId: string, body: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in required to comment.');
  const artId = sanitizeId(articleId);
  const commentId = generateDocId('cmt');
  try {
    await setDoc(doc(db, 'articles', artId, 'comments', commentId), {
      articleId: artId,
      authorUid: user.uid,
      authorName: (user.displayName || user.email?.split('@')[0] || 'Reader').slice(0, 118),
      body: body.trim().slice(0, 1990),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `articles/${artId}/comments/${commentId}`);
  }
}

export async function fetchAuditLogs(): Promise<AuditLogRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'audit_logs'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogRecord, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'audit_logs');
  }
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'public'));
    if (snap.exists()) {
      return snap.data() as SiteSettings;
    }
    return DEFAULT_SITE_SETTINGS;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export async function saveSiteSettings(settings: Omit<SiteSettings, 'updatedAt'>) {
  try {
    await setDoc(doc(db, 'site_settings', 'public'), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      action: 'SITE_SETTINGS_UPDATED',
      targetType: 'site_settings',
      targetId: 'public',
      details: `Approval required by default: ${settings.defaultRequireApproval}`,
      actorRole: 'super_admin',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'site_settings/public');
  }
}
