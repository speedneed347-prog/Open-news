import React from 'react';
import { useHub } from '../context/HubContext';

export function Footer() {
  const { navigate, categories } = useHub();
  const topCategories = categories.filter((c) => !c.parentId && c.isActive).slice(0, 8);

  return (
    <footer className="mt-16 border-t border-[#E5E2DC] dark:border-[#232A36] bg-white dark:bg-[#11151D]">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <p className="font-serif text-lg font-bold text-[#141413] dark:text-[#F3F4F6]">
              ALL INFORMATION HUB
            </p>
            <p className="font-serif italic text-sm text-[#57534E] dark:text-[#9CA3AF] mt-1">
              All Information. One Intelligent Platform.
            </p>
            <p className="text-xs leading-relaxed text-[#57534E] dark:text-[#9CA3AF] mt-4">
              Global digital news portal, authorized multi-source RSS/API aggregator, research and
              document archive, transparent fact-check center, and source-grounded knowledge
              discovery platform.
            </p>
          </div>

          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#141413] dark:text-[#F3F4F6] mb-3">
              Editions & Discovery
            </h3>
            <ul className="space-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              {[
                ['Latest News', '/latest'],
                ['Breaking News', '/breaking'],
                ['Trending Topics', '/trending'],
                ['Knowledge Discovery', '/discover'],
                ['Multi-Source Comparison', '/compare'],
                ['Chronological Timelines', '/timelines'],
                ['Advanced Search', '/search'],
              ].map(([label, path]) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => navigate(path)}
                    className="hover:text-[#141413] dark:hover:text-[#F3F4F6] hover:underline cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#141413] dark:text-[#F3F4F6] mb-3">
              Libraries & Directories
            </h3>
            <ul className="space-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              {[
                ['Research Library', '/research'],
                ['Document Library', '/documents'],
                ['Fact Check Center', '/fact-check'],
                ['Publisher Directory', '/publishers'],
                ['Source Directory', '/sources'],
                ['All Categories', '/categories'],
              ].map(([label, path]) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => navigate(path)}
                    className="hover:text-[#141413] dark:hover:text-[#F3F4F6] hover:underline cursor-pointer"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#141413] dark:text-[#F3F4F6] mb-3">
              Desks & Governance
            </h3>
            <ul className="space-y-2 text-xs text-[#57534E] dark:text-[#9CA3AF]">
              {topCategories.slice(0, 4).map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/category/${cat.slug}`)}
                    className="hover:text-[#141413] dark:hover:text-[#F3F4F6] hover:underline cursor-pointer"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
              <li className="pt-2 border-t border-[#F0EDE6] dark:border-[#1B2230]">
                <button type="button" onClick={() => navigate('/about')} className="hover:underline cursor-pointer">
                  About Us & Editorial Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/contact')} className="hover:underline cursor-pointer">
                  Contact & Corrections
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/privacy')} className="hover:underline cursor-pointer">
                  Privacy Policy
                </button>
                <span className="mx-2">·</span>
                <button type="button" onClick={() => navigate('/terms')} className="hover:underline cursor-pointer">
                  Terms
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E2DC] dark:border-[#232A36] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#57534E] dark:text-[#9CA3AF]">
          <p>
            © {new Date().getFullYear()} ALL INFORMATION HUB. Source attribution preserved across all
            indexed publications. Demonstration records are explicitly labeled as Sample Data.
          </p>
          <div className="flex items-center gap-4">
            <a href="/sitemap.xml" className="hover:underline">
              XML Sitemap
            </a>
            <a href="/robots.txt" className="hover:underline">
              Robots Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
