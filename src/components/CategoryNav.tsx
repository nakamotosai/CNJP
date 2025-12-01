"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeContext";
import { CATEGORIES, CATEGORY_DOT_COLORS } from "@/lib/constants";

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (category: string) => void;
}

export default function CategoryNav({ currentFilter, onFilterChange }: CategoryNavProps) {
  const { settings } = useTheme();
  const itemsRef = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll to active item
  useEffect(() => {
    const activeItem = itemsRef.current[currentFilter];
    if (activeItem) {
      activeItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentFilter]);

  return (
    <nav className="w-full z-40 overflow-x-auto scrollbar-hide py-1 bg-transparent transition-all duration-300">
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Compact spacing: gap-2, reduced height to h-[26px] */}
      <div className="px-3 flex items-center h-[26px] gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = currentFilter === cat.key;
          const dotColor = CATEGORY_DOT_COLORS[cat.key] || "bg-gray-400";

          return (
            <button
              key={cat.key}
              ref={(el) => {
                itemsRef.current[cat.key] = el;
              }}
              onClick={() => onFilterChange(cat.key)}
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