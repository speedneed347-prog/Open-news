# ALL INFORMATION HUB — Setup, Deployment & Verification Guide

**"All Information. One Intelligent Platform."**

This guide documents the architecture, environment configuration, Firebase setup, Cloud Functions deployment, and testing workflow for **ALL INFORMATION HUB**.

---

## 1. Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 (Editorial Broadsheet Light & Dark themes, EN/BN/HI UI localization).
- **Backend API Server (`server.ts`)**: Express + Vite middleware running on port `3000`:
  - `/api/health` — Server and AI configuration readiness check.
  - `/api/ingest/validate` & `/api/ingest/fetch` — Server-side RSS/Atom (`rss-parser`) and authorized JSON API ingestion with DNS/IP SSRF protection, redirect validation, URL canonicalization, SHA-256 deduplication, and copyright-compliant excerpt enforcement.
  - `/api/ai/*` — Interchangeable server-side `AIProvider` (`GeminiAIProvider` powered by `@google/genai` on `gemini-4-hydrogen`) providing article summarization, keyword/category extraction, EN/BN/HI translation (preserving original source text), multi-source comparison, source-grounded Q&A, timeline synthesis, and natural language search parsing.
  - `/sitemap.xml` & `/robots.txt` — Dynamic crawler directives and XML sitemap.
- **Database & Auth**: Cloud Firestore (17 structured collections defined in `firebase-blueprint.json`) + Firebase Authentication (Google Sign-In + Email/Password + password reset).
- **Scheduled Cloud Functions (`functions/src/index.ts`)**: Firebase Cloud Functions v2 scheduled RSS collector (`scheduledInformationCollector`) and editorial audit trigger (`onArticlePublishedAudit`).

---

## 2. Environment Variables

Copy `.env.example` to `.env` for local or external deployments:

| Variable | Required | Scope | Purpose |
| :--- | :---: | :--- | :--- |
| `GEMINI_API_KEY` | Yes (for AI routes) | Server only | Authenticates server-side `@google/genai` requests. Never exposed to the browser. |
| `APP_URL` | Recommended | Server | Base URL used in `/sitemap.xml` and `/robots.txt`. |
| `NODE_ENV` | Optional | Server | Set to `production` to serve built `dist/` assets. |
| `PORT` | Optional | Server | Defaults to `3000`. |

---

## 3. Firebase Configuration & Initialization

1. **Firebase Project Config**: `firebase-applet-config.json` is automatically generated during Firebase provisioning and binds the app to its named Firestore database.
2. **Authentication Providers**:
   - **Google Sign-In** is enabled automatically during provisioning.
   - To enable **Email/Password Sign-In** and password recovery, open **Firebase Console → Authentication → Sign-in method** and enable **Email/Password**.
3. **Bootstrapped Super Admin**:
   - Sign in with `manojitmi72@gmail.com` to access the **Admin Control Center** (`/admin`).
   - On first visit to `/admin`, click **Initialize Firestore Database** to seed the 30 dynamic categories, nested subcategories, 5 authorized RSS sources, publishers, sample articles (clearly marked `Sample Data`), fact-checks, timelines, and default site settings into Cloud Firestore.
4. **Deploy Security Rules & Indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
   > **Security Reminder**: Review `firestore.rules` and `storage.rules` before sharing the application broadly, and tighten quotas, trusted source domains, or role assignments to match your organization's editorial policies.

---

## 4. Deploying Scheduled Cloud Functions

The `functions/` directory contains ready-to-deploy Firebase Cloud Functions v2 for automated background feed collection:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Make sure the Firebase project is on the Blaze plan if you deploy scheduled Cloud Scheduler jobs.

---

## 5. Running Locally & Production Build

```bash
# Development server (Express API + Vite middleware on port 3000)
npm run dev

# Type-check & production build
npm run lint
npm run build

# Start production server
NODE_ENV=production npm start
```

---

## 6. Verification & Testing Checklist

1. **Security Rules Static Audit**:
   ```bash
   npx eslint firestore.rules
   ```
2. **Security Rules Emulator Tests** (requires Firebase Emulator Suite):
   - Reference payloads and Dirty Dozen adversarial tests are defined in `firestore.rules.test.ts` and `security_spec.md`.
   - Verify unauthenticated users can only read `published` articles and `active` categories, cannot read `draft`/`archived` content, and cannot self-escalate roles in `users/{uid}`.
3. **Automatic Information Collection**:
   - Open `/admin` → **Source & Feed Collection**.
   - Click **Validate Feed** or **Fetch Now** on any authorized RSS source (e.g., BBC World News, NASA Breaking News, PIB) to verify server-side parsing, duplicate skipping, copyright excerpt enforcement, and `ingestion_logs` creation.
   - Verify private/loopback URLs (e.g., `http://127.0.0.1/...`) are rejected by the server validator.
4. **Manual Publishing & Revision History**:
   - Open `/admin` → **Manual Editor**.
   - Create an article with headings, tables, quotes, and attachments, preview the final layout, save as draft, publish, and confirm an immutable snapshot is recorded in `article_versions`.
5. **AI Discovery & Transparency**:
   - Open any article and run **AI Summary**, **Translate (EN/BN/HI)**, and **Ask This Source**.
   - Verify AI outputs are clearly labeled as AI-assisted and original publisher attribution links remain intact.
