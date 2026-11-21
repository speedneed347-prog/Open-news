import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  FileText,
  FolderTree,
  Globe,
  LayoutDashboard,
  PenLine,
  Rss,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useHub } from '../../context/HubContext';
import { ManualArticleEditor } from './ManualArticleEditor';
import { SourceCollectionManager } from './SourceCollectionManager';
import { apiClient } from '../../lib/apiClient';
import {
  assignAdminRole,
  deleteArticleById,
  deleteCategoryById,
  fetchAllAdminRoles,
  fetchAllUsersForAdmin,
  fetchAuditLogs,
  saveArticle,
  saveCategory,
  saveFactCheck,
  savePublisher,
  saveSiteSettings,
  updateArticleEditorialStatus,
} from '../../lib/firestoreService';
import { formatShortDate } from '../../components/ArticleCard';
import { updatePageSEO } from '../../lib/seo';
import {
  EDITORIAL_STATUS_LABELS,
  FACT_CHECK_LABELS,
  type AdminRoleRecord,
  type AdminRoleType,
  type Article,
  type AuditLogRecord,
  type FactCheckStatus,
  type Publisher,
  type UserProfile,
} from '../../types/models';

type AdminTab =
  | 'overview'
  | 'articles'
  | 'editor'
  | 'approvals'
  | 'categories'
  | 'sources'
  | 'ai'
  | 'publishers'
  | 'factchecks'
  | 'users'
  | 'settings'
  | 'audit';

export function AdminControlCenter() {
  const {
    user,
    isStaff,
    isAdmin,
    effectiveRole,
    navigate,
    setAuthModalOpen,
    allStaffArticles,
    categories,
    sources,
    publishers,
    factChecks,
    siteSettings,
    usingSampleFallback,
    seedInitialDatabase,
    refreshStaffData,
    refreshPublicData,
    showToast,
  } = useHub();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [articleFilter, setArticleFilter] = useState<string>('all');
  const [seeding, setSeeding] = useState(false);

  // Category Manager state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParent, setCatParent] = useState('');
  const [catOrder, setCatOrder] = useState(35);
  const [catTags, setCatTags] = useState('');

  // Publisher Form
  const [pubName, setPubName] = useState('');
  const [pubWebsite, setPubWebsite] = useState('');
  const [pubCountry, setPubCountry] = useState('International');
  const [pubTrust, setPubTrust] = useState<Publisher['trustClassification']>('major_newsroom');
  const [pubDesc, setPubDesc] = useState('');

  // Fact Check Form
  const [fcClaim, setFcClaim] = useState('');
  const [fcStatus, setFcStatus] = useState<FactCheckStatus>('verified');
  const [fcEvidence, setFcEvidence] = useState('');
  const [fcExplanation, setFcExplanation] = useState('');
  const [fcMethodology, setFcMethodology] = useState('Primary institutional documentation review');
  const [fcRefs, setFcRefs] = useState('');

  // Users & RBAC
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [rolesList, setRolesList] = useState<AdminRoleRecord[]>([]);
  const [roleUid, setRoleUid] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const [roleType, setRoleType] = useState<AdminRoleType>('editor');

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // AI Batch state
  const [aiProcessingId, setAiProcessingId] = useState<string | null>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState(siteSettings);

  useEffect(() => {
    updatePageSEO({
      title: 'Admin Control Center',
      description: 'Role-based editorial publishing, RSS/API source management, dynamic taxonomy, AI processing, and audit logs.',
      path: '/admin',
    });
  }, []);

  useEffect(() => {
    setSettingsForm(siteSettings);
  }, [siteSettings]);

  useEffect(() => {
    if (!isStaff) return;
    if (activeTab === 'audit') {
      void fetchAuditLogs().then(setAuditLogs).catch(() => setAuditLogs([]));
    }
    if (activeTab === 'users' && isAdmin) {
      void Promise.all([
        fetchAllUsersForAdmin().catch(() => []),
        fetchAllAdminRoles().catch(() => []),
      ]).then(([u, r]) => {
        setUsersList(u);
        setRolesList(r);
      });
    }
  }, [activeTab, isAdmin, isStaff]);

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
          Admin Control Center Sign In Required
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3">
          Sign in with an authorized administrator or editorial Google account to access publishing,
          RSS collection, and taxonomy controls.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-6 px-6 py-2.5 text-sm font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
        >
          Sign In
        </button>
      </main>
    );
  }

  if (!isStaff) {
    return (
      <main className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
          Role Permission Required
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3">
          Your account ({user.email}) currently holds the <strong>{effectiveRole}</strong> role.
          Editorial or Administrator privileges are required to modify publications, categories, or
          sources.
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="mt-6 px-6 py-2.5 text-sm font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
        >
          Open My Reader Desk
        </button>
      </main>
    );
  }

  const publishedCount = allStaffArticles.filter((a) => a.editorialStatus === 'published').length;
  const draftCount = allStaffArticles.filter((a) => a.editorialStatus === 'draft').length;
  const pendingCount = allStaffArticles.filter((a) =>
    ['pending_review', 'needs_correction'].includes(a.editorialStatus)
  ).length;
  const autoImportedCount = allStaffArticles.filter((a) => a.collectionMethod !== 'manual').length;
  const activeSourcesCount = sources.filter((s) => s.status === 'active').length;
  const failedSourcesCount = sources.filter((s) => s.status === 'error').length;

  const filteredArticles =
    articleFilter === 'all'
      ? allStaffArticles
      : allStaffArticles.filter((a) => a.editorialStatus === articleFilter);

  const pendingQueue = allStaffArticles.filter((a) =>
    ['pending_review', 'needs_correction', 'scheduled', 'draft'].includes(a.editorialStatus)
  );

  const handleSeedClick = async () => {
    setSeeding(true);
    try {
      await seedInitialDatabase();
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await saveCategory({
        name: catName.trim(),
        slug: catName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: catDesc.trim() || `Coverage and archival reports for ${catName.trim()}.`,
        parentId: catParent || undefined,
        displayOrder: catOrder,
        isActive: true,
        tags: catTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setCatName('');
      setCatDesc('');
      setCatParent('');
      setCatTags('');
      await refreshStaffData();
      await refreshPublicData();
      showToast('Category created in Firestore.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category.', 'error');
    }
  };

  const handleRunAIForArticle = async (art: Article) => {
    setAiProcessingId(art.id);
    try {
      const res = await apiClient.analyzeArticle({
        title: art.title,
        content: art.content,
        originalSource: art.originalSource,
        availableCategories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
      });
      await saveArticle(
        {
          ...art,
          aiSummary: res.summary,
          aiKeywords: res.keywords,
          aiProcessed: true,
          topics: Array.from(new Set([...(art.topics || []), ...res.topics])).slice(0, 15),
        },
        { changeNote: 'AI summarization & keyword indexing', actorRole: effectiveRole }
      );
      await refreshStaffData();
      showToast(`AI processed "${art.title.slice(0, 48)}..." (fact-check status unchanged).`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI processing failed.', 'error');
    } finally {
      setAiProcessingId(null);
    }
  };

  const sidebarNav: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
    { id: 'articles', label: `Article Manager (${allStaffArticles.length})`, icon: FileText },
    { id: 'editor', label: 'Manual Content Editor', icon: PenLine },
    { id: 'approvals', label: `Approval Queue (${pendingCount})`, icon: CheckCircle2 },
    { id: 'categories', label: `Categories (${categories.length})`, icon: FolderTree },
    { id: 'sources', label: `Sources & RSS (${sources.length})`, icon: Rss },
    { id: 'ai', label: 'AI Processing Manager', icon: Sparkles },
    { id: 'publishers', label: `Publishers (${publishers.length})`, icon: Globe },
    { id: 'factchecks', label: `Fact Check Manager (${factChecks.length})`, icon: ShieldCheck },
    { id: 'users', label: 'Users & RBAC Roles', icon: Users },
    { id: 'settings', label: 'SEO & Site Settings', icon: Settings },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col lg:flex-row bg-[#FAF9F6] dark:bg-[#0C0F14]">
      {/* Sidebar Navigation (260px) */}
      <aside className="lg:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#11151D] p-4 flex flex-col justify-between">
        <div>
          <div className="pb-4 mb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Public Edition
            </button>
            <p className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
              Control Center
            </p>
            <p className="text-[11px] font-mono text-[#1E3A8A] dark:text-[#60A5FA] uppercase mt-0.5">
              Role: {effectiveRole.replace(/_/g, ' ')}
            </p>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {sidebarNav.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium whitespace-nowrap text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold'
                      : 'text-[#57534E] dark:text-[#9CA3AF] hover:bg-[#FAF9F6] dark:hover:bg-[#171D28] hover:text-[#141413] dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-4 mt-6 border-t border-[#E5E2DC] dark:border-[#232A36] text-[11px] text-[#78716C]">
          Signed in as <span className="font-mono break-all">{user.email}</span>
        </div>
      </aside>

      {/* Main Workspace Viewport */}
      <main className="flex-1 min-w-0 p-5 sm:p-8 max-w-[1200px]">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
              <div>
                <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                  Platform Operations Overview
                </h1>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                  Live Firestore inventory across manual publishing, automatic RSS/API ingestion, and editorial verification.
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => void handleSeedClick()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  {seeding
                    ? 'Writing to Firestore...'
                    : usingSampleFallback
                      ? 'Initialize Firestore Database'
                      : 'Sync Default 30 Categories & Sources'}
                </button>
              )}
            </div>

            {/* KPI Grid (Tabular Numerals) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Total Articles', allStaffArticles.length],
                ['Published Live', publishedCount],
                ['Pending Approvals', pendingCount],
                ['Drafts', draftCount],
                ['Automatic Imports', autoImportedCount],
                ['Active Sources', activeSourcesCount],
                ['Failed Sources', failedSourcesCount],
                ['Dynamic Categories', categories.length],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4"
                >
                  <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">{label}</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums text-[#141413] dark:text-[#F3F4F6] mt-1">
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick Launch Modules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setActiveTab('editor');
                }}
                className="text-left p-5 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] hover:border-[#1E3A8A] dark:hover:border-[#60A5FA] cursor-pointer"
              >
                <p className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">Manual CMS</p>
                <p className="font-serif text-lg font-semibold mt-1">Publish New Article or Report</p>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                  Rich text editor, data tables, PDF attachments, AI summary assist, and live preview.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sources')}
                className="text-left p-5 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] hover:border-[#1E3A8A] dark:hover:border-[#60A5FA] cursor-pointer"
              >
                <p className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">Auto Ingestion</p>
                <p className="font-serif text-lg font-semibold mt-1">Fetch Live RSS / API Feeds</p>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                  Run server-side collection on BBC, NASA, arXiv, UN News, or custom permitted feeds.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('approvals')}
                className="text-left p-5 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] hover:border-[#1E3A8A] dark:hover:border-[#60A5FA] cursor-pointer"
              >
                <p className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA]">Editorial Workflow</p>
                <p className="font-serif text-lg font-semibold mt-1">Review Approval Queue ({pendingCount})</p>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                  Approve, return for correction, or reject auto-collected and draft submissions.
                </p>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'articles' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                Central Article Manager
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={articleFilter}
                  onChange={(e) => setArticleFilter(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(EDITORIAL_STATUS_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setEditingArticle(null);
                    setActiveTab('editor');
                  }}
                  className="px-4 py-1.5 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold cursor-pointer"
                >
                  + New Article
                </button>
              </div>
            </div>

            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] dark:bg-[#11151D] border-b border-[#E5E2DC] dark:border-[#232A36]">
                    <th className="px-4 py-3 font-semibold">Headline</th>
                    <th className="px-4 py-3 font-semibold">Method / Source</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                  {filteredArticles.map((art) => (
                    <tr key={art.id}>
                      <td className="px-4 py-3 max-w-md">
                        <p className="font-serif text-sm font-semibold text-[#141413] dark:text-[#F3F4F6] line-clamp-1">
                          {art.title}
                        </p>
                        <p className="text-[11px] text-[#57534E] dark:text-[#9CA3AF]">
                          {art.categoryId} · {art.language.toUpperCase()} {art.isSampleData ? '· Sample' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        <p>{art.collectionMethod}</p>
                        <p className="text-[#57534E] dark:text-[#9CA3AF] truncate max-w-[160px]">
                          {art.originalSource}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold uppercase text-[11px]">
                        {EDITORIAL_STATUS_LABELS[art.editorialStatus]}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                        {formatShortDate(art.publishedAt || art.collectedAt)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingArticle(art);
                            setActiveTab('editor');
                          }}
                          className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/article/${art.slug}`)}
                          className="text-[#57534E] dark:text-[#9CA3AF] hover:underline cursor-pointer"
                        >
                          View
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteArticleById(art.id, effectiveRole);
                              await refreshStaffData();
                              showToast('Article deleted.', 'info');
                            }}
                            className="text-[#B91C1C] hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'editor' && (
          <ManualArticleEditor
            editingArticle={editingArticle}
            onSaved={async () => {
              await refreshStaffData();
              await refreshPublicData();
              setEditingArticle(null);
              setActiveTab('articles');
            }}
            onClearEdit={() => setEditingArticle(null)}
          />
        )}

        {activeTab === 'approvals' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                Editorial Approval Queue ({pendingQueue.length})
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                Collected & uploaded workflow: Validation → Duplicate Check → AI Indexing → Editorial Review → Approval → Publication.
              </p>
            </div>
            <div className="space-y-4">
              {pendingQueue.map((art) => (
                <div
                  key={art.id}
                  className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-mono uppercase font-semibold text-[#92400E] dark:text-[#FCD34D]">
                      {EDITORIAL_STATUS_LABELS[art.editorialStatus]} · {art.collectionMethod} · {art.originalSource}
                    </span>
                    <span className="font-mono text-[#78716C] tabular-nums">
                      Indexed: {formatShortDate(art.collectedAt)}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                    {art.title}
                  </h3>
                  <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] leading-relaxed">
                    {art.summary}
                  </p>
                  <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateArticleEditorialStatus(art.id, 'published', effectiveRole);
                        await refreshStaffData();
                        await refreshPublicData();
                        showToast('Article approved and published live.', 'success');
                      }}
                      className="px-3.5 py-1.5 bg-[#166534] text-white font-semibold cursor-pointer"
                    >
                      Approve & Publish
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticle(art);
                        setActiveTab('editor');
                      }}
                      className="px-3.5 py-1.5 border border-[#E5E2DC] dark:border-[#232A36] font-medium cursor-pointer"
                    >
                      Edit Before Approval
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateArticleEditorialStatus(art.id, 'needs_correction', effectiveRole);
                        await refreshStaffData();
                        showToast('Returned for editorial correction.', 'info');
                      }}
                      className="px-3.5 py-1.5 border border-[#92400E] text-[#92400E] dark:text-[#FCD34D] cursor-pointer"
                    >
                      Return for Correction
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateArticleEditorialStatus(art.id, 'rejected', effectiveRole);
                        await refreshStaffData();
                        showToast('Submission rejected.', 'info');
                      }}
                      className="px-3.5 py-1.5 border border-[#B91C1C] text-[#B91C1C] dark:text-[#FCA5A5] cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingQueue.length === 0 && (
                <div className="p-10 text-center border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] text-sm text-[#57534E]">
                  The editorial approval queue is clear. Fetch an RSS source or submit a draft to review new items here.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                Dynamic Category & Subcategory Manager ({categories.length})
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                Create unlimited categories and nested subcategories stored directly in Firestore.
              </p>
            </div>

            <form
              onSubmit={handleCreateCategory}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"
            >
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Category or Subcategory Name"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <select
                value={catParent}
                onChange={(e) => setCatParent(e.target.value)}
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              >
                <option value="">Top-Level Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    Subcategory under: {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={catOrder}
                onChange={(e) => setCatOrder(Number(e.target.value))}
                placeholder="Display Order"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] tabular-nums"
              />
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Category Description"
                className="md:col-span-2 px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <input
                type="text"
                value={catTags}
                onChange={(e) => setCatTags(e.target.value)}
                placeholder="Tags (comma separated)"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <button
                type="submit"
                className="md:col-span-3 w-fit px-5 py-2 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold cursor-pointer"
              >
                + Add Category / Subcategory
              </button>
            </form>

            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] dark:bg-[#11151D] border-b border-[#E5E2DC] dark:border-[#232A36]">
                    <th className="px-4 py-2.5">Order</th>
                    <th className="px-4 py-2.5">Name / Parent</th>
                    <th className="px-4 py-2.5">Slug</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                  {categories.map((c) => {
                    const parent = c.parentId ? categories.find((p) => p.id === c.parentId) : null;
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-2.5 font-mono tabular-nums">{c.displayOrder}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-[#141413] dark:text-[#F3F4F6]">
                            {parent ? `↳ ${c.name}` : c.name}
                          </span>
                          {parent && (
                            <span className="ml-2 text-[11px] text-[#78716C]">({parent.name})</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[#57534E] dark:text-[#9CA3AF]">{c.slug}</td>
                        <td className="px-4 py-2.5">{c.isActive ? 'Active' : 'Inactive'}</td>
                        <td className="px-4 py-2.5 text-right space-x-3">
                          <button
                            type="button"
                            onClick={async () => {
                              await saveCategory({ ...c, isActive: !c.isActive });
                              await refreshStaffData();
                              await refreshPublicData();
                            }}
                            className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteCategoryById(c.id);
                                await refreshStaffData();
                                await refreshPublicData();
                              }}
                              className="text-[#B91C1C] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'sources' && <SourceCollectionManager />}

        {activeTab === 'ai' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                AI Processing Manager
              </h2>
              <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
                Active Server Provider: <strong>{siteSettings.aiProviderName}</strong>. Trigger
                source-grounded summarization, keyword extraction, and topic indexing on articles.
                AI processing never automatically marks articles as factually verified.
              </p>
            </div>
            <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
              {allStaffArticles.slice(0, 15).map((art) => (
                <div key={art.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-serif text-base font-semibold text-[#141413] dark:text-[#F3F4F6]">
                      {art.title}
                    </p>
                    <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-0.5">
                      AI Indexed: {art.aiProcessed ? 'Yes' : 'Pending'} · Keywords:{' '}
                      {(art.aiKeywords || []).join(', ') || 'None yet'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={aiProcessingId === art.id}
                    onClick={() => void handleRunAIForArticle(art)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiProcessingId === art.id ? 'Processing...' : 'Run AI Indexer'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'publishers' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Publisher Directory Manager ({publishers.length})
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await savePublisher({
                  name: pubName,
                  slug: pubName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  websiteUrl: pubWebsite,
                  country: pubCountry,
                  language: 'en',
                  trustClassification: pubTrust,
                  description: pubDesc,
                });
                setPubName('');
                setPubWebsite('');
                setPubDesc('');
                await refreshStaffData();
                showToast('Publisher saved.', 'success');
              }}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
            >
              <input
                type="text"
                required
                value={pubName}
                onChange={(e) => setPubName(e.target.value)}
                placeholder="Publisher Name"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <input
                type="url"
                required
                value={pubWebsite}
                onChange={(e) => setPubWebsite(e.target.value)}
                placeholder="Official Website URL (https://...)"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <input
                type="text"
                value={pubCountry}
                onChange={(e) => setPubCountry(e.target.value)}
                placeholder="Country"
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <select
                value={pubTrust}
                onChange={(e) => setPubTrust(e.target.value as Publisher['trustClassification'])}
                className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              >
                <option value="official_government">Official Government</option>
                <option value="peer_reviewed">Peer-Reviewed Institution</option>
                <option value="major_newsroom">Major Newsroom</option>
                <option value="verified_independent">Verified Independent</option>
                <option value="standard">Standard</option>
              </select>
              <input
                type="text"
                value={pubDesc}
                onChange={(e) => setPubDesc(e.target.value)}
                placeholder="Short publisher profile description"
                className="md:col-span-2 px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <button
                type="submit"
                className="w-fit px-5 py-2 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold cursor-pointer"
              >
                + Register Publisher
              </button>
            </form>
          </div>
        )}

        {activeTab === 'factchecks' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Fact Check Manager ({factChecks.length})
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveFactCheck({
                  claim: fcClaim,
                  status: fcStatus,
                  evidence: fcEvidence,
                  explanation: fcExplanation,
                  methodology: fcMethodology,
                  references: fcRefs
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  reviewerName: user.displayName || user.email || 'Verification Desk',
                  isSampleData: false,
                });
                setFcClaim('');
                setFcEvidence('');
                setFcExplanation('');
                setFcRefs('');
                await refreshStaffData();
                await refreshPublicData();
                showToast('Fact-check record published.', 'success');
              }}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 space-y-3 text-xs"
            >
              <input
                type="text"
                required
                value={fcClaim}
                onChange={(e) => setFcClaim(e.target.value)}
                placeholder="Exact claim evaluated..."
                className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={fcStatus}
                  onChange={(e) => setFcStatus(e.target.value as FactCheckStatus)}
                  className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                >
                  {Object.entries(FACT_CHECK_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      Verdict: {lbl}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={fcMethodology}
                  onChange={(e) => setFcMethodology(e.target.value)}
                  placeholder="Verification methodology"
                  className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>
              <textarea
                rows={2}
                required
                value={fcEvidence}
                onChange={(e) => setFcEvidence(e.target.value)}
                placeholder="Primary documentary evidence..."
                className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <textarea
                rows={2}
                required
                value={fcExplanation}
                onChange={(e) => setFcExplanation(e.target.value)}
                placeholder="Clear reader explanation..."
                className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <input
                type="text"
                value={fcRefs}
                onChange={(e) => setFcRefs(e.target.value)}
                placeholder="Reference URLs (comma separated)"
                className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] font-semibold cursor-pointer"
              >
                Publish Fact-Check Verdict
              </button>
            </form>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Users & Role-Based Access Control (RBAC)
            </h2>
            {isAdmin ? (
              <>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await assignAdminRole({
                      uid: roleUid.trim(),
                      email: roleEmail.trim(),
                      role: roleType,
                      active: true,
                    });
                    setRoleUid('');
                    setRoleEmail('');
                    const updated = await fetchAllAdminRoles().catch(() => []);
                    setRolesList(updated);
                    showToast('Role assigned in Firestore admin_roles.', 'success');
                  }}
                  className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
                >
                  <input
                    type="text"
                    required
                    value={roleUid}
                    onChange={(e) => setRoleUid(e.target.value)}
                    placeholder="Firebase User UID"
                    className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  />
                  <input
                    type="email"
                    required
                    value={roleEmail}
                    onChange={(e) => setRoleEmail(e.target.value)}
                    placeholder="Staff Email"
                    className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  />
                  <select
                    value={roleType}
                    onChange={(e) => setRoleType(e.target.value as AdminRoleType)}
                    className="px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    <option value="editor">Editor</option>
                    <option value="author">Author</option>
                    <option value="reviewer">Reviewer / Fact-Checker</option>
                    <option value="source_manager">Source Manager</option>
                    <option value="administrator">Administrator</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold cursor-pointer"
                  >
                    Assign Role
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4">
                    <p className="font-semibold mb-3">Registered Users ({usersList.length})</p>
                    <div className="divide-y divide-[#F0EDE6] dark:divide-[#1B2230]">
                      {usersList.map((u) => (
                        <div key={u.uid} className="py-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">{u.displayName}</p>
                            <p className="font-mono text-[11px] text-[#78716C]">{u.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setRoleUid(u.uid);
                              setRoleEmail(u.email);
                            }}
                            className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                          >
                            Select UID
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4">
                    <p className="font-semibold mb-3">Assigned Staff Roles ({rolesList.length})</p>
                    <div className="divide-y divide-[#F0EDE6] dark:divide-[#1B2230]">
                      {rolesList.map((r) => (
                        <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-[11px]">{r.email}</p>
                            <p className="font-semibold uppercase text-[#1E3A8A] dark:text-[#60A5FA]">
                              {r.role} · {r.active ? 'Active' : 'Revoked'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await assignAdminRole({
                                uid: r.uid,
                                email: r.email,
                                role: r.role,
                                active: !r.active,
                              });
                              const updated = await fetchAllAdminRoles().catch(() => []);
                              setRolesList(updated);
                            }}
                            className="text-[#B91C1C] hover:underline cursor-pointer"
                          >
                            {r.active ? 'Revoke' : 'Activate'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#57534E]">
                Administrator or Super Admin role is required to modify RBAC assignments.
              </p>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-5">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              SEO, Editorial Policy & Website Settings
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveSiteSettings({
                  siteName: settingsForm.siteName,
                  tagline: settingsForm.tagline,
                  defaultRequireApproval: settingsForm.defaultRequireApproval,
                  enabledLanguages: settingsForm.enabledLanguages,
                  breakingTickerEnabled: settingsForm.breakingTickerEnabled,
                  seoDefaultTitle: settingsForm.seoDefaultTitle,
                  seoDefaultDescription: settingsForm.seoDefaultDescription,
                  aiProviderName: settingsForm.aiProviderName,
                });
                await refreshPublicData();
                showToast('Platform settings saved to Firestore.', 'success');
              }}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block text-[#57534E] mb-1">Platform Title</label>
                <input
                  type="text"
                  value={settingsForm.siteName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, siteName: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>
              <div>
                <label className="block text-[#57534E] mb-1">Default SEO Title</label>
                <input
                  type="text"
                  value={settingsForm.seoDefaultTitle}
                  onChange={(e) => setSettingsForm({ ...settingsForm, seoDefaultTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>
              <div>
                <label className="block text-[#57534E] mb-1">Default SEO Meta Description</label>
                <textarea
                  rows={2}
                  value={settingsForm.seoDefaultDescription}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, seoDefaultDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>
              <label className="flex items-center justify-between py-2 border-y border-[#F0EDE6] dark:border-[#1B2230] cursor-pointer">
                <span>Require editorial approval by default for all auto-collected RSS/API items</span>
                <input
                  type="checkbox"
                  checked={settingsForm.defaultRequireApproval}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultRequireApproval: e.target.checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between py-2 border-b border-[#F0EDE6] dark:border-[#1B2230] cursor-pointer">
                <span>Display Breaking News Ticker on public editions</span>
                <input
                  type="checkbox"
                  checked={settingsForm.breakingTickerEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, breakingTickerEnabled: e.target.checked })
                  }
                />
              </label>
              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] font-semibold cursor-pointer"
                >
                  Save Settings
                </button>
                <div className="flex items-center gap-3 text-[#1E3A8A] dark:text-[#60A5FA]">
                  <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    View /sitemap.xml
                  </a>
                  <a href="/robots.txt" target="_blank" rel="noopener noreferrer" className="hover:underline">
                    View /robots.txt
                  </a>
                </div>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Immutable Administrative Audit Logs ({auditLogs.length})
            </h2>
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] dark:bg-[#11151D] border-b border-[#E5E2DC] dark:border-[#232A36]">
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">Actor</th>
                    <th className="px-4 py-2.5">Target</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                  {auditLogs.slice(0, 30).map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 font-mono font-semibold">{log.action}</td>
                      <td className="px-4 py-2.5">
                        {log.actorEmail} <span className="text-[#78716C]">({log.actorRole})</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {log.targetType}/{log.targetId}
                      </td>
                      <td className="px-4 py-2.5 text-[#57534E] dark:text-[#9CA3AF]">{log.details}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[#57534E]">
                        Administrative mutations (article saves, approvals, source fetches, role changes) appear here automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
