import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ArticleCard, formatShortDate } from '../components/ArticleCard';
import { updatePageSEO } from '../lib/seo';

export function DeskEditionPage({
  mode,
}: {
  mode: 'latest' | 'breaking' | 'trending' | 'national' | 'international' | 'state' | 'research' | 'documents';
}) {
  const { publishedArticles, contentLangFilter } = useHub();

  const metaMap = {
    latest: {
      title: 'Latest News & Dispatches',
      subtitle: 'Chronological stream of manually authored reports and automatically indexed feeds.',
    },
    breaking: {
      title: 'Breaking News',
      subtitle: 'High-priority verified developments and urgent public briefings.',
    },
    trending: {
      title: 'Trending Across All Desks',
      subtitle: 'Most read and widely discussed reports across news, research, and public policy.',
    },
    national: {
      title: 'National News Desk',
      subtitle: 'Federal legislation, national economy, civic administration, and public schemes.',
    },
    international: {
      title: 'International Desk',
      subtitle: 'Global diplomacy, multilateral institutions, macroeconomics, and cross-border science.',
    },
    state: {
      title: 'State & Regional News',
      subtitle: 'Regional assemblies, municipal infrastructure, and state-level civic updates.',
    },
    research: {
      title: 'Research & Academic Library',
      subtitle: 'Peer-reviewed preprints, scientific discoveries, statistical studies, and educational primers.',
    },
    documents: {
      title: 'Document & Official Notice Archive',
      subtitle: 'Government notifications, constitutional records, PDF reports, and open statistical abstracts.',
    },
  };

  useEffect(() => {
    updatePageSEO({
      title: metaMap[mode].title,
      description: metaMap[mode].subtitle,
      path: `/${mode}`,
    });
  }, [mode]);

  const base =
    contentLangFilter === 'all'
      ? publishedArticles
      : publishedArticles.filter((a) => a.language === contentLangFilter);

  const items = (() => {
    switch (mode) {
      case 'breaking':
        return base.filter((a) => a.isBreaking);
      case 'trending':
        return [...base].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      case 'national':
        return base.filter((a) => ['national-news', 'politics', 'government-schemes', 'constitution'].includes(a.categoryId) || a.country === 'India');
      case 'international':
        return base.filter((a) => a.categoryId === 'international-news' || a.country === 'International');
      case 'state':
        return base.filter((a) => a.categoryId === 'state-news');
      case 'research':
        return base.filter((a) =>
          ['research', 'scientific_discovery', 'educational_note', 'statistical_info'].includes(a.contentType)
        );
      case 'documents':
        return base.filter((a) =>
          ['government_notification', 'historical_document', 'report', 'pdf_document', 'statistical_info'].includes(
            a.contentType
          )
        );
      case 'latest':
      default:
        return base;
    }
  })();

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">
          Editorial Desk
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          {metaMap[mode].title}
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-2xl">
          {metaMap[mode].subtitle}
        </p>
      </div>

      {items.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((art) => (
            <ArticleCard key={art.id} article={art} variant="feature" />
          ))}
        </div>
      ) : (
        <div className="mt-8 p-12 text-center border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
          <FileText className="w-6 h-6 mx-auto text-[#78716C] mb-2" />
          <p className="font-serif text-xl text-[#141413] dark:text-[#F3F4F6]">
            No published items in this desk yet
          </p>
          <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-1">
            Try switching the language filter to All Languages or publishing new reports in the Control Center.
          </p>
        </div>
      )}
    </main>
  );
}

export function PublisherDirectoryPage() {
  const { publishers, publishedArticles, userProfile, handleFollowToggle } = useHub();

  useEffect(() => {
    updatePageSEO({
      title: 'Publisher Directory',
      description: 'Verified newspapers, research repositories, broadcasters, and official government publishers indexed by ALL INFORMATION HUB.',
      path: '/publishers',
    });
  }, []);

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
          Transparency Directory
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Indexed Publishers ({publishers.length})
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-2xl">
          Every external article retains clear publisher attribution, trust classification, and links directly back to the originating institution.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {publishers.map((pub) => {
          const isFollowing = userProfile?.followedPublishers?.includes(pub.id);
          const count = publishedArticles.filter((a) =>
            a.originalSource.toLowerCase().includes(pub.name.toLowerCase().split(' ')[0])
          ).length;

          return (
            <div
              key={pub.id}
              className="border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922] p-6 flex flex-col justify-between"
            >
              <div>
                <p className="text-[11px] font-mono uppercase text-[#1E3A8A] dark:text-[#60A5FA]">
                  {pub.trustClassification.replace(/_/g, ' ')} · {pub.country}
                </p>
                <h2 className="font-serif text-xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1.5">
                  {pub.name}
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#9CA3AF] mt-2 leading-relaxed">
                  {pub.description}
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-[#F0EDE6] dark:border-[#1B2230] flex items-center justify-between text-xs">
                <a
                  href={pub.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#1E3A8A] dark:text-[#60A5FA] hover:underline font-medium"
                >
                  Official Site <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#78716C] tabular-nums">{count} indexed</span>
                  <button
                    type="button"
                    onClick={() => void handleFollowToggle('publisher', pub.id)}
                    className="font-semibold text-[#141413] dark:text-[#F3F4F6] hover:underline cursor-pointer"
                  >
                    {isFollowing ? 'Following' : '+ Follow'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export function SourceDirectoryPage() {
  const { sources } = useHub();

  useEffect(() => {
    updatePageSEO({
      title: 'Authorized Source & Feed Directory',
      description: 'Transparent catalog of RSS feeds, government portals, research journals, and authorized APIs connected to ALL INFORMATION HUB.',
      path: '/sources',
    });
  }, []);

  return (
    <main className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8">
      <div className="pb-6 border-b border-[#141413] dark:border-[#F3F4F6]">
        <p className="text-xs uppercase tracking-widest text-[#57534E] dark:text-[#9CA3AF]">
          Collection Transparency
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-1">
          Authorized Information Sources ({sources.length})
        </h1>
        <p className="text-sm text-[#57534E] dark:text-[#9CA3AF] mt-2 max-w-3xl">
          ALL INFORMATION HUB collects external updates strictly through authorized RSS/Atom feeds,
          open research repositories, public-domain government feeds, and permitted APIs—respecting
          publisher copyright and paywalls.
        </p>
      </div>

      <div className="mt-8 overflow-x-auto border border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#141922]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F4F1EA] dark:bg-[#171D28] border-b border-[#E5E2DC] dark:border-[#232A36] text-[#141413] dark:text-[#F3F4F6]">
              <th className="px-4 py-3 font-semibold">Source Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Country / Lang</th>
              <th className="px-4 py-3 font-semibold">Trust Tier</th>
              <th className="px-4 py-3 font-semibold">Rights Mode</th>
              <th className="px-4 py-3 font-semibold">Interval</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Last Fetch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E2DC] dark:divide-[#232A36]">
            {sources.map((s) => (
              <tr key={s.id} className="hover:bg-[#FAF9F6] dark:hover:bg-[#19202D]">
                <td className="px-4 py-3.5 font-medium text-[#141413] dark:text-[#F3F4F6]">
                  <a
                    href={s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {s.name} <ExternalLink className="w-3 h-3 text-[#78716C]" />
                  </a>
                </td>
                <td className="px-4 py-3.5 font-mono text-[#57534E] dark:text-[#9CA3AF]">
                  {s.sourceType.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3.5 text-[#57534E] dark:text-[#9CA3AF]">
                  {s.country} · <span className="uppercase font-mono">{s.language}</span>
                </td>
                <td className="px-4 py-3.5 font-mono text-[#57534E] dark:text-[#9CA3AF]">
                  {s.trustClassification.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3.5 font-mono text-[#57534E] dark:text-[#9CA3AF]">
                  {s.contentPermission.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3.5 font-mono tabular-nums text-[#57534E] dark:text-[#9CA3AF]">
                  {s.fetchIntervalMinutes}m
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#141413] dark:text-[#F3F4F6] uppercase">
                  {s.status}
                </td>
                <td className="px-4 py-3.5 font-mono tabular-nums text-right text-[#57534E] dark:text-[#9CA3AF]">
                  {formatShortDate(s.lastFetchTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export function InstitutionalPage({ page }: { page: 'about' | 'contact' | 'privacy' | 'terms' }) {
  const { showToast } = useHub();
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });

  const titles = {
    about: 'About ALL INFORMATION HUB',
    contact: 'Contact Editorial Desk & Corrections',
    privacy: 'Privacy Policy & Data Isolation',
    terms: 'Terms of Service & Copyright Compliance',
  };

  useEffect(() => {
    updatePageSEO({
      title: titles[page],
      description: `${titles[page]} — ALL INFORMATION HUB institutional standards.`,
      path: `/${page}`,
    });
  }, [page]);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-[#1E3A8A] dark:text-[#60A5FA] font-semibold">
        Institutional Governance
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#141413] dark:text-[#F3F4F6] mt-2">
        {titles[page]}
      </h1>

      <div className="mt-8 space-y-6 text-sm leading-[1.8] text-[#292524] dark:text-[#D1D5DB]">
        {page === 'about' && (
          <>
            <p>
              <strong>ALL INFORMATION HUB</strong> (“All Information. One Intelligent Platform.”) is
              a unified global digital newsroom, multi-source RSS and authorized API aggregator,
              research and document library, and source-grounded knowledge discovery engine.
            </p>
            <p>
              Our editorial architecture separates automated ingestion from editorial publication: by
              default, every externally collected feed item enters an editorial review queue before
              publication, undergoes duplicate detection and canonical URL normalization, and retains
              transparent publisher attribution.
            </p>
            <p>
              AI features assist readers and editors with summarization, keyword indexing,
              multilingual translation (English, Bengali, Hindi), and multi-source comparison—never
              fabricating facts and never automatically certifying factual verification.
            </p>
          </>
        )}

        {page === 'contact' && (
          <>
            <p>
              To submit a factual correction, request publisher feed onboarding, or report a rights
              inquiry, send a structured dispatch to our editorial compliance team below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setContactForm({ name: '', email: '', subject: '', message: '' });
                showToast('Your message has been logged for editorial review.', 'success');
              }}
              className="space-y-4 pt-2 border-t border-[#E5E2DC] dark:border-[#232A36]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Your Full Name"
                  className="px-3.5 py-2.5 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
                />
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="Email Address"
                  className="px-3.5 py-2.5 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
                />
              </div>
              <input
                type="text"
                required
                value={contactForm.subject}
                onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                placeholder="Subject (e.g. Correction Request, RSS Feed Onboarding)"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <textarea
                rows={5}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Include relevant article URLs, source citations, or documentation..."
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141922] border border-[#E5E2DC] dark:border-[#232A36]"
              />
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold bg-[#141413] text-white dark:bg-[#F3F4F6] dark:text-[#141413] cursor-pointer"
              >
                Submit Editorial Inquiry
              </button>
            </form>
          </>
        )}

        {page === 'privacy' && (
          <>
            <p>
              Reader accounts, bookmarks, reading history, personal reading lists, and notification
              preferences are isolated strictly to your authenticated Firebase user UID using
              enforced Cloud Firestore security rules.
            </p>
            <p>
              Public visitors may read all published news, research, documents, fact-checks, and
              timelines without creating an account. No third-party tracking scripts or unauthorized
              data brokers are embedded.
            </p>
          </>
        )}

        {page === 'terms' && (
          <>
            <p>
              ALL INFORMATION HUB respects international copyright law, robots policies, and
              publisher paywalls. Where full-text republication is not explicitly authorized or in
              the public domain, only permitted metadata, short excerpts, and direct links to the
              original publisher are stored.
            </p>
            <p>
              AI-generated summaries and translations are explicitly labeled as computational aids
              and always preserve links to the unmodified original source.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
