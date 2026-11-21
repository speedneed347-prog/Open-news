import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Eye,
  FilePlus2,
  History,
  PenLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useHub } from '../../context/HubContext';
import { RichContentRenderer } from '../../components/RichContentRenderer';
import { EditorialImage } from '../../components/EditorialImage';
import { apiClient } from '../../lib/apiClient';
import { fetchArticleVersions, saveArticle } from '../../lib/firestoreService';
import { EDITORIAL_IMAGES } from '../../lib/seedData';
import {
  CONTENT_TYPE_LABELS,
  type Article,
  type ArticleAttachment,
  type ArticleVersion,
  type ContentType,
  type CopyrightPermissionStatus,
  type EditorialStatus,
  type FactCheckStatus,
} from '../../types/models';

interface ManualArticleEditorProps {
  editingArticle: Article | null;
  onSaved: () => void;
  onClearEdit: () => void;
}

const AUTOSAVE_KEY = 'aih_editor_autosave_v1';

export function ManualArticleEditor({
  editingArticle,
  onSaved,
  onClearEdit,
}: ManualArticleEditorProps) {
  const { categories, effectiveRole, showToast } = useHub();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<ContentType>('article');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'national-news');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [originalSource, setOriginalSource] = useState('ALL INFORMATION HUB Editorial Desk');
  const [originalSourceUrl, setOriginalSourceUrl] = useState('');
  const [authorName, setAuthorName] = useState('Editorial Staff');
  const [country, setCountry] = useState('International');
  const [language, setLanguage] = useState('en');
  const [tagsText, setTagsText] = useState('');
  const [topicsText, setTopicsText] = useState('');
  const [featuredImage, setFeaturedImage] = useState(EDITORIAL_IMAGES.heroEconomy);
  const [copyrightStatus, setCopyrightStatus] = useState<CopyrightPermissionStatus>('original');
  const [factCheckStatus, setFactCheckStatus] = useState<FactCheckStatus>('unverified');
  const [isBreaking, setIsBreaking] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [attachments, setAttachments] = useState<ArticleAttachment[]>([]);
  const [newAttLabel, setNewAttLabel] = useState('');
  const [newAttUrl, setNewAttUrl] = useState('');
  const [newAttType, setNewAttType] = useState<ArticleAttachment['type']>('pdf');

  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Hydrate when editing an existing article or restoring autosave
  useEffect(() => {
    if (editingArticle) {
      setTitle(editingArticle.title);
      setSubtitle(editingArticle.subtitle || '');
      setSummary(editingArticle.summary);
      setContent(editingArticle.content);
      setContentType(editingArticle.contentType);
      setCategoryId(editingArticle.categoryId);
      setSubcategoryId(editingArticle.subcategoryId || '');
      setOriginalSource(editingArticle.originalSource);
      setOriginalSourceUrl(editingArticle.originalSourceUrl || '');
      setAuthorName(editingArticle.authorName);
      setCountry(editingArticle.country);
      setLanguage(editingArticle.language);
      setTagsText((editingArticle.tags || []).join(', '));
      setTopicsText((editingArticle.topics || []).join(', '));
      setFeaturedImage(editingArticle.featuredImage || '');
      setCopyrightStatus(editingArticle.copyrightPermissionStatus);
      setFactCheckStatus(editingArticle.factCheckStatus);
      setIsBreaking(Boolean(editingArticle.isBreaking));
      setIsFeatured(Boolean(editingArticle.isFeatured));
      setScheduledAt(editingArticle.scheduledAt || '');
      setSeoTitle(editingArticle.seoTitle || '');
      setSeoDescription(editingArticle.seoDescription || '');
      setAttachments(editingArticle.attachments || []);
      setChangeNote('');
      void fetchArticleVersions(editingArticle.id).then(setVersions).catch(() => setVersions([]));
    } else {
      setVersions([]);
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, string>;
          if (parsed.title) setTitle(parsed.title);
          if (parsed.subtitle) setSubtitle(parsed.subtitle);
          if (parsed.summary) setSummary(parsed.summary);
          if (parsed.content) setContent(parsed.content);
        }
      } catch {
        // ignore
      }
    }
  }, [editingArticle]);

  // Autosave new drafts locally every 4 seconds
  useEffect(() => {
    if (editingArticle) return;
    if (!title && !content) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ title, subtitle, summary, content }));
      setAutosaveStatus(`Autosaved locally at ${new Date().toLocaleTimeString()}`);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [content, editingArticle, subtitle, summary, title]);

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = categories.filter((c) => c.parentId === categoryId);

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => `${prev}\n${snippet}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    window.setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleAIAssist = async () => {
    if (!title.trim() || !content.trim()) {
      showToast('Enter a headline and body text before running AI editorial assist.', 'info');
      return;
    }
    setAiLoading(true);
    try {
      const res = await apiClient.analyzeArticle({
        title,
        content,
        originalSource,
        availableCategories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
      });
      if (!summary.trim()) setSummary(res.summary);
      setTagsText(res.keywords.join(', '));
      setTopicsText(res.topics.join(', '));
      if (res.detectedLanguage) setLanguage(res.detectedLanguage);
      if (res.suggestedCategoryId && categories.some((c) => c.id === res.suggestedCategoryId)) {
        const matched = categories.find((c) => c.id === res.suggestedCategoryId)!;
        if (matched.parentId) {
          setCategoryId(matched.parentId);
          setSubcategoryId(matched.id);
        } else {
          setCategoryId(matched.id);
        }
      }
      showToast('AI suggested summary, keywords, language, and category.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI assist failed.', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddAttachment = () => {
    if (!newAttLabel.trim() || !newAttUrl.trim()) return;
    if (!/^https?:\/\//i.test(newAttUrl.trim())) {
      showToast('Attachment URL must begin with https:// or http://', 'error');
      return;
    }
    setAttachments((prev) => [
      ...prev,
      {
        id: `att_${Date.now().toString(36)}`,
        label: newAttLabel.trim(),
        url: newAttUrl.trim(),
        type: newAttType,
      },
    ]);
    setNewAttLabel('');
    setNewAttUrl('');
  };

  const handleSave = async (targetStatus: EditorialStatus) => {
    if (title.trim().length < 3 || summary.trim().length < 5 || content.trim().length < 10) {
      showToast('Headline, executive summary, and body content are required.', 'error');
      return;
    }
    if (targetStatus === 'scheduled' && !scheduledAt) {
      showToast('Select a scheduled publication date and time first.', 'error');
      return;
    }

    setSaving(true);
    try {
      await saveArticle(
        {
          id: editingArticle?.id,
          title,
          subtitle,
          summary,
          content,
          contentType,
          categoryId,
          subcategoryId: subcategoryId || undefined,
          originalSource,
          originalSourceUrl,
          authorName,
          country,
          language,
          tags: tagsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          topics: topicsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          featuredImage,
          attachments,
          copyrightPermissionStatus: copyrightStatus,
          editorialStatus: targetStatus,
          factCheckStatus,
          isBreaking,
          isFeatured,
          scheduledAt: targetStatus === 'scheduled' ? scheduledAt : '',
          seoTitle: seoTitle || title,
          seoDescription: seoDescription || summary,
          collectionMethod: editingArticle?.collectionMethod || 'manual',
          isSampleData: false,
        },
        {
          changeNote: changeNote || `Saved as ${targetStatus}`,
          actorRole: effectiveRole,
        }
      );
      if (!editingArticle) {
        localStorage.removeItem(AUTOSAVE_KEY);
      }
      showToast(`Article saved to Firestore (${targetStatus.replace('_', ' ')}).`, 'success');
      onSaved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save article.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
            {editingArticle ? 'Edit Publication' : 'Manual Content Publishing Editor'}
          </h2>
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-0.5">
            {autosaveStatus || 'Supports news, research papers, government notices, tables, PDFs, and live preview.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editingArticle && (
            <button
              type="button"
              onClick={onClearEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E5E2DC] dark:border-[#232A36] cursor-pointer"
            >
              <FilePlus2 className="w-3.5 h-3.5" /> New Blank Article
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleAIAssist()}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#1E3A8A] dark:border-[#60A5FA] text-[#1E3A8A] dark:text-[#60A5FA] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? 'Analyzing...' : 'AI Categorize & Summarize'}
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
          >
            {previewMode ? <PenLine className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewMode ? 'Back to Editor' : 'Preview Published Page'}
          </button>
        </div>
      </div>

      {previewMode ? (
        <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-8 max-w-4xl">
          <p className="text-xs font-mono text-[#1E3A8A] dark:text-[#60A5FA] uppercase">
            Live Publication Preview · {CONTENT_TYPE_LABELS[contentType]} · {language.toUpperCase()}
          </p>
          <h1 className="font-serif text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
            {title || 'Untitled Publication'}
          </h1>
          {subtitle && (
            <p className="text-lg text-[#44403C] dark:text-[#CBD5E1] mt-3">{subtitle}</p>
          )}
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-4 pb-4 border-b border-[#E5E2DC] dark:border-[#232A36]">
            By {authorName} · {originalSource} · {country}
          </p>
          {featuredImage && (
            <EditorialImage src={featuredImage} alt={title || 'Preview'} aspectClass="aspect-[16/9]" className="mt-6" />
          )}
          <div className="mt-6 p-4 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-sm">
            {summary || 'Executive summary will appear here.'}
          </div>
          <div className="mt-6">
            <RichContentRenderer content={content || 'Body content preview...'} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Writing Canvas */}
          <div className="xl:col-span-8 space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Headline (required, 3–300 characters)"
              className="w-full px-4 py-3 font-serif text-2xl font-semibold bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
            />

            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Deck / Subtitle (optional)"
              className="w-full px-4 py-2.5 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
            />

            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Executive summary (displayed in cards, search results, and SEO snippets)..."
              className="w-full px-4 py-2.5 text-sm bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
            />

            {/* Rich Editorial Formatting Toolbar */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
              <div className="px-3 py-2 border-b border-[#E5E2DC] dark:border-[#232A36] flex flex-wrap items-center gap-1.5 text-xs bg-[#FAF9F6] dark:bg-[#11151D]">
                {[
                  ['H2 Heading', '\n## Section Heading\n'],
                  ['H3 Subhead', '\n### Subsection Title\n'],
                  ['Bold', '**important text**'],
                  ['Pull Quote', '\n> "Attributed quotation or official excerpt." — Source\n'],
                  ['Bullet List', '\n- Key point one\n- Key point two\n'],
                  [
                    'Data Table',
                    '\n| Indicator | 2025 | 2026 |\n| --- | --- | --- |\n| Metric A | 4.2% | 3.8% |\n',
                  ],
                  ['Citation', '\n### References & Sources\n1. Official Document Title (Institution, Year)\n'],
                ].map(([label, snippet]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => insertSnippet(snippet)}
                    className="px-2.5 py-1 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] hover:bg-[#EBE6DF] dark:hover:bg-[#1E2636] cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write full article prose, statistical tables, quotations, and verified citations..."
                className="w-full p-4 text-sm leading-relaxed font-sans bg-white dark:bg-[#141922] text-[#141413] dark:text-[#F3F4F6] focus:outline-none"
              />
            </div>

            {/* Attachments & Media Manager (PDFs, Videos, Datasets) */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4 space-y-3">
              <p className="text-xs font-semibold text-[#141413] dark:text-[#F3F4F6]">
                Attachments (PDF Reports, Documents, Datasets, Video Links)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                <input
                  type="text"
                  value={newAttLabel}
                  onChange={(e) => setNewAttLabel(e.target.value)}
                  placeholder="Document title (e.g. Official Gazette PDF)"
                  className="sm:col-span-4 px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
                <input
                  type="url"
                  value={newAttUrl}
                  onChange={(e) => setNewAttUrl(e.target.value)}
                  placeholder="https://..."
                  className="sm:col-span-5 px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
                <select
                  value={newAttType}
                  onChange={(e) => setNewAttType(e.target.value as ArticleAttachment['type'])}
                  className="sm:col-span-2 px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                >
                  <option value="pdf">PDF</option>
                  <option value="document">Document</option>
                  <option value="dataset">Dataset</option>
                  <option value="video">Video</option>
                  <option value="image">Gallery</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="sm:col-span-1 inline-flex items-center justify-center bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] py-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {attachments.length > 0 && (
                <ul className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] text-xs">
                  {attachments.map((att) => (
                    <li key={att.id} className="py-2 flex items-center justify-between gap-2">
                      <span className="truncate">
                        [{att.type.toUpperCase()}] {att.label} — {att.url}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="text-[#B91C1C] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right Metadata & Workflow Sidebar */}
          <div className="xl:col-span-4 space-y-4 text-xs">
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4 space-y-3">
              <p className="font-semibold text-[#141413] dark:text-[#F3F4F6] uppercase tracking-wider text-[11px]">
                Classification & Attribution
              </p>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Content Type</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as ContentType)}
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                >
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubcategoryId('');
                    }}
                    className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    {rootCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Subcategory</label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    disabled={subCategories.length === 0}
                    className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] disabled:opacity-50"
                  >
                    <option value="">None</option>
                    {subCategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  />
                </div>
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    <option value="en">English (en)</option>
                    <option value="bn">Bengali (bn)</option>
                    <option value="hi">Hindi (hi)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Original Source / Publisher</label>
                <input
                  type="text"
                  value={originalSource}
                  onChange={(e) => setOriginalSource(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Original Source URL (optional)</label>
                <input
                  type="url"
                  value={originalSourceUrl}
                  onChange={(e) => setOriginalSourceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Author Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Featured Image</label>
                <select
                  value={featuredImage}
                  onChange={(e) => setFeaturedImage(e.target.value)}
                  className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                >
                  <option value={EDITORIAL_IMAGES.heroEconomy}>Global Economy & Parliament Plate</option>
                  <option value={EDITORIAL_IMAGES.scienceSpace}>Deep-Space Radio Observatory Plate</option>
                  <option value={EDITORIAL_IMAGES.aiResearch}>AI & Robotics Laboratory Plate</option>
                  <option value={EDITORIAL_IMAGES.climateAgriculture}>Climate & Agriculture Plate</option>
                  <option value={EDITORIAL_IMAGES.civicConstitution}>Constitutional Archive Hall Plate</option>
                  <option value="">No Image</option>
                </select>
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Topics (comma separated)</label>
                <input
                  type="text"
                  value={topicsText}
                  onChange={(e) => setTopicsText(e.target.value)}
                  placeholder="Inflation, Monetary Policy"
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Keywords / Tags (comma separated)</label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="cpi, economy, research"
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Copyright Rights</label>
                  <select
                    value={copyrightStatus}
                    onChange={(e) => setCopyrightStatus(e.target.value as CopyrightPermissionStatus)}
                    className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    <option value="original">Original</option>
                    <option value="full_licensed">Full Licensed</option>
                    <option value="excerpt_and_link">Excerpt & Link</option>
                    <option value="public_domain">Public Domain</option>
                    <option value="cc_licensed">CC Licensed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">Fact-Check Status</label>
                  <select
                    value={factCheckStatus}
                    onChange={(e) => setFactCheckStatus(e.target.value as FactCheckStatus)}
                    className="w-full px-2 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="under_review">Under Review</option>
                    <option value="verified">Verified</option>
                    <option value="partially_verified">Partially Verified</option>
                    <option value="disputed">Disputed</option>
                    <option value="false">False</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  Featured Story
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} />
                  Breaking Ticker
                </label>
              </div>
            </div>

            {/* Publishing Actions & Scheduling */}
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4 space-y-3">
              <p className="font-semibold text-[#141413] dark:text-[#F3F4F6] uppercase tracking-wider text-[11px]">
                Editorial Publishing Workflow
              </p>
              <input
                type="text"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Revision note (recorded in version history)..."
                className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <div>
                <label className="block text-[#57534E] dark:text-[#9CA3AF] mb-1">
                  Schedule Publication (optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave('draft')}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-[#E5E2DC] dark:border-[#232A36] font-medium cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave('pending_review')}
                  className="py-2 px-3 border border-[#1E3A8A] dark:border-[#60A5FA] text-[#1E3A8A] dark:text-[#60A5FA] font-semibold cursor-pointer"
                >
                  Submit Review
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave('scheduled')}
                  className="inline-flex items-center justify-center gap-1.5 py-2 px-3 border border-[#E5E2DC] dark:border-[#232A36] font-medium cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" /> Schedule
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave('published')}
                  className="py-2 px-3 bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] font-semibold cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Publish Now'}
                </button>
              </div>
            </div>

            {/* Revision History */}
            {versions.length > 0 && (
              <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-4 space-y-2">
                <p className="font-semibold text-[#141413] dark:text-[#F3F4F6] uppercase tracking-wider text-[11px] inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Revision History ({versions.length})
                </p>
                <ul className="divide-y divide-[#F0EDE6] dark:divide-[#1B2230] max-h-48 overflow-y-auto">
                  {versions.map((v) => (
                    <li key={v.id} className="py-2">
                      <p className="font-medium text-[#141413] dark:text-[#F3F4F6]">
                        v{v.versionNumber} · {v.editorialStatus}
                      </p>
                      <p className="text-[#57534E] dark:text-[#9CA3AF]">
                        {v.editorName}: {v.changeNote}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
