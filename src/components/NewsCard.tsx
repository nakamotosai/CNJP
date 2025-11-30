"use client";

import { useTheme } from "./ThemeContext";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN, zhTW } from "date-fns/locale";

export interface NewsItem {
  title: string;
  link: string;
  timestamp?: number;
  time_str?: string;
  origin?: string;
  category?: string;
}

interface NewsCardProps {
  item: NewsItem;
  isFav?: boolean;
  onToggleFav?: (e: React.MouseEvent, item: NewsItem) => void;
  onFilterCategory?: (category: string) => void;
}

const SC_TO_TC_CATEGORY: Record<string, string> = {
  "时政": "時政", "经济": "經濟", "社会": "社會", "军事": "軍事",
  "科技": "科技", "体育": "體育", "其他": "其他",
};

const CATEGORY_COLORS: Record<string, string> = {
  "时政": "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  "经济": "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  "社会": "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
  "军事": "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
  "科技": "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400",
  "体育": "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  "其他": "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
};

export default function NewsCard({
  item,
  isFav = false,
  onToggleFav,
  onFilterCategory,
}: NewsCardProps) {
  const { settings } = useTheme();

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
  const categoryColor = CATEGORY_COLORS[rawCategory] || CATEGORY_COLORS["其他"];
  let displayCategory = rawCategory.substring(0, 2);
  if (settings.lang === "tc") {
    displayCategory = SC_TO_TC_CATEGORY[displayCategory] || displayCategory;
  }

  return (
    <div className="w-full bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 flex flex-col gap-2">
          
          {/* 顶部信息栏 */}
          <div className="flex items-center gap-2">
            {onToggleFav && (
              <button
                onClick={(e) => onToggleFav(e, item)}
                className="group p-0.5 -ml-1"
                aria-label="Toggle Favorite"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={isFav ? "var(--primary)" : "currentColor"}
                  className={`w-4 h-4 transition-all ${
                    isFav 
                      ? "text-[var(--primary)] scale-110" 
                      : "text-gray-300 dark:text-gray-600 group-hover:text-[var(--primary)]"
                  }`}
                >
                  <path
                    fillRule="evenodd"
                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}

            <span
              onClick={(e) => {
                e.stopPropagation();
                onFilterCategory?.(rawCategory);
              }}
              style={fontStyleObj}
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight cursor-pointer hover:opacity-80 transition-opacity ${categoryColor}`}
            >
              {displayCategory}
            </span>

            <span 
               style={fontStyleObj}
               className="text-[11px] text-[var(--text-sub)] bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md opacity-80"
            >
              {timeDisplay}
            </span>
          </div>

          {/* 标题：改为 div，去掉了 href 和 点击事件，防止误触 */}
          <div
            style={fontStyleObj}
            className="text-[17px] font-bold text-[var(--text-main)] leading-snug tracking-normal line-clamp-2 cursor-text"
          >
            {item.title}
          </div>

          {/* 底部：来源链接 (唯一可点击区域) */}
          <div className="flex items-center justify-start mt-1">
             <a 
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                style={fontStyleObj}
                className="text-[11px] text-[var(--text-sub)] font-medium hover:text-[var(--primary)] underline decoration-1 underline-offset-2 flex items-center gap-0.5 transition-colors"
             >
                JP {item.origin}
             </a>
             
             {/* 删除了右侧重复的来源显示 */}
          </div>
        </div>
      </div>
    </div>
  );
}