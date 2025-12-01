"use client";

import { useTheme } from "./ThemeContext";
import { formatDistanceToNow } from "date-fns";
import { zhCN, zhTW } from "date-fns/locale";
import { useState } from "react";
import Modal from "./Modal";
import { CATEGORY_MAP, CATEGORY_DOT_COLORS } from "@/lib/constants";

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

export default function NewsCard({
  item,
  isFav = false,
  onToggleFav,
  onFilterCategory,
}: NewsCardProps) {
  const { settings } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  let timeDisplay = item.time_str;
  if (item.timestamp && !timeDisplay) {
    try {
      timeDisplay = formatDistanceToNow(new Date(item.timestamp * 1000), {
        addSuffix: true,
        locale: settings.lang === "sc" ? zhCN : zhTW,
      });
    } catch (e) {
      timeDisplay = "";
    }
  }

  const rawCategory = item.category || "其他";
  let displayCategory = rawCategory.substring(0, 2);
  if (settings.lang === "tc") {
    displayCategory = SC_TO_TC_CATEGORY[displayCategory] || displayCategory;
  }

  const categoryKey = CATEGORY_MAP[rawCategory] || "other";
  const dotColor = CATEGORY_DOT_COLORS[categoryKey] || "bg-gray-400";

  const displayTitle = (settings.lang === "tc" && item.title_tc)
    ? item.title_tc
    : item.title;

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-white dark:bg-[#1e1e1e] p-4 rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 cursor-pointer border border-transparent group relative overflow-hidden"
      >
        {/* Top Row: Category | Source • Time ... Fav */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px]">
            {/* Category Tag */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onFilterCategory && item.category) {
                  const catKey = CATEGORY_MAP[item.category] || "other";
                  onFilterCategory(catKey);
                }
              }}
              className="flex items-center gap-1.5 group/cat"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span className="text-gray-500 dark:text-gray-400 group-hover/cat:text-gray-900 dark:group-hover/cat:text-gray-200 transition-colors font-medium">
                {displayCategory}
              </span>
            </button>

            <span className="text-gray-300 dark:text-gray-700">|</span>

            {/* Source */}
            <div className="flex items-center gap-1.5">
              {item.logo && (
                <img
                  src={item.logo}
                  alt="logo"
                  className="w-3 h-3 object-contain opacity-60 grayscale"
                  onError={(e) => e.currentTarget.style.display = 'none'}
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

          {/* Star Icon */}
          <button
            onClick={(e) => onToggleFav && onToggleFav(e, item)}
            className={`p-1 rounded-full transition-colors ${isFav
                ? "text-[var(--primary)] bg-red-50 dark:bg-red-900/20"
                : "text-gray-300 hover:text-[var(--primary)] hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill={isFav ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <h3
          style={fontStyleObj}
          className="text-[16px] font-bold leading-[1.5] text-[var(--text-main)] line-clamp-2 group-hover:text-[var(--primary)] transition-colors"
        >
          {displayTitle}
        </h3>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={displayTitle}
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between text-sm text-[var(--text-sub)] border-b border-gray-100 dark:border-gray-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="font-medium text-[var(--text-main)]">{item.origin}</span>
              <span>{timeDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span>{displayCategory}</span>
            </div>
          </div>

          <div
            style={fontStyleObj}
            className="text-[16px] leading-relaxed text-[var(--text-main)] whitespace-pre-wrap"
          >
            {item.description || (settings.lang === "sc" ? "暂无摘要" : "暫無摘要")}
          </div>

          <div className="pt-4 flex justify-end">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--primary)] text-white rounded-full text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-red-500/20"
            >
              {settings.lang === "sc" ? "阅读原文" : "閱讀原文"}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}