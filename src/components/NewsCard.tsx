"use client";

import React, { memo, useState, useMemo } from "react";
import Image from "next/image";
import { useTheme } from "./ThemeContext";
import { formatDistanceToNow } from "date-fns";
import { zhCN, zhTW } from "date-fns/locale";
import Modal from "./Modal";
import { CATEGORY_MAP, CATEGORY_DOT_COLORS } from "@/lib/constants";
import { Heart, ExternalLink, Tag } from "lucide-react";

export interface NewsItem {
    title: string;
    title_tc?: string;
    title_ja?: string;
    link: string;
    timestamp?: number;
    time_str?: string;
    origin: string;
    category?: string;
    logo?: string;
    description?: string;
}

interface NewsCardProps {
    item: NewsItem;
    isFav?: boolean;
    onToggleFav?: (e: React.MouseEvent, item: NewsItem) => void;
    onFilterCategory?: (category: string) => void;
}

const SC_TO_TC_CATEGORY: Record<string, string> = {
    "时政": "時政", "经济": "經濟", "社会": "社會", "娱乐": "娛樂",
    "科技": "科技", "体育": "體育", "其他": "其他",
};

function NewsCardComponent({
    item,
    isFav = false,
    onToggleFav,
    onFilterCategory,
}: NewsCardProps) {
    const { settings } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logoError, setLogoError] = useState(false);

    // Memoize time display to avoid recalculating on every render
    const timeDisplay = useMemo(() => {
        if (item.time_str) return item.time_str;
        if (item.timestamp) {
            try {
                return formatDistanceToNow(new Date(item.timestamp * 1000), {
                    addSuffix: true,
                    locale: settings.lang === "sc" ? zhCN : zhTW,
                });
            } catch (e) {
                return "";
            }
        }
        return "";
    }, [item.time_str, item.timestamp, settings.lang]);

    // Memoize category display
    const { displayCategory, categoryKey, dotColor } = useMemo(() => {
        const rawCategory = item.category || "其他";
        let displayCat = rawCategory.substring(0, 2);
        if (settings.lang === "tc") {
            displayCat = SC_TO_TC_CATEGORY[displayCat] || displayCat;
        }
        const catKey = CATEGORY_MAP[rawCategory] || "other";
        const color = CATEGORY_DOT_COLORS[catKey] || "bg-gray-400";
        return { displayCategory: displayCat, categoryKey: catKey, dotColor: color };
    }, [item.category, settings.lang]);

    // Memoize title display
    const displayTitle = useMemo(() => {
        return (settings.lang === "tc" && item.title_tc) ? item.title_tc : item.title;
    }, [settings.lang, item.title, item.title_tc]);

    const handleCategoryClick = () => {
        if (onFilterCategory && item.category) {
            onFilterCategory(categoryKey);
            setIsModalOpen(false);
        }
    };

    return (
        <>
            <div
                onClick={() => setIsModalOpen(true)}
                className="news-card-container w-full bg-white dark:bg-white/[0.03] p-4 rounded-2xl shadow-card dark:shadow-none md:hover:shadow-card-hover dark:md:hover:bg-white/[0.06] md:hover:-translate-y-1 active:scale-[0.98] md:active:scale-100 transition-all duration-300 cursor-pointer border border-transparent dark:border-white/5 group relative overflow-hidden"
            >
                {/* Top Row: Category | Source • Time ... Fav */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[11px]">
                        {/* Category Tag */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCategoryClick();
                            }}
                            className="flex items-center gap-1.5 group/cat"
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-gray-500 dark:text-sub group-hover/cat:text-gray-900 dark:group-hover/cat:text-gray-200 transition-colors font-medium">
                                {displayCategory}
                            </span>
                        </button>

                        <span className="text-gray-300 dark:text-gray-700">|</span>

                        {/* Source with optimized logo */}
                        <div className="flex items-center gap-1.5">
                            {item.logo && !logoError && (
                                <Image
                                    src={item.logo}
                                    alt=""
                                    width={12}
                                    height={12}
                                    className="object-contain opacity-60 grayscale"
                                    onError={() => setLogoError(true)}
                                    loading="lazy"
                                    unoptimized // External URLs need this
                                />
                            )}
                            <span className="text-[var(--text-aux)] font-medium tracking-wide">
                                {item.origin}
                            </span>
                        </div>

                        <span className="text-[var(--text-aux)] opacity-60">•</span>

                        {/* Time */}
                        <span className="text-[var(--text-aux)] tracking-wide opacity-80">
                            {timeDisplay}
                        </span>
                    </div>

                    {/* Star Icon - Larger & Circular */}
                    <button
                        onClick={(e) => onToggleFav && onToggleFav(e, item)}
                        className={`p-2.5 rounded-full transition-all active:scale-90 ${isFav
                            ? "text-[var(--primary)] bg-indigo-50 dark:bg-indigo-900/20"
                            : "text-gray-300 hover:text-[var(--primary)] hover:bg-gray-50 dark:hover:bg-white/5"
                            }`}
                    >
                        <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
                    </button>
                </div>

                {/* Title - with subtle text shadow */}
                <h3
                    style={{
                        textShadow: '0 1px 2px rgba(0,0,0,0.08)'
                    }}
                    className="text-[16px] font-bold leading-[1.5] text-[var(--text-main)] line-clamp-2 md:group-hover:text-[var(--primary)] transition-colors"
                >
                    {displayTitle}
                </h3>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="" // Empty title for custom layout
            >
                <div className="space-y-4">
                    {/* 1. Chinese Title - Smaller (text-lg) */}
                    <h2
                        className="text-lg font-bold leading-snug text-[var(--text-main)]"
                    >
                        {displayTitle}
                    </h2>

                    {/* 2. Japanese Title - Smaller (text-sm) */}
                    {item.title_ja && (
                        <h3 className="text-sm font-medium text-gray-500 dark:text-sub leading-relaxed">
                            {item.title_ja}
                        </h3>
                    )}

                    {/* 3. Source & Time - Smaller (text-xs) */}
                    <div className="flex items-center gap-3 text-xs text-[var(--text-sub)] pb-2 border-b border-gray-100 dark:border-border">
                        <span className="font-medium">{item.origin}</span>
                        <span>•</span>
                        <span>{timeDisplay}</span>
                    </div>

                    {/* 4. Bottom Buttons Row - Smaller (py-1.5 px-3 text-xs) */}
                    <div className="pt-2 flex items-center justify-between gap-2">
                        {/* Left: Fav Button */}
                        <button
                            onClick={(e) => onToggleFav && onToggleFav(e, item)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isFav
                                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500"
                                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-sub hover:bg-gray-200 dark:hover:bg-white/10"
                                }`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
                            <span>{settings.lang === "sc" ? "收藏" : "收藏"}</span>
                        </button>

                        {/* Middle: Category Tag Button */}
                        <button
                            onClick={handleCategoryClick}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-sub text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                        >
                            <Tag className="w-3.5 h-3.5" />
                            <span>{displayCategory}</span>
                        </button>

                        {/* Right: Read Original Button */}
                        <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--primary)] text-white rounded-full text-xs font-medium hover:opacity-90 transition-all shadow-floating shadow-indigo-500/20"
                        >
                            <span>{settings.lang === "sc" ? "阅读原文" : "閱讀原文"}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            </Modal>
        </>
    );
}

// React.memo with custom comparison to prevent unnecessary re-renders
const NewsCard = memo(NewsCardComponent, (prevProps, nextProps) => {
    return (
        prevProps.item.link === nextProps.item.link &&
        prevProps.isFav === nextProps.isFav &&
        prevProps.item.title === nextProps.item.title
    );
});

export default NewsCard;