import React, { useEffect, useMemo } from 'react';
import { ArrowLeft, Check, Plus } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ArticleCard } from '../components/ArticleCard';
import { updatePageSEO } from '../lib/seo';

export function CategoriesPage({ categorySlug }: { categorySlug?: string }) {
  const {
    navigate,
    categories,
    publishedArticles,
    userProfile,
    handleFollowToggle,
  } = useHub();

  const activeCategory = useMemo(() => {
    if (!categorySlug) return null;
    return categories.find((c) => c.slug === categorySlug || c.id === categorySlug) || null;
  }, [categories, categorySlug]);

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId && c.isActive).sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const subcategoriesForActive = useMemo(() => {
    if (!activeCategory) return [];
    return categories.filter((c) => c.parentId === activeCategory.id && c.isActive);
  }, [activeCategory, categories]);

  useEffect(() => {
    if (activeCategory) {
      updatePageSEO({
        title: `${activeCategory.name} — Desk & Archive`,
        description: activeCategory.description,
        path: `/category/${activeCategory.slug}`,
      });
    } else {
      updatePageSEO({
        title: 'All Categories & Specialized Desks',
        description: 'Explore dynamically managed news, research, education, law, science, and civic categories.',
        path: '/categories',
      });
    }
  }, [activeCategory]);

  if (activeCategory) {
    const childIds = new Set([activeCategory.id, ...subcategoriesForActive.map((s) => s.id)]);
    const catArticles = publishedArticles.filter(
      (a) => childIds.has(a.categoryId) || (a.subcategoryId && childIds.has(a.subcategoryId))
    );
    const isFollowing = userProfile?.followedCategories?.includes(activeCategory.id);
    const parentCat = activeCategory.parentId
      ? categories.find((c) => c.id === activeCategory.parentId)
      : null;

    return (
      <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
        <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
          <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#9CA3AF] mb-3">
            <button
              type="button"
              onClick={() => navigate('/categories')}
              className="inline-flex items-center gap-1 hover:text-[#141413] dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Categories
            </button>
            {parentCat && (
              <>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => navigate(`/category/${parentCat.slug}`)}
                  className="hover:underline cursor-pointer"
                >
                  {parentCat.name}
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
                {activeCategory.name}
              </h1>
              <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-2xl">
                {activeCategory.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleFollowToggle('category', activeCategory.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
                isFollowing
                  ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F3F4F6] dark:text-[#141413]'
                  : 'border-[#141413] dark:border-[#F3F4F6] text-[#141413] dark:text-[#F3F4F6]'
              }`}
            >
              {isFollowing ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isFollowing ? 'Following Desk' : 'Follow Desk'}
            </button>
          </div>

          {subcategoriesForActive.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#E5E2DC] dark:border-[#232A36] flex flex-wrap items-center gap-4 text-xs">
              <span className="font-semibold text-[#57534E] dark:text-[#9CA3AF]">Subcategories:</span>
              {subcategoriesForActive.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => navigate(`/category/${sub.slug}`)}
                  className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          {catArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {catArticles.map((art) => (
                <ArticleCard key={art.id} article={art} variant="feature" />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
              <p className="font-serif text-xl text-[#141413] dark:text-[#F3F4F6]">
                No published entries in {activeCategory.name} yet
              </p>
              <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-2">
                Use the Control Center to publish manually or map an authorized RSS feed to this category.
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Full Dynamic Category & Subcategory Directory
  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
          Dynamic Taxonomy Directory
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          All Categories & Specialized Desks ({parentCategories.length})
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-2xl">
          Every category and nested subcategory below is dynamically managed in Firestore and configurable in real time by platform editors.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentCategories.map((cat) => {
          const subs = categories.filter((c) => c.parentId === cat.id && c.isActive);
          const count = publishedArticles.filter(
            (a) => a.categoryId === cat.id || subs.some((s) => s.id === a.subcategoryId)
          ).length;
          const isFollowing = userProfile?.followedCategories?.includes(cat.id);

          return (
            <div
              key={cat.id}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/category/${cat.slug}`)}
                    className="text-left font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer"
                  >
                    {cat.name}
                  </button>
                  <span className="font-mono text-xs tabular-nums text-[#78716C] shrink-0">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-2 leading-relaxed">
                  {cat.description}
                </p>

                {subs.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#F0EDE6] dark:border-[#1B2230] flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {subs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => navigate(`/category/${s.slug}`)}
                        className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                      >
                        ↳ {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[#F0EDE6] dark:border-[#1B2230] flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className="font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline cursor-pointer"
                >
                  Open Desk
                </button>
                <button
                  type="button"
                  onClick={() => void handleFollowToggle('category', cat.id)}
                  className="text-[#57534E] dark:text-[#9CA3AF] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer"
                >
                  {isFollowing ? 'Following' : '+ Follow'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
