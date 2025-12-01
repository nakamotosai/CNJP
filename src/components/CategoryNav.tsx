"use client";

import { useTheme } from "./ThemeContext";
import { CATEGORIES, CATEGORY_DOT_COLORS } from "@/lib/constants";

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (category: string) => void;
}

export default function CategoryNav({ currentFilter, onFilterChange }: CategoryNavProps) {
  const { settings } = useTheme();

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  return (
    <nav className="sticky top-0 w-full bg-[var(--background)] z-40 overflow-x-auto scrollbar-hide pt-2 pb-2">
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Compact spacing: gap-2 instead of gap-4, h-[34px] instead of h-[40px] */}
      <div className="px-3 flex items-center h-[34px] gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = currentFilter === cat.key;
          const dotColor = CATEGORY_DOT_COLORS[cat.key] || "bg-gray-400";

          return (
            <button
              key={cat.key}
              onClick={() => onFilterChange(cat.key)}
              style={fontStyleObj}
              className={`
                relative h-full flex items-center gap-1.5 text-[13px] font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 px-2.5 rounded-full
                ${isActive
                  ? "bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
                }
              `}
            >
              {/* Dot Indicator */}
              {cat.key !== 'all' && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              )}

              {/* Label */}
              <span>
                {settings.lang === "sc"
                  ? cat.label
                  : (cat.label === "时政" ? "時政"
                    : cat.label === "经济" ? "經濟"
                      : cat.label === "社会" ? "社會"
                        : cat.label === "娱乐" ? "娛樂"
                          : cat.label === "科技" ? "科技"
                            : cat.label === "体育" ? "體育"
                              : cat.label)
                }
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}