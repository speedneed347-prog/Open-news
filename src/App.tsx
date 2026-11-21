/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HubProvider, useHub } from './context/HubContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { KnowledgeDiscoveryPage, AdvancedSearchPage } from './pages/DiscoveryAndSearchPage';
import {
  DeskEditionPage,
  InstitutionalPage,
  PublisherDirectoryPage,
  SourceDirectoryPage,
} from './pages/PublicCollectionsPages';
import {
  FactCheckPage,
  SourceComparisonPage,
  TimelineExplorerPage,
} from './pages/TransparencyPages';
import { UserDashboardPage } from './pages/UserDashboardPage';
import { AdminControlCenter } from './pages/admin/AdminControlCenter';

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function RouteView() {
  const { route, navigate } = useHub();
  const cleanPath = route.split('?')[0].replace(/\/+$/, '') || '/';

  if (cleanPath === '/') return <HomePage />;

  // Desk & Edition pages
  if (cleanPath === '/latest') return <DeskEditionPage mode="latest" />;
  if (cleanPath === '/breaking') return <DeskEditionPage mode="breaking" />;
  if (cleanPath === '/trending') return <DeskEditionPage mode="trending" />;
  if (cleanPath === '/national') return <DeskEditionPage mode="national" />;
  if (cleanPath === '/international') return <DeskEditionPage mode="international" />;
  if (cleanPath === '/state') return <DeskEditionPage mode="state" />;
  if (cleanPath === '/research') return <DeskEditionPage mode="research" />;
  if (cleanPath === '/documents') return <DeskEditionPage mode="documents" />;

  // Dynamic Categories & Subcategories
  if (cleanPath === '/categories') return <CategoriesPage />;
  if (cleanPath.startsWith('/category/')) {
    const slug = safeDecode(cleanPath.slice('/category/'.length));
    return <CategoriesPage categorySlug={slug} />;
  }
  if (cleanPath.startsWith('/subcategory/')) {
    const slug = safeDecode(cleanPath.slice('/subcategory/'.length));
    return <CategoriesPage categorySlug={slug} />;
  }

  // Article Detail
  if (cleanPath.startsWith('/article/')) {
    const slug = safeDecode(cleanPath.slice('/article/'.length));
    return <ArticleDetailPage slug={slug} />;
  }

  // Knowledge Discovery & Advanced Search
  if (cleanPath === '/discover') return <KnowledgeDiscoveryPage />;
  if (cleanPath.startsWith('/topic/')) {
    const topic = safeDecode(cleanPath.slice('/topic/'.length));
    return <KnowledgeDiscoveryPage initialTopic={topic} />;
  }
  if (cleanPath === '/search') return <AdvancedSearchPage />;

  // Transparency, Verification & Directories
  if (cleanPath === '/fact-check') return <FactCheckPage />;
  if (cleanPath === '/compare') return <SourceComparisonPage />;
  if (cleanPath === '/timelines') return <TimelineExplorerPage />;
  if (cleanPath === '/publishers') return <PublisherDirectoryPage />;
  if (cleanPath === '/sources') return <SourceDirectoryPage />;

  // Institutional & Legal
  if (cleanPath === '/about') return <InstitutionalPage page="about" />;
  if (cleanPath === '/contact') return <InstitutionalPage page="contact" />;
  if (cleanPath === '/privacy') return <InstitutionalPage page="privacy" />;
  if (cleanPath === '/terms') return <InstitutionalPage page="terms" />;

  // User Dashboard & Admin Control Center
  if (cleanPath === '/dashboard') return <UserDashboardPage />;
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) return <AdminControlCenter />;

  // Editorial 404 fallback
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p className="text-xs font-mono uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
        404 · Record Not Found
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold mt-3 text-[#141413] dark:text-[#F3F4F6]">
        This page is not in the archive
      </h1>
      <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3 max-w-md mx-auto">
        The requested dispatch, category, or library document may have been moved or renamed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 text-sm font-medium bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] hover:opacity-90 transition-opacity"
        >
          Return to Front Page
        </button>
        <button
          type="button"
          onClick={() => navigate('/search')}
          className="px-5 py-2.5 text-sm font-medium border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6] hover:bg-[#F3F1EC] dark:hover:bg-[#1B212C] transition-colors"
        >
          Search Archive
        </button>
      </div>
    </main>
  );
}

function ToastBanner() {
  const { toast } = useHub();
  if (!toast) return null;

  const toneClasses =
    toast.type === 'error'
      ? 'border-[#991B1B] bg-[#FEF2F2] text-[#991B1B] dark:bg-[#2A1215] dark:text-[#FCA5A5] dark:border-[#7F1D1D]'
      : toast.type === 'success'
      ? 'border-[#166534] bg-[#F0FDF4] text-[#166534] dark:bg-[#0F2418] dark:text-[#86EFAC] dark:border-[#14532D]'
      : 'border-[#E5E2DC] bg-white text-[#141413] dark:bg-[#141922] dark:text-[#F3F4F6] dark:border-[#232A36]';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-sm shadow-lg"
    >
      <div className={`border px-4 py-3 text-sm font-medium ${toneClasses}`}>
        {toast.message}
      </div>
    </div>
  );
}

function HubShell() {
  const { route } = useHub();
  const isAdminRoute = route.split('?')[0].startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#141413] dark:bg-[#0C0F14] dark:text-[#F3F4F6] transition-colors">
      <Header />
      <div className="flex-1">
        <RouteView />
      </div>
      {!isAdminRoute && <Footer />}
      <AuthModal />
      <ToastBanner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HubProvider>
        <HubShell />
      </HubProvider>
    </ErrorBoundary>
  );
}
