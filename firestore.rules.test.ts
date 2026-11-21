/**
 * Firestore Security Rules Verification Suite (Phase 0 TDD Specification)
 * Verifies all 12 Dirty Dozen adversarial payloads against firestore.rules.
 *
 * Run with Firebase Emulators:
 *   npx firebase emulators:exec --only firestore "npx tsx firestore.rules.test.ts"
 */

export interface SecurityTestCase {
  id: string;
  name: string;
  actor: 'anonymous' | 'reader' | 'unverified_admin_spoof' | 'staff' | 'super_admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 'P1',
    name: 'Role Escalation on Registration',
    actor: 'reader',
    operation: 'create',
    path: '/users/uid_reader',
    payload: { uid: 'uid_reader', email: 'r@example.com', displayName: 'Reader', role: 'super_admin', preferredLanguage: 'en' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P2',
    name: 'Shadow Role Escalation on Update',
    actor: 'reader',
    operation: 'update',
    path: '/users/uid_reader',
    payload: { role: 'administrator' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P3',
    name: 'Cross-User PII Read',
    actor: 'reader',
    operation: 'get',
    path: '/users/uid_victim',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P4',
    name: 'Unverified Email Admin Spoof',
    actor: 'unverified_admin_spoof',
    operation: 'create',
    path: '/categories/cat-1',
    payload: { name: 'Spoof', slug: 'spoof', description: 'x', displayOrder: 1, isActive: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P5',
    name: 'Reader Publishing Official Article',
    actor: 'reader',
    operation: 'create',
    path: '/articles/art-fake',
    payload: { title: 'Fake News', slug: 'fake-news', editorialStatus: 'published' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P6',
    name: 'Shadow Field Injection on Bookmark',
    actor: 'reader',
    operation: 'create',
    path: '/users/uid_reader/bookmarks/bm-1',
    payload: { userId: 'uid_reader', articleId: 'art-1', articleTitle: 'A', articleSlug: 'a', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P7',
    name: 'Unauthenticated Draft Listing',
    actor: 'anonymous',
    operation: 'list',
    path: '/articles',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P8',
    name: 'Comment Identity Spoofing',
    actor: 'reader',
    operation: 'create',
    path: '/articles/art-pub/comments/c-1',
    payload: { articleId: 'art-pub', authorUid: 'uid_victim', authorName: 'Victim', body: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P9',
    name: 'Audit Log Tampering',
    actor: 'super_admin',
    operation: 'delete',
    path: '/audit_logs/log-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P10',
    name: 'Source Config Tampering by Reader',
    actor: 'reader',
    operation: 'update',
    path: '/sources/src-1',
    payload: { rssFeedUrl: 'https://evil.example/rss' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P11',
    name: 'Document ID Poisoning',
    actor: 'reader',
    operation: 'create',
    path: '/users/uid_reader/bookmarks/' + 'x!'.repeat(80),
    payload: { userId: 'uid_reader', articleId: 'art-1', articleTitle: 'A', articleSlug: 'a' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'P12',
    name: 'Timestamp Backdating on Article Create',
    actor: 'super_admin',
    operation: 'create',
    path: '/articles/art-backdate',
    payload: { title: 'Backdated', slug: 'backdated', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
];
