"use client";

import { useTheme } from "@/components/ThemeContext";
import { ABOUT_PAGE_CONTENT, ChangelogEntry } from "@/lib/about-content";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Info,
    Zap,
    BookOpen,
    MapPin,
    AlertTriangle,
    History,
    Mail,
    Coffee,
    ChevronDown,
    Settings,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import SettingsModal from "@/components/modals/SettingsModal";

// Icon mapping
const ICON_MAP: Record<string, React.ElementType> = {
    Zap,
    BookOpen,
    MapPin,
    AlertTriangle,
    History,
    Mail,
    Coffee,
    Info
};

// Color mapping for each section
const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    features: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
    usage: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
    chinaUsers: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
    disclaimer: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
    changelog: { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
    contact: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
    donation: { bg: "bg-pink-500/10", text: "text-pink-600 dark:text-pink-400", border: "border-pink-500/30" }
};

interface AccordionSectionProps {
    sectionKey: string;
    title: string;
    iconName: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    fontStyle: React.CSSProperties;
}

function AccordionSection({
    sectionKey,
    title,
    iconName,
    isExpanded,
    onToggle,
    children,
    fontStyle
}: AccordionSectionProps) {
    const IconComponent = ICON_MAP[iconName] || Info;
    const colors = SECTION_COLORS[sectionKey] || SECTION_COLORS.features;

    return (
        <div className={`
            rounded-2xl overflow-hidden transition-all duration-300
            bg-white dark:bg-white/[0.03]
            border ${isExpanded ? colors.border : 'border-black/5 dark:border-white/5'}
            ${isExpanded ? 'shadow-lg dark:shadow-none' : 'shadow-sm dark:shadow-none'}
        `}>
            <button
                onClick={onToggle}
                className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                        <IconComponent className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <h3 style={fontStyle} className="text-lg font-bold text-[var(--text-main)]">
                        {title}
                    </h3>
                </div>
                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="shrink-0"
                >
                    <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                </motion.div>
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-0">
                            <div className={`h-px ${colors.bg} mb-4`} />
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Changelog Entry Component
function ChangelogEntryCard({ entry }: { entry: ChangelogEntry }) {
    return (
        <div className="relative pl-6 pb-6 last:pb-0 border-l-2 border-purple-500/30 dark:border-purple-400/30 ml-2">
            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-purple-500 dark:bg-purple-400 border-4 border-white dark:border-[#0b0d12]" />
            <div className="mb-2">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    v{entry.version}
                </span>
                <span className="text-xs text-[var(--text-sub)] ml-2">
                    {entry.date}
                </span>
            </div>
            <ul className="space-y-1">
                {entry.changes.map((change, i) => (
                    <li key={i} className="text-sm text-[var(--text-main)] opacity-80 flex items-start gap-2">
                        <span className="text-purple-500 dark:text-purple-400 mt-1">•</span>
                        {change}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function AboutPage() {
    const { settings, updateSettings } = useTheme();
    const content = ABOUT_PAGE_CONTENT[settings.lang];
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["usage"]));
    const [showSettings, setShowSettings] = useState(false);

    const toggleSection = (key: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    // Font style
    const fontStyle = {
        fontFamily: settings.fontStyle === "serif"
            ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
            : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
    };

    const handleClearFavorites = () => {
        if (confirm(settings.lang === "sc" ? "确定要清空所有收藏吗？" : "確定要清空所有收藏嗎？")) {
            localStorage.setItem("favorites", "[]");
        }
    };

    // Helper to render title with gradient for "ai.com" and "从日本看中国"
    const renderTitleWithGradient = (title: string, isSubtitle: boolean = false) => {
        if (title.includes("ai.com")) {
            const parts = title.split("ai.com");
            return (
                <>
                    {parts[0]}
                    <span className="blue-purple-gradient-text">ai.com</span>
                    {parts[1]}
                </>
            );
        }
        if (isSubtitle && (title === "从日本看中国" || title === "從日本看中國")) {
            return <span className="blue-purple-gradient-text">{title}</span>;
        }
        return title;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0b0d12] transition-colors duration-500 pb-24 overflow-x-hidden">

            {/* Top Navigation Bar - Seamless with background */}
            <nav className="sticky top-0 z-50 w-full bg-slate-50/90 dark:bg-transparent backdrop-blur-md">
                <div className="max-w-[800px] mx-auto px-4 h-14 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-[var(--text-sub)] hover:text-[var(--primary)] transition-colors shrink-0 w-24"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium whitespace-nowrap">{content.meta.backButton}</span>
                    </Link>
                    <h1 style={fontStyle} className="text-base sm:text-lg font-bold text-[var(--text-main)] truncate text-center flex-1">
                        {renderTitleWithGradient(content.hero.title)}
                    </h1>
                    {/* Right Buttons: Language Toggle + Settings */}
                    <div className="w-24 flex justify-end gap-1">
                        {/* Language Toggle Button */}
                        <button
                            onClick={() => updateSettings({ lang: settings.lang === 'sc' ? 'tc' : 'sc' })}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
                            title={settings.lang === 'sc' ? '切换到繁体' : '切換到簡體'}
                        >
                            <span className="text-[15px] font-bold text-[var(--text-main)] dark:text-gray-200 leading-none">
                                {settings.lang === 'sc' ? '繁' : '简'}
                            </span>
                        </button>
                        {/* Settings Button */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
                        >
                            <Settings className="w-5 h-5 text-[var(--text-main)] dark:text-gray-200" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-[800px] mx-auto px-4 pt-8">

                {/* Hero Section - Horizontal Layout with Webmaster Quote */}
                <motion.section
                    initial={false}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col sm:flex-row items-center sm:justify-between gap-4 mb-8"
                >
                    <div className="flex items-center gap-4">
                        <motion.div
                            animate={{ rotate: [0, 3, -3, 0] }}
                            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                            className="w-14 h-14 shrink-0 p-2 bg-white dark:bg-white/5 rounded-2xl shadow-lg border border-black/5 dark:border-white/10"
                        >
                            <Image src="/logo.png" alt="Logo" width={56} height={56} priority className="object-contain" />
                        </motion.div>
                        <div className="flex flex-col">
                            <h2 style={fontStyle} className="text-lg sm:text-xl font-extrabold text-[var(--text-main)] mb-0.5">
                                {renderTitleWithGradient(content.hero.subtitle, true)}
                            </h2>
                            <p className="text-[var(--text-sub)] opacity-70 tracking-widest text-[10px] uppercase">
                                {content.hero.description}
                            </p>
                        </div>
                    </div>
                    {/* Webmaster Quote - Desktop */}
                    <div className="hidden sm:block max-w-[45%]">
                        <div className="flex items-start">
                            <span className="text-3xl text-[var(--primary)] dark:text-purple-400 opacity-50 font-serif leading-none shrink-0 mr-2 self-end">“</span>
                            <div className="flex flex-col items-end pr-2">
                                <p className="text-xs sm:text-sm text-[var(--text-sub)] italic leading-relaxed">
                                    {content.hero.webmasterQuote}
                                </p>
                                <p className="text-xs sm:text-sm text-[var(--text-sub)] italic leading-relaxed mt-0.5">
                                    —— {settings.lang === 'sc' ? '来自站长' : '來自站長'}
                                </p>
                            </div>
                            <span className="text-3xl text-[var(--primary)] dark:text-purple-400 opacity-50 font-serif leading-none shrink-0 self-end">”</span>
                        </div>
                    </div>
                </motion.section>

                {/* Mobile Webmaster Quote */}
                <div className="sm:hidden flex justify-center mb-6 px-4">
                    <div className="flex items-start">
                        <span className="text-2xl text-[var(--primary)] dark:text-purple-400 opacity-50 font-serif leading-none shrink-0 mr-1 self-end">“</span>
                        <div className="flex flex-col items-end pr-1">
                            <p className="text-xs text-[var(--text-sub)] italic leading-relaxed">
                                {content.hero.webmasterQuote}
                            </p>
                            <p className="text-xs text-[var(--text-sub)] italic leading-relaxed mt-0.5">
                                —— {settings.lang === 'sc' ? '来自站长' : '來自站長'}
                            </p>
                        </div>
                        <span className="text-2xl text-[var(--primary)] dark:text-purple-400 opacity-50 font-serif leading-none shrink-0 self-end">”</span>
                    </div>
                </div>

                {/* Accordion Sections */}
                <div className="space-y-3">

                    {/* Usage */}
                    <AccordionSection
                        sectionKey="usage"
                        title={content.sections.usage.title}
                        iconName={content.sections.usage.icon}
                        isExpanded={expandedSections.has("usage")}
                        onToggle={() => toggleSection("usage")}
                        fontStyle={fontStyle}
                    >
                        <div className="space-y-2">
                            {content.sections.usage.items?.map((item, i) => (
                                <div key={i} className="flex gap-3 items-start group">
                                    <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 text-xs flex items-center justify-center shrink-0 font-bold group-hover:bg-teal-500 group-hover:text-white transition-colors duration-300">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-[var(--text-main)] opacity-80 leading-relaxed pt-0.5">{item}</p>
                                </div>
                            ))}
                        </div>
                    </AccordionSection>

                    {/* Features */}
                    <AccordionSection
                        sectionKey="features"
                        title={content.sections.features.title}
                        iconName={content.sections.features.icon}
                        isExpanded={expandedSections.has("features")}
                        onToggle={() => toggleSection("features")}
                        fontStyle={fontStyle}
                    >
                        <div className="grid sm:grid-cols-2 gap-3">
                            {content.sections.features.items?.map((item, i) => (
                                <div key={i} className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex items-start gap-2">
                                    <span className="text-sm text-[var(--text-main)] opacity-90 leading-relaxed">{item}</span>
                                </div>
                            ))}
                        </div>
                    </AccordionSection>

                    {/* China Users */}
                    <AccordionSection
                        sectionKey="chinaUsers"
                        title={content.sections.chinaUsers.title}
                        iconName={content.sections.chinaUsers.icon}
                        isExpanded={expandedSections.has("chinaUsers")}
                        onToggle={() => toggleSection("chinaUsers")}
                        fontStyle={fontStyle}
                    >
                        <div className="space-y-3 text-sm text-[var(--text-main)] opacity-90 leading-relaxed">
                            {Array.isArray(content.sections.chinaUsers.content) ? (
                                content.sections.chinaUsers.content.map((p, i) => (
                                    <p key={i} className="flex items-start gap-2">
                                        <span className="text-red-500 dark:text-red-400 shrink-0">•</span>
                                        {p}
                                    </p>
                                ))
                            ) : (
                                <p>{content.sections.chinaUsers.content}</p>
                            )}
                        </div>
                    </AccordionSection>

                    {/* Donation - Moved BEFORE Disclaimer */}
                    <AccordionSection
                        sectionKey="donation"
                        title={content.sections.donation.title}
                        iconName={content.sections.donation.icon}
                        isExpanded={expandedSections.has("donation")}
                        onToggle={() => toggleSection("donation")}
                        fontStyle={fontStyle}
                    >
                        <div className="space-y-4">
                            <div className="space-y-2 text-sm text-[var(--text-main)] opacity-90 leading-relaxed">
                                {Array.isArray(content.sections.donation.content) ? (
                                    content.sections.donation.content.map((p, i) => (
                                        <p key={i}>{p}</p>
                                    ))
                                ) : (
                                    <p>{content.sections.donation.content}</p>
                                )}
                            </div>
                            <div className="flex justify-center">
                                <div className="bg-white dark:bg-white/10 p-3 rounded-2xl shadow-lg">
                                    <Image src="/qrcode.jpg" alt="Donation QR" width={120} height={120} className="rounded-lg" />
                                    <p className="text-[10px] text-black/40 dark:text-white/40 text-center mt-2 font-bold uppercase tracking-widest">
                                        WeChat Pay
                                    </p>
                                </div>
                            </div>
                        </div>
                    </AccordionSection>

                    {/* Changelog */}
                    <AccordionSection
                        sectionKey="changelog"
                        title={content.sections.changelog.title}
                        iconName={content.sections.changelog.icon}
                        isExpanded={expandedSections.has("changelog")}
                        onToggle={() => toggleSection("changelog")}
                        fontStyle={fontStyle}
                    >
                        <div className="pt-2">
                            {content.sections.changelog.entries.map((entry, i) => (
                                <ChangelogEntryCard key={i} entry={entry} />
                            ))}
                        </div>
                    </AccordionSection>

                    {/* Contact */}
                    <AccordionSection
                        sectionKey="contact"
                        title={content.sections.contact.title}
                        iconName={content.sections.contact.icon}
                        isExpanded={expandedSections.has("contact")}
                        onToggle={() => toggleSection("contact")}
                        fontStyle={fontStyle}
                    >
                        <div className="space-y-2 text-sm text-[var(--text-main)] opacity-90 leading-relaxed">
                            {Array.isArray(content.sections.contact.content) ? (
                                content.sections.contact.content.map((p, i) => (
                                    <p key={i}>{p}</p>
                                ))
                            ) : (
                                <p>{content.sections.contact.content}</p>
                            )}
                        </div>
                    </AccordionSection>

                    {/* Disclaimer - Moved to LAST position */}
                    <AccordionSection
                        sectionKey="disclaimer"
                        title={content.sections.disclaimer.title}
                        iconName={content.sections.disclaimer.icon}
                        isExpanded={expandedSections.has("disclaimer")}
                        onToggle={() => toggleSection("disclaimer")}
                        fontStyle={fontStyle}
                    >
                        <div className="space-y-2 text-sm text-[var(--text-main)] opacity-90 leading-relaxed">
                            {Array.isArray(content.sections.disclaimer.content) ? (
                                content.sections.disclaimer.content.map((p, i) => (
                                    <p key={i}>{p}</p>
                                ))
                            ) : (
                                <p>{content.sections.disclaimer.content}</p>
                            )}
                        </div>
                    </AccordionSection>

                </div>

                {/* Footer */}
                <motion.footer
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="mt-12 text-center px-4"
                >
                    <div className="w-12 h-1 bg-black/5 dark:bg-white/5 mx-auto mb-6 rounded-full" />

                    {/* Main Tagline */}
                    <p className="text-sm sm:text-base text-[var(--text-sub)] opacity-60 font-medium tracking-wider mb-4 transition-all duration-300">
                        {content.footer}
                    </p>

                    {/* Webmaster Personal Home Page Link */}
                    <a
                        href="https://saaaai.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm sm:text-base text-[var(--text-sub)] opacity-60 hover:opacity-100 hover:text-[var(--primary)] transition-all duration-300 group"
                    >
                        <span className="font-medium">{content.webmasterLink.split('：')[0]}：</span>
                        <span className="underline underline-offset-4 decoration-black/20 dark:decoration-white/20 group-hover:decoration-[var(--primary)]">
                            saaaai.com
                        </span>
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </motion.footer>

            </main>

            {/* Floating Back Button (Mobile) */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 sm:hidden"
            >
                <Link
                    href="/"
                    className="flex items-center gap-2 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl active:scale-95 transition-transform"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-bold">{content.meta.floatingBackButton}</span>
                </Link>
            </motion.div>

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onClearFavorites={handleClearFavorites}
            />

        </div>
    );
}
