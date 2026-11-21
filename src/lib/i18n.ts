export type UILanguage = 'en' | 'bn' | 'hi';

export interface LanguageMeta {
  code: UILanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];

const DICTIONARY: Record<UILanguage, Record<string, string>> = {
  en: {
    brand: 'ALL INFORMATION HUB',
    tagline: 'All Information. One Intelligent Platform.',
    nav_edition: 'Edition',
    nav_categories: 'Categories',
    nav_discover: 'Discover',
    nav_research: 'Research',
    nav_factcheck: 'Fact Check',
    sign_in: 'Sign In',
    dashboard: 'My Desk',
    admin_center: 'Control Center',
    breaking_label: 'Breaking',
    search_placeholder: 'Search news, research, notices, or ask a question...',
    latest_updates: 'Latest Updates',
    trending_topics: 'Trending Topics',
    category_highlights: 'Category Highlights',
    research_discoveries: 'Research & Discoveries',
    government_updates: 'Government & Civic Notices',
    most_read: 'Most Read',
    recommended: 'Recommended For You',
    read_full: 'Read Full Edition',
    sample_notice: 'Sample Editorial Record',
    verified_source: 'Original Source',
    translate_article: 'Translate',
    original_language: 'Original',
    ai_intelligence: 'AI Editorial Intelligence',
  },
  bn: {
    brand: 'ALL INFORMATION HUB',
    tagline: 'সকল তথ্য। এক বুদ্ধিমান প্ল্যাটফর্ম।',
    nav_edition: 'সংস্করণ',
    nav_categories: 'বিভাগসমূহ',
    nav_discover: 'অনুসন্ধান',
    nav_research: 'গবেষণা',
    nav_factcheck: 'তথ্য যাচাই',
    sign_in: 'সাইন ইন',
    dashboard: 'আমার ডেস্ক',
    admin_center: 'নিয়ন্ত্রণ কেন্দ্র',
    breaking_label: 'জরুরি সংবাদ',
    search_placeholder: 'সংবাদ, গবেষণা, সরকারি বিজ্ঞপ্তি খুঁজুন...',
    latest_updates: 'সর্বশেষ আপডেট',
    trending_topics: 'আলোচিত বিষয়',
    category_highlights: 'বিভাগীয় শিরোনাম',
    research_discoveries: 'গবেষণা ও আবিষ্কার',
    government_updates: 'সরকারি বিজ্ঞপ্তি ও প্রতিবেদন',
    most_read: 'সর্বাধিক পঠিত',
    recommended: 'আপনার জন্য নির্বাচিত',
    read_full: 'সম্পূর্ণ প্রতিবেদন পড়ুন',
    sample_notice: 'নমুনা প্রতিবেদন',
    verified_source: 'মূল উৎস',
    translate_article: 'অনুবাদ করুন',
    original_language: 'মূল ভাষা',
    ai_intelligence: 'এআই তথ্য বিশ্লেষণ',
  },
  hi: {
    brand: 'ALL INFORMATION HUB',
    tagline: 'सभी जानकारी। एक बुद्धिमान मंच।',
    nav_edition: 'संस्करण',
    nav_categories: 'श्रेणियाँ',
    nav_discover: 'खोजें',
    nav_research: 'शोध पुस्तकालय',
    nav_factcheck: 'तथ्य जाँच',
    sign_in: 'साइन इन',
    dashboard: 'मेरा डेस्क',
    admin_center: 'प्रशासन केंद्र',
    breaking_label: 'ब्रेकिंग',
    search_placeholder: 'समाचार, शोध, सरकारी सूचना खोजें या प्रश्न पूछें...',
    latest_updates: 'ताज़ा अपडेट',
    trending_topics: 'प्रमुख विषय',
    category_highlights: 'श्रेणी प्रमुख समाचार',
    research_discoveries: 'शोध एवं खोजें',
    government_updates: 'सरकारी सूचनाएँ एवं रिपोर्ट',
    most_read: 'सर्वाधिक पठित',
    recommended: 'आपके लिए अनुशंसित',
    read_full: 'पूरा लेख पढ़ें',
    sample_notice: 'नमूना सामग्री',
    verified_source: 'मूल स्रोत',
    translate_article: 'अनुवाद करें',
    original_language: 'मूल भाषा',
    ai_intelligence: 'एआई संपादकीय विश्लेषण',
  },
};

export function t(lang: UILanguage, key: string): string {
  return DICTIONARY[lang]?.[key] || DICTIONARY.en[key] || key;
}
