import React, { useEffect, useState } from 'react';
import { Bell, Bookmark, Clock, ListPlus, LogOut, Search, Shield, Trash2, User } from 'lucide-react';
import { useHub } from '../context/HubContext';
import {
  createReadingList,
  deleteReadingList,
  removeSavedSearch,
  updateUserProfile,
} from '../lib/firestoreService';
import { updatePageSEO } from '../lib/seo';
import type { NotificationPrefs } from '../types/models';

export function UserDashboardPage() {
  const {
    user,
    userProfile,
    effectiveRole,
    isStaff,
    navigate,
    setAuthModalOpen,
    logout,
    bookmarks,
    readingHistory,
    readingLists,
    savedSearches,
    categories,
    publishedArticles,
    refreshUserData,
    handleFollowToggle,
    showToast,
  } = useHub();

  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history' | 'lists' | 'follows' | 'notifications' | 'profile'>('bookmarks');
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [prefLang, setPrefLang] = useState(userProfile?.preferredLanguage || 'en');
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(
    userProfile?.notificationPrefs || {
      breakingNews: true,
      followedCategories: true,
      followedTopics: true,
      governmentNotices: true,
      newResearch: false,
      personalizedDigest: true,
    }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    updatePageSEO({
      title: 'My Reading Desk & Preferences',
      description: 'Manage your bookmarks, reading history, personal reading lists, followed topics, and notifications.',
      path: '/dashboard',
    });
  }, []);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
      setPrefLang(userProfile.preferredLanguage || 'en');
      if (userProfile.notificationPrefs) setNotifPrefs(userProfile.notificationPrefs);
    }
  }, [userProfile]);

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
          Sign In to Open Your Personal Desk
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-3">
          Your bookmarks, reading lists, reading progress, saved searches, and notification settings
          are synced privately to your Firebase account.
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: displayName.trim() || 'Reader',
        bio: bio.trim(),
        preferredLanguage: prefLang,
      });
      showToast('Profile settings saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { notificationPrefs: notifPrefs });
      showToast('Notification preferences updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save notification preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    await createReadingList(user.uid, newListName, newListDesc, []);
    setNewListName('');
    setNewListDesc('');
    await refreshUserData();
    showToast('Reading list created.', 'success');
  };

  const tabs = [
    { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})`, icon: Bookmark },
    { id: 'history', label: `History (${readingHistory.length})`, icon: Clock },
    { id: 'lists', label: `Reading Lists (${readingLists.length})`, icon: ListPlus },
    { id: 'follows', label: 'Following & Searches', icon: Search },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">
            Personal Reader Workspace · Role: {effectiveRole.replace(/_/g, ' ')}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
            {userProfile?.displayName || user.displayName || user.email}
          </h1>
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1 font-mono">{user.email}</p>
        </div>

        <div className="flex items-center gap-3">
          {isStaff && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" /> Open Admin Control Center
            </button>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="mt-6 flex items-center gap-1 overflow-x-auto border-b border-[#E5E2DC] dark:border-[#232A36]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                active
                  ? 'border-[#1E3A8A] dark:border-[#60A5FA] text-[#141413] dark:text-[#F3F4F6] font-semibold'
                  : 'border-transparent text-[#57534E] dark:text-[#9CA3AF] hover:text-[#141413] dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Views */}
      <div className="mt-8">
        {activeTab === 'bookmarks' && (
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
            {bookmarks.map((bm) => (
              <div key={bm.id} className="p-4 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigate(`/article/${bm.articleSlug}`)}
                  className="text-left font-serif text-base font-semibold text-[#141413] dark:text-[#F3F4F6] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] cursor-pointer"
                >
                  {bm.articleTitle}
                </button>
                <span className="text-xs font-mono text-[#78716C] shrink-0">{bm.categoryId}</span>
              </div>
            ))}
            {bookmarks.length === 0 && (
              <p className="p-8 text-sm text-[#57534E] dark:text-[#9CA3AF] text-center">
                No bookmarked reports yet. Click Save on any article to collect it here.
              </p>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36] border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
            {readingHistory.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/article/${item.articleSlug}`)}
                  className="text-left font-serif text-base font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline cursor-pointer"
                >
                  {item.articleTitle}
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-28 h-1.5 bg-[#E5E2DC] dark:bg-[#232A36]">
                    <div
                      className="h-full bg-[#1E3A8A] dark:bg-[#60A5FA]"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                    {item.progressPercent}%
                  </span>
                </div>
              </div>
            ))}
            {readingHistory.length === 0 && (
              <p className="p-8 text-sm text-[#57534E] dark:text-[#9CA3AF] text-center">
                Articles you read will track progress automatically here.
              </p>
            )}
          </div>
        )}

        {activeTab === 'lists' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleCreateList}
              className="lg:col-span-4 border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5 space-y-3 h-fit"
            >
              <h2 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6]">
                Create Reading List
              </h2>
              <input
                type="text"
                required
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. Monetary Policy Research"
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <textarea
                rows={2}
                value={newListDesc}
                onChange={(e) => setNewListDesc(e.target.value)}
                placeholder="Optional description..."
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
              >
                Create List
              </button>
            </form>

            <div className="lg:col-span-8 space-y-4">
              {readingLists.map((list) => (
                <div
                  key={list.id}
                  className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6]">
                        {list.name}
                      </h3>
                      {list.description && (
                        <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-0.5">
                          {list.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteReadingList(user.uid, list.id);
                        await refreshUserData();
                      }}
                      aria-label="Delete reading list"
                      className="p-1.5 text-[#78716C] hover:text-[#B91C1C] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#F0EDE6] dark:border-[#1B2230] space-y-2 text-xs">
                    {list.articleIds.map((aid) => {
                      const art = publishedArticles.find((a) => a.id === aid);
                      if (!art) return null;
                      return (
                        <button
                          key={aid}
                          type="button"
                          onClick={() => navigate(`/article/${art.slug}`)}
                          className="block text-left text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          · {art.title}
                        </button>
                      );
                    })}
                    {list.articleIds.length === 0 && (
                      <p className="text-[#78716C]">No articles added yet. Add articles from any Article page.</p>
                    )}
                  </div>
                </div>
              ))}
              {readingLists.length === 0 && (
                <p className="text-sm text-[#57534E] dark:text-[#9CA3AF]">
                  Create your first personal reading list to organize research and briefings.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'follows' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
              <h2 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mb-3">
                Followed Categories
              </h2>
              <div className="flex flex-wrap gap-2">
                {categories
                  .filter((c) => !c.parentId)
                  .slice(0, 18)
                  .map((cat) => {
                    const active = userProfile?.followedCategories?.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => void handleFollowToggle('category', cat.id)}
                        className={`px-3 py-1.5 text-xs border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#141413] text-white border-[#141413] dark:bg-[#F3F4F6] dark:text-[#141413]'
                            : 'border-[#E5E2DC] dark:border-[#232A36] text-[#57534E] dark:text-[#9CA3AF]'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {cat.name}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-5">
              <h2 className="font-serif text-lg font-semibold text-[#141413] dark:text-[#F3F4F6] mb-3">
                Saved Searches ({savedSearches.length})
              </h2>
              <div className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
                {savedSearches.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                      className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium cursor-pointer"
                    >
                      {s.query}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeSavedSearch(user.uid, s.id);
                        await refreshUserData();
                      }}
                      className="text-[#78716C] hover:text-[#B91C1C] cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {savedSearches.length === 0 && (
                  <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">
                    Save searches from the Advanced Search page to monitor ongoing subjects.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-xl border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Notification Controls
            </h2>
            <p className="text-xs text-[#57534E] dark:text-[#9CA3AF]">
              Choose exactly which editorial alerts and digests you want enabled on your account.
            </p>
            {(
              [
                ['breakingNews', 'Breaking News Alerts'],
                ['followedCategories', 'Followed Category Dispatches'],
                ['followedTopics', 'Followed Topic Updates'],
                ['governmentNotices', 'Official Government Notices & Gazettes'],
                ['newResearch', 'New Peer-Reviewed Research Papers'],
                ['personalizedDigest', 'Daily Personalized Information Digest'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between py-2 border-b border-[#F0EDE6] dark:border-[#1B2230] text-sm cursor-pointer">
                <span className="text-[#141413] dark:text-[#E5E7EB]">{label}</span>
                <input
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })}
                  className="w-4 h-4 accent-[#1E3A8A]"
                />
              </label>
            ))}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveNotifications()}
              className="px-5 py-2.5 text-xs font-semibold bg-[#1E3A8A] text-white dark:bg-[#60A5FA] dark:text-[#0C0F14] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Notification Preferences'}
            </button>
          </div>
        )}

        {activeTab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="max-w-xl border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6]">
              Reader Profile Settings
            </h2>
            <div>
              <label className="block text-xs font-medium text-[#57534E] dark:text-[#9CA3AF] mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] dark:text-[#9CA3AF] mb-1">
                Research / Editorial Bio
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#57534E] dark:text-[#9CA3AF] mb-1">
                Preferred Reading Language
              </label>
              <select
                value={prefLang}
                onChange={(e) => setPrefLang(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#FAF9F6] dark:bg-[#0C0F14] border border-[#E5E2DC] dark:border-[#232A36]"
              >
                <option value="en">English</option>
                <option value="bn">Bengali (বাংলা)</option>
                <option value="hi">Hindi (हिन्दी)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Update Profile'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
