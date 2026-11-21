import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, BOOTSTRAP_ADMIN_EMAIL, googleProvider } from '../lib/firebase';
import {
  ensureUserProfile,
  fetchAllArticlesForStaff,
  fetchCategories,
  fetchFactChecks,
  fetchPublishedArticles,
  fetchPublishers,
  fetchReadingHistory,
  fetchReadingLists,
  fetchSavedSearches,
  fetchSiteSettings,
  fetchSources,
  fetchTimelines,
  fetchUserBookmarks,
  seedDatabaseToFirestore,
  toggleBookmark,
  updateUserProfile,
} from '../lib/firestoreService';
import {
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_FACT_CHECKS,
  INITIAL_PUBLISHERS,
  INITIAL_SOURCES,
  INITIAL_TIMELINES,
  SAMPLE_ARTICLES,
} from '../lib/seedData';
import type { UILanguage } from '../lib/i18n';
import type {
  Article,
  BookmarkRecord,
  Category,
  FactCheckRecord,
  Publisher,
  ReadingHistoryRecord,
  ReadingListRecord,
  SavedSearchRecord,
  SiteSettings,
  SourceConfig,
  TimelineRecord,
  UserProfile,
} from '../types/models';

interface HubContextValue {
  // Navigation
  route: string;
  navigate: (path: string) => void;
  // Theme & Language
  darkMode: boolean;
  toggleDarkMode: () => void;
  uiLang: UILanguage;
  setUiLang: (lang: UILanguage) => void;
  contentLangFilter: string;
  setContentLangFilter: (lang: string) => void;
  // Auth & RBAC
  user: User | null;
  authReady: boolean;
  userProfile: UserProfile | null;
  effectiveRole: string;
  isStaff: boolean;
  isAdmin: boolean;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  // Data
  loadingData: boolean;
  usingSampleFallback: boolean;
  categories: Category[];
  publishedArticles: Article[];
  allStaffArticles: Article[];
  publishers: Publisher[];
  sources: SourceConfig[];
  factChecks: FactCheckRecord[];
  timelines: TimelineRecord[];
  siteSettings: SiteSettings;
  // User Personal Data
  bookmarks: BookmarkRecord[];
  readingHistory: ReadingHistoryRecord[];
  readingLists: ReadingListRecord[];
  savedSearches: SavedSearchRecord[];
  recentSearches: string[];
  addRecentSearch: (term: string) => void;
  // Actions
  refreshPublicData: () => Promise<void>;
  refreshStaffData: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  seedInitialDatabase: () => Promise<void>;
  handleToggleBookmark: (article: Article) => Promise<void>;
  handleFollowToggle: (kind: 'category' | 'topic' | 'publisher', value: string) => Promise<void>;
  toast: { message: string; type: 'info' | 'success' | 'error' } | null;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const HubContext = createContext<HubContextValue | null>(null);

const STAFF_ROLES = new Set([
  'super_admin',
  'administrator',
  'editor',
  'author',
  'reviewer',
  'source_manager',
]);

const ADMIN_ROLES = new Set(['super_admin', 'administrator']);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<string>(() => window.location.pathname || '/');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('aih_theme');
    return stored === 'dark';
  });
  const [uiLang, setUiLangState] = useState<UILanguage>(() => {
    const stored = localStorage.getItem('aih_lang') as UILanguage | null;
    return stored === 'bn' || stored === 'hi' ? stored : 'en';
  });
  const [contentLangFilter, setContentLangFilter] = useState<string>('all');

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [effectiveRole, setEffectiveRole] = useState<string>('reader');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [loadingData, setLoadingData] = useState(true);
  const [usingSampleFallback, setUsingSampleFallback] = useState(false);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [publishedArticles, setPublishedArticles] = useState<Article[]>(SAMPLE_ARTICLES);
  const [allStaffArticles, setAllStaffArticles] = useState<Article[]>(SAMPLE_ARTICLES);
  const [publishers, setPublishers] = useState<Publisher[]>(INITIAL_PUBLISHERS);
  const [sources, setSources] = useState<SourceConfig[]>(INITIAL_SOURCES);
  const [factChecks, setFactChecks] = useState<FactCheckRecord[]>(INITIAL_FACT_CHECKS);
  const [timelines, setTimelines] = useState<TimelineRecord[]>(INITIAL_TIMELINES);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryRecord[]>([]);
  const [readingLists, setReadingLists] = useState<ReadingListRecord[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('aih_recent_searches') || '[]') as string[];
    } catch {
      return [];
    }
  });

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4200);
  }, []);

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('aih_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('aih_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);

  const setUiLang = useCallback((lang: UILanguage) => {
    setUiLangState(lang);
    localStorage.setItem('aih_lang', lang);
  }, []);

  // SPA Navigation
  const navigate = useCallback((path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (window.location.pathname !== normalized) {
      window.history.pushState({}, '', normalized);
    }
    setRoute(normalized);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isStaff = STAFF_ROLES.has(effectiveRole);
  const isAdmin = ADMIN_ROLES.has(effectiveRole);

  // Load public collections from Firestore
  const refreshPublicData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [cats, arts, pubs, srcs, fcs, tls, settings] = await Promise.all([
        fetchCategories(false).catch(() => []),
        fetchPublishedArticles().catch(() => []),
        fetchPublishers().catch(() => []),
        fetchSources().catch(() => []),
        fetchFactChecks().catch(() => []),
        fetchTimelines().catch(() => []),
        fetchSiteSettings().catch(() => DEFAULT_SITE_SETTINGS),
      ]);

      const isDbEmpty = cats.length === 0 && arts.length === 0;
      setUsingSampleFallback(isDbEmpty);
      setCategories(cats.length > 0 ? cats : INITIAL_CATEGORIES);
      setPublishedArticles(arts.length > 0 ? arts : SAMPLE_ARTICLES);
      setPublishers(pubs.length > 0 ? pubs : INITIAL_PUBLISHERS);
      setSources(srcs.length > 0 ? srcs : INITIAL_SOURCES);
      setFactChecks(fcs.length > 0 ? fcs : INITIAL_FACT_CHECKS);
      setTimelines(tls.length > 0 ? tls : INITIAL_TIMELINES);
      setSiteSettings(settings);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const refreshStaffData = useCallback(async () => {
    if (!isStaff) return;
    try {
      const [allArts, allCats, srcs, pubs, fcs, tls] = await Promise.all([
        fetchAllArticlesForStaff().catch(() => []),
        fetchCategories(true).catch(() => []),
        fetchSources().catch(() => []),
        fetchPublishers().catch(() => []),
        fetchFactChecks().catch(() => []),
        fetchTimelines().catch(() => []),
      ]);
      if (allArts.length > 0) {
        setAllStaffArticles(allArts);
        setPublishedArticles(allArts.filter((a) => a.editorialStatus === 'published'));
        setUsingSampleFallback(false);
      }
      if (allCats.length > 0) setCategories(allCats);
      if (srcs.length > 0) setSources(srcs);
      if (pubs.length > 0) setPublishers(pubs);
      if (fcs.length > 0) setFactChecks(fcs);
      if (tls.length > 0) setTimelines(tls);
    } catch (error) {
      console.warn('Staff refresh error:', error);
    }
  }, [isStaff]);

  const refreshUserData = useCallback(async () => {
    if (!user) {
      setBookmarks([]);
      setReadingHistory([]);
      setReadingLists([]);
      setSavedSearches([]);
      return;
    }
    const [bms, hist, lists, srchs] = await Promise.all([
      fetchUserBookmarks(user.uid).catch(() => []),
      fetchReadingHistory(user.uid).catch(() => []),
      fetchReadingLists(user.uid).catch(() => []),
      fetchSavedSearches(user.uid).catch(() => []),
    ]);
    setBookmarks(bms);
    setReadingHistory(hist);
    setReadingLists(lists);
    setSavedSearches(srchs);
  }, [user]);

  useEffect(() => {
    void refreshPublicData();
  }, [refreshPublicData]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const { profile, effectiveRole: role } = await ensureUserProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
          setUserProfile(profile);
          setEffectiveRole(role);
        } catch {
          setEffectiveRole(
            firebaseUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
              ? 'super_admin'
              : 'reader'
          );
        }
      } else {
        setUserProfile(null);
        setEffectiveRole('reader');
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authReady && user) {
      void refreshUserData();
    }
  }, [authReady, user, refreshUserData]);

  useEffect(() => {
    if (authReady && isStaff) {
      void refreshStaffData();
    }
  }, [authReady, isStaff, refreshStaffData]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
    setAuthModalOpen(false);
    showToast('Signed in successfully with Google.', 'success');
  }, [showToast]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setAuthModalOpen(false);
      showToast('Signed in successfully.', 'success');
    },
    [showToast]
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await sendEmailVerification(cred.user).catch(() => {});
      setAuthModalOpen(false);
      showToast('Account created. Verification email sent.', 'success');
    },
    [showToast]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('Password reset link sent to your email.', 'success');
    },
    [showToast]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    showToast('Signed out.', 'info');
    if (route.startsWith('/admin') || route.startsWith('/dashboard')) {
      navigate('/');
    }
  }, [navigate, route, showToast]);

  const seedInitialDatabase = useCallback(async () => {
    const counts = await seedDatabaseToFirestore();
    await refreshPublicData();
    await refreshStaffData();
    showToast(
      `Firestore initialized: ${counts.categories} categories, ${counts.articles} sample articles, ${counts.sources} RSS sources.`,
      'success'
    );
  }, [refreshPublicData, refreshStaffData, showToast]);

  const handleToggleBookmark = useCallback(
    async (article: Article) => {
      if (!user) {
        setAuthModalOpen(true);
        showToast('Sign in to bookmark articles and build reading lists.', 'info');
        return;
      }
      const exists = bookmarks.some((b) => b.articleId === article.id);
      await toggleBookmark(user.uid, article, exists);
      await refreshUserData();
      showToast(exists ? 'Removed from bookmarks.' : 'Saved to your bookmarks.', 'success');
    },
    [bookmarks, refreshUserData, showToast, user]
  );

  const handleFollowToggle = useCallback(
    async (kind: 'category' | 'topic' | 'publisher', value: string) => {
      if (!user || !userProfile) {
        setAuthModalOpen(true);
        showToast('Sign in to follow categories, topics, and publishers.', 'info');
        return;
      }
      const fieldMap = {
        category: 'followedCategories',
        topic: 'followedTopics',
        publisher: 'followedPublishers',
      } as const;
      const key = fieldMap[kind];
      const current = userProfile[key] || [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value].slice(0, 50);

      await updateUserProfile(user.uid, { [key]: next });
      setUserProfile({ ...userProfile, [key]: next });
      showToast(
        current.includes(value) ? `Unfollowed ${value}.` : `Following ${value}.`,
        'success'
      );
    },
    [showToast, user, userProfile]
  );

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      localStorage.setItem('aih_recent_searches', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<HubContextValue>(
    () => ({
      route,
      navigate,
      darkMode,
      toggleDarkMode,
      uiLang,
      setUiLang,
      contentLangFilter,
      setContentLangFilter,
      user,
      authReady,
      userProfile,
      effectiveRole,
      isStaff,
      isAdmin,
      authModalOpen,
      setAuthModalOpen,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmail,
      sendPasswordReset,
      logout,
      loadingData,
      usingSampleFallback,
      categories,
      publishedArticles,
      allStaffArticles,
      publishers,
      sources,
      factChecks,
      timelines,
      siteSettings,
      bookmarks,
      readingHistory,
      readingLists,
      savedSearches,
      recentSearches,
      addRecentSearch,
      refreshPublicData,
      refreshStaffData,
      refreshUserData,
      seedInitialDatabase,
      handleToggleBookmark,
      handleFollowToggle,
      toast,
      showToast,
    }),
    [
      addRecentSearch,
      allStaffArticles,
      authModalOpen,
      authReady,
      bookmarks,
      categories,
      contentLangFilter,
      darkMode,
      effectiveRole,
      factChecks,
      handleFollowToggle,
      handleToggleBookmark,
      isAdmin,
      isStaff,
      loadingData,
      logout,
      navigate,
      publishedArticles,
      publishers,
      readingHistory,
      readingLists,
      recentSearches,
      refreshPublicData,
      refreshStaffData,
      refreshUserData,
      registerWithEmail,
      route,
      savedSearches,
      seedInitialDatabase,
      sendPasswordReset,
      setUiLang,
      showToast,
      signInWithEmail,
      signInWithGoogle,
      siteSettings,
      sources,
      timelines,
      toast,
      toggleDarkMode,
      uiLang,
      user,
      userProfile,
      usingSampleFallback,
    ]
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}
