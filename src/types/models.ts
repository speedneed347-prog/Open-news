export type AdminRoleType =
  | 'super_admin'
  | 'administrator'
  | 'editor'
  | 'author'
  | 'reviewer'
  | 'source_manager';

export type UserRoleType = 'reader' | AdminRoleType;

export type ContentType =
  | 'news'
  | 'article'
  | 'research'
  | 'educational_note'
  | 'government_notification'
  | 'historical_document'
  | 'report'
  | 'editorial'
  | 'opinion'
  | 'scientific_discovery'
  | 'statistical_info'
  | 'pdf_document'
  | 'image_gallery'
  | 'video_content'
  | 'special_collection';

export type CollectionMethod =
  | 'manual'
  | 'rss'
  | 'api'
  | 'government_feed'
  | 'research_feed';

export type CopyrightPermissionStatus =
  | 'original'
  | 'full_licensed'
  | 'excerpt_and_link'
  | 'public_domain'
  | 'cc_licensed';

export type EditorialStatus =
  | 'draft'
  | 'pending_review'
  | 'needs_correction'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'archived';

export type FactCheckStatus =
  | 'verified'
  | 'partially_verified'
  | 'unverified'
  | 'disputed'
  | 'false'
  | 'under_review';

export type SourceType =
  | 'rss_feed'
  | 'news_publisher'
  | 'newspaper_website'
  | 'news_channel'
  | 'government_portal'
  | 'educational_institution'
  | 'research_journal'
  | 'press_release'
  | 'authorized_api'
  | 'custom_feed';

export interface ArticleAttachment {
  id: string;
  label: string;
  type: 'pdf' | 'document' | 'video' | 'image' | 'dataset';
  url: string;
  sizeLabel?: string;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  subtitle?: string;
  summary: string;
  content: string;
  contentType: ContentType;
  originalSource: string;
  originalSourceUrl?: string;
  canonicalUrl?: string;
  authorName: string;
  authorUid: string;
  categoryId: string;
  subcategoryId?: string;
  tags: string[];
  topics: string[];
  country: string;
  language: string;
  featuredImage?: string;
  attachments?: ArticleAttachment[];
  publishedAt?: string;
  collectedAt?: string;
  scheduledAt?: string;
  collectionMethod: CollectionMethod;
  copyrightPermissionStatus: CopyrightPermissionStatus;
  editorialStatus: EditorialStatus;
  factCheckStatus: FactCheckStatus;
  isBreaking?: boolean;
  isFeatured?: boolean;
  isSampleData?: boolean;
  viewCount?: number;
  aiSummary?: string;
  aiKeywords?: string[];
  aiProcessed?: boolean;
  sourceId?: string;
  seoTitle?: string;
  seoDescription?: string;
  relatedArticleIds?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  versionNumber: number;
  title: string;
  summary?: string;
  content?: string;
  editorUid: string;
  editorName: string;
  changeNote?: string;
  editorialStatus?: string;
  createdAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId?: string;
  icon?: string;
  imageUrl?: string;
  displayOrder: number;
  isActive: boolean;
  tags?: string[];
  allowedContentTypes?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Publisher {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  country: string;
  language: string;
  publisherType?: string;
  trustClassification:
    | 'official_government'
    | 'peer_reviewed'
    | 'major_newsroom'
    | 'verified_independent'
    | 'standard';
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SourceConfig {
  id: string;
  name: string;
  websiteUrl: string;
  sourceType: SourceType;
  country: string;
  language: string;
  rssFeedUrl?: string;
  apiEndpoint?: string;
  authMode?: 'none' | 'server_env_header' | 'server_env_query';
  fetchIntervalMinutes: number;
  status: 'active' | 'paused' | 'error';
  trustClassification:
    | 'tier_1_official'
    | 'tier_1_journal'
    | 'tier_2_major_media'
    | 'tier_3_verified'
    | 'unclassified';
  contentPermission: 'excerpt_and_link' | 'full_authorized' | 'public_domain' | 'cc_by';
  autoPublishEligible: boolean;
  defaultCategoryId?: string;
  lastFetchTime?: string;
  nextFetchTime?: string;
  errorStatus?: string;
  totalImported?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IngestionLog {
  id: string;
  sourceId: string;
  sourceName: string;
  triggeredByUid: string;
  status: 'success' | 'partial' | 'failed';
  itemsFetched: number;
  itemsImported: number;
  duplicatesSkipped: number;
  errorMessage?: string;
  createdAt?: unknown;
}

export interface FactCheckRecord {
  id: string;
  claim: string;
  status: FactCheckStatus;
  evidence: string;
  explanation: string;
  methodology?: string;
  references?: string[];
  reviewerName: string;
  reviewerUid: string;
  articleId?: string;
  category?: string;
  isSampleData?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TimelineEvent {
  date: string;
  collectedAt?: string;
  headline: string;
  description: string;
  source: string;
  eventType: string;
  articleSlug?: string;
}

export interface TimelineRecord {
  id: string;
  title: string;
  slug: string;
  topic: string;
  summary: string;
  events: TimelineEvent[];
  isSampleData?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationPrefs {
  breakingNews: boolean;
  followedCategories: boolean;
  followedTopics: boolean;
  governmentNotices: boolean;
  newResearch: boolean;
  personalizedDigest: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  role: UserRoleType;
  preferredLanguage: string;
  followedCategories: string[];
  followedTopics: string[];
  followedPublishers: string[];
  notificationPrefs: NotificationPrefs;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminRoleRecord {
  id: string;
  uid: string;
  email: string;
  role: AdminRoleType;
  assignedBy: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookmarkRecord {
  id: string;
  userId: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  categoryId?: string;
  createdAt?: unknown;
}

export interface ReadingHistoryRecord {
  id: string;
  userId: string;
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  progressPercent: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ReadingListRecord {
  id: string;
  userId: string;
  name: string;
  description?: string;
  articleIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedSearchRecord {
  id: string;
  userId: string;
  query: string;
  category?: string;
  language?: string;
  createdAt?: unknown;
}

export interface CommentRecord {
  id: string;
  articleId: string;
  authorUid: string;
  authorName: string;
  body: string;
  createdAt?: unknown;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  createdAt?: unknown;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  defaultRequireApproval: boolean;
  enabledLanguages: string[];
  breakingTickerEnabled: boolean;
  seoDefaultTitle: string;
  seoDefaultDescription: string;
  aiProviderName: string;
  updatedAt?: unknown;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  news: 'News',
  article: 'Feature Article',
  research: 'Research Paper',
  educational_note: 'Educational Note',
  government_notification: 'Government Notice',
  historical_document: 'Historical Document',
  report: 'Special Report',
  editorial: 'Editorial',
  opinion: 'Opinion',
  scientific_discovery: 'Scientific Discovery',
  statistical_info: 'Statistical Data',
  pdf_document: 'PDF Document',
  image_gallery: 'Image Gallery',
  video_content: 'Video Brief',
  special_collection: 'Special Collection',
};

export const FACT_CHECK_LABELS: Record<FactCheckStatus, string> = {
  verified: 'Verified',
  partially_verified: 'Partially Verified',
  unverified: 'Unverified',
  disputed: 'Disputed',
  false: 'False',
  under_review: 'Under Review',
};

export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  needs_correction: 'Returned for Correction',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};
