# ALL INFORMATION HUB — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **PII Isolation**: `/users/{userId}` documents contain user email addresses and personal preferences. Only the owning user (`request.auth.uid == userId`) or a verified administrator may read or modify them.
2. **No Self-Role Escalation**: A reader creating their own `/users/{userId}` profile MUST set `role: "reader"` and can NEVER modify their `role` field on update or create/modify `/admin_roles/{userId}`.
3. **Editorial Publication Boundary**: Public unauthenticated or standard-reader `get`/`list` queries on `/articles` MUST ONLY access documents where `editorialStatus == "published"`. Drafts, pending reviews, and rejected articles are invisible to public readers.
4. **Master Gate Subcollections**:
   - `/articles/{articleId}/versions/{versionId}` and `/articles/{articleId}/comments/{commentId}` require parent `/articles/{articleId}` to exist.
   - Comments may only be created on articles whose `editorialStatus == "published"`.
   - User subcollections (`bookmarks`, `reading_history`, `reading_lists`, `saved_searches`) strictly belong to `{userId}` and require `incoming().userId == request.auth.uid`.
5. **Immutable Audit Trail**: `/audit_logs/{logId}` and `/articles/{articleId}/versions/{versionId}` are append-only (`allow update, delete: if false`).
6. **Temporal Integrity**: All `createdAt` fields must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update.
7. **Volumetric & ID Poisoning Guards**: All document IDs match `^[a-zA-Z0-9_-]+$` (`<= 128` chars), all strings enforce explicit `.size()` bounds, and all arrays enforce bounded `.size() <= MAX`.
8. **Email Verification Enforcement**: All standard authenticated write operations and bootstrap admin checks mandate `request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)

1. **P1 — Role Escalation on Registration**: User `uid_attacker` creates `/users/uid_attacker` with `role: "super_admin"`.
2. **P2 — Shadow Role Escalation on Update**: User `uid_attacker` updates `/users/uid_attacker` with `{ role: "administrator", updatedAt: serverTimestamp() }`.
3. **P3 — Cross-User PII Read**: Authenticated `uid_attacker` attempts `get` on `/users/uid_victim`.
4. **P4 — Unverified Email Admin Spoof**: Token with `email: "manojitmi72@gmail.com"` and `email_verified: false` attempts to write `/categories/cat-1`.
5. **P5 — Reader Publishing Official Article**: Standard reader attempts to create `/articles/art-fake` with `editorialStatus: "published"`.
6. **P6 — Shadow Field Injection on Bookmark**: Owner creates `/users/uid_1/bookmarks/bm-1` with extra ghost field `isAdmin: true`.
7. **P7 — Unauthenticated Draft Scraping**: Anonymous visitor runs `list` on `/articles` without filtering `editorialStatus == "published"`.
8. **P8 — Comment Identity Spoofing**: User `uid_attacker` creates comment under `/articles/art-1/comments/c-1` with `authorUid: "uid_victim"`.
9. **P9 — Audit Log Tampering**: Even a staff member attempts to `update` or `delete` `/audit_logs/log-1`.
10. **P10 — Source Config Tampering**: Standard reader attempts to update `/sources/src-1` to inject a malicious RSS URL.
11. **P11 — Document ID Poisoning**: User attempts to write `/users/uid_1/bookmarks/<200-char-invalid-id!@#>`.
12. **P12 — Timestamp Backdating**: Staff user attempts to create `/articles/art-2` with client-supplied `createdAt` instead of `request.time`.
