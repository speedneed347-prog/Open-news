import React, { useState } from 'react';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { SUPPORTED_LANGUAGES, t, type UILanguage } from '../lib/i18n';

export function Header() {
  const {
    route,
    navigate,
    darkMode,
    toggleDarkMode,
    uiLang,
    setUiLang,
    contentLangFilter,
    setContentLangFilter,
    user,
    isStaff,
    setAuthModalOpen,
    publishedArticles,
    siteSettings,
    addRecentSearch,
  } = useHub();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const breakingArticles = publishedArticles.filter((a) => a.isBreaking);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickSearch.trim();
    if (!q) {
      navigate('/search');
      return;
    }
    addRecentSearch(q);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const navItems = [
    { label: t(uiLang, 'nav_edition'), path: '/' },
    { label: t(uiLang, 'nav_categories'), path: '/categories' },
    { label: t(uiLang, 'nav_discover'), path: '/discover' },
    { label: t(uiLang, 'nav_research'), path: '/research' },
    { label: t(uiLang, 'nav_factcheck'), path: '/fact-check' },
  ];

  const deskLinks = [
    { label: 'Latest', path: '/latest' },
    { label: 'Breaking', path: '/breaking' },
    { label: 'Trending', path: '/trending' },
    { label: 'National', path: '/national' },
    { label: 'International', path: '/international' },
    { label: 'State', path: '/state' },
    { label: 'Documents', path: '/documents' },
    { label: 'Timelines', path: '/timelines' },
    { label: 'Compare Sources', path: '/compare' },
    { label: 'Publishers', path: '/publishers' },
    { label: 'Sources', path: '/sources' },
  ];

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="w-full">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 w-full bg-[#FAF9F6]/95 dark:bg-[#0C0F14]/95 backdrop-blur-sm border-b border-[#E5E2DC] dark:border-[#232A36]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="font-serif text-lg sm:text-xl font-bold tracking-tight text-[#141413] dark:text-[#F3F4F6] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t(uiLang, 'brand')}
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#57534E] dark:text-[#9CA3AF]">
            {navItems.map((item) => {
              const isActive =
                item.path === '/' ? route === '/' : route.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#141413] dark:text-[#F3F4F6] underline underline-offset-8 decoration-[#1E3A8A] dark:decoration-[#60A5FA] decoration-2'
                      : 'hover:text-[#141413] dark:hover:text-[#F3F4F6]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action (+ mobile menu trigger on small screens) */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => navigate(isStaff ? '/admin' : '/dashboard')}
                className="px-4 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isStaff ? t(uiLang, 'admin_center') : t(uiLang, 'dashboard')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t(uiLang, 'sign_in')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 text-[#141413] dark:text-[#F3F4F6] hover:bg-[#EBE6DF] dark:hover:bg-[#1B2230]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className="text-sm font-medium text-[#141413] dark:text-[#F3F4F6] py-1"
              >
                {item.label}
              </button>
            ))}
            {user && (
              <button
                type="button"
                onClick={() => {
                  navigate('/dashboard');
                  setMobileMenuOpen(false);
                }}
                className="text-sm font-medium text-[#1E3A8A] dark:text-[#60A5FA] py-1"
              >
                My Desk
              </button>
            )}
          </div>
          <div className="pt-3 border-t border-[#E5E2DC] dark:border-[#232A36] flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
            {deskLinks.map((d) => (
              <button
                key={d.path}
                type="button"
                onClick={() => {
                  navigate(d.path);
                  setMobileMenuOpen(false);
                }}
                className="hover:text-[#141413] dark:hover:text-white"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editorial Sub-Masthead & Utility Controls (Below Header, Non-Sticky) */}
      {!route.startsWith('/admin') && (
        <div className="border-b border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#11151D]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              <span className="font-mono tabular-nums">{todayFormatted}</span>
              <span aria-hidden="true">·</span>
              <span className="font-serif italic text-[#141413] dark:text-[#E5E7EB]">
                {t(uiLang, 'tagline')}
              </span>
              {user && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                  >
                    {t(uiLang, 'dashboard')}
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Search */}
              <form onSubmit={handleQuickSearch} className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 pointer-events-none" />
                <input
                  type="search"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Search edition..."
                  aria-label="Search edition"
                  className="w-44 sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6] placeholder-[#78716C] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </form>

              {/* UI & Content Language Switcher */}
              <div className="flex items-center border border-[#E5E2DC] dark:border-[#232A36] bg-[#FAF9F6] dark:bg-[#0C0F14]">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setUiLang(lang.code as UILanguage)}
                    className={`px-2 py-1 text-xs whitespace-nowrap transition-colors cursor-pointer ${
                      uiLang === lang.code
                        ? 'bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] font-semibold'
                        : 'text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white'
                    }`}
                  >
                    {lang.nativeLabel}
                  </button>
                ))}
              </div>

              {/* Content Language Filter */}
              <select
                value={contentLangFilter}
                onChange={(e) => setContentLangFilter(e.target.value)}
                aria-label="Filter articles by language"
                className="px-2 py-1 text-xs bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]"
              >
                <option value="all">All Languages</option>
                <option value="en">English Only</option>
                <option value="bn">বাংলা Only</option>
                <option value="hi">हिन्दी Only</option>
              </select>

              {/* Light / Dark Theme Toggle */}
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-1.5 border border-[#E5E2DC] dark:border-[#232A36] bg-[#FAF9F6] dark:bg-[#0C0F14] text-[#141413] dark:text-[#F3F4F6] hover:bg-[#EBE6DF] dark:hover:bg-[#1B2230] transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Desk Navigation Ribbon */}
          <div className="border-t border-[#F0EDE6] dark:border-[#1B2230]">
            <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-5 overflow-x-auto text-xs text-[#57534E] dark:text-[#9CA3AF]">
              {deskLinks.map((desk) => {
                const active = route === desk.path;
                return (
                  <button
                    key={desk.path}
                    type="button"
                    onClick={() => navigate(desk.path)}
                    className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'font-semibold text-[#1E3A8A] dark:text-[#60A5FA]'
                        : 'hover:text-[#141413] dark:hover:text-[#F3F4F6]'
                    }`}
                  >
                    {desk.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Breaking News Ticker (Editorial Broadsheet Wire) */}
      {!route.startsWith('/admin') && siteSettings.breakingTickerEnabled && breakingArticles.length > 0 && (
        <div className="border-b border-[#E5E2DC] dark:border-[#232A36] bg-[#141413] text-[#FAF9F6] dark:bg-[#171D28]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-9 flex items-center gap-4 overflow-hidden">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#FCA5A5] whitespace-nowrap shrink-0">
              {t(uiLang, 'breaking_label')}
            </span>
            <span className="text-[#57534E]" aria-hidden="true">|</span>
            <div className="overflow-hidden flex-1">
              <div className="animate-ticker flex items-center gap-10 text-xs">
                {[...breakingArticles, ...breakingArticles].map((art, idx) => (
                  <button
                    key={`${art.id}-${idx}`}
                    type="button"
                    onClick={() => navigate(`/article/${art.slug}`)}
                    className="whitespace-nowrap hover:underline text-[#F3F4F6] cursor-pointer"
                  >
                    {art.isSampleData ? '[Sample] ' : ''}
                    {art.title}
                    <span className="mx-3 text-[#9CA3AF]">·</span>
                    <span className="text-[#9CA3AF]">{art.originalSource}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
