"use client";

import { X, Star, Calendar, ExternalLink } from "lucide-react";
import { NewsItem } from "../NewsCard";
import { useTheme } from "../ThemeContext";

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  items: NewsItem[];
  favorites: NewsItem[];
  onToggleFav: (e: React.MouseEvent, item: NewsItem) => void;
  currentFilter: string;
}

const SC_TO_TC: Record<string, string> = {
  "时政": "時政", "经济": "經濟", "社会": "社會", "军事": "軍事",
  "科技": "科技", "体育": "體育", "其他": "其他",
};

const getCategoryColor = (category: string = "其他") => {
  const map: Record<string, string> = {
    "时政": "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
    "经济": "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    "社会": "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    "军事": "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    "科技": "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
    "体育": "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    "其他": "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const key = Object.keys(map).find(k => category.includes(k)) || "其他";
  return map[key];
};

export default function ArchiveModal({
  isOpen,
  onClose,
  dateStr,
  items,
  favorites,
  onToggleFav,
}: ArchiveModalProps) {
  const { settings } = useTheme();

  // 修正：settings.fontStyle
  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#1e1e1e] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-xl font-bold font-serif text-[var(--text-main)]">
               {settings.lang === "sc" ? "历史存档" : "歷史存檔"}
               <span className="ml-2 font-sans font-normal opacity-80">{dateStr}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-[var(--text-sub)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-sub)]">
              <p>{settings.lang === "sc" ? "该日期无新闻数据" : "該日期無新聞數據"}</p>
            </div>
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5">
              {items.map((item, idx) => {
                const isFav = favorites.some((f) => f.link === item.link);
                const rawCategory = item.category || "其他";
                const categoryColor = getCategoryColor(rawCategory);
                
                let displayCategory = rawCategory.substring(0, 2);
                if (settings.lang === "tc") {
                  displayCategory = SC_TO_TC[displayCategory] || displayCategory;
                }

                return (
                  <div key={`${item.link}-${idx}`} className="group flex items-start gap-4 p-5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    
                    <div className="flex flex-col items-center gap-3 shrink-0">
                      <div 
                        style={fontStyleObj}
                        className={`w-10 h-10 flex flex-col items-center justify-center rounded-xl ${categoryColor} border border-black/5 dark:border-white/5`}
                      >
                        <span className="text-[11px] font-bold leading-none tracking-tighter">
                          {displayCategory}
                        </span>
                      </div>

                      <button
                        onClick={(e) => onToggleFav(e, item)}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      >
                         <Star 
                            className={`w-5 h-5 transition-all ${
                              isFav 
                                ? "fill-[var(--primary)] text-[var(--primary)] scale-110" 
                                : "text-[var(--text-sub)]/50 hover:text-[var(--text-main)] scale-100"
                            }`} 
                         />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-2 pt-0.5">
                      <div 
                        style={fontStyleObj}
                        className="text-[15px] font-bold text-[var(--text-main)] leading-snug cursor-text"
                      >
                        {item.title}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-[var(--text-sub)] mt-0.5">
                         <a 
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium opacity-80 hover:text-[var(--primary)] hover:opacity-100 underline decoration-2 underline-offset-2 transition-all flex items-center gap-1"
                         >
                            {item.origin}
                            <ExternalLink className="w-3 h-3 opacity-50" />
                         </a>
                         <span className="w-[1px] h-2 bg-current opacity-20"></span>
                         <span className="opacity-60">{item.time_str}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}