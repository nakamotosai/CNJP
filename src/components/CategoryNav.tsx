"use client";

import { useRef } from "react";
import { useTheme } from "./ThemeContext";

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (cat: string) => void;
}

const CATEGORY_IDS = [
  "all", "politics", "economy", "society", "military", "tech", "sports", "other"
];

const ID_TO_SC: Record<string, string> = {
  "all": "全部", "politics": "时政", "economy": "经济", "society": "社会",
  "military": "军事", "tech": "科技", "sports": "体育", "other": "其他",
};

const SC_TO_TC: Record<string, string> = {
  "全部": "全部", "时政": "時政", "经济": "經濟", "社会": "社會",
  "军事": "軍事", "科技": "科技", "体育": "體育", "其他": "其他",
};

const CATEGORY_COLORS: Record<string, string> = {
  "时政": "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30",
  "经济": "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
  "社会": "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-100 dark:border-yellow-900/30",
  "军事": "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-900/30",
  "科技": "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/30",
  "体育": "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
  "其他": "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-900/30",
};

export default function CategoryNav({ currentFilter, onFilterChange }: CategoryNavProps) {
  const { settings } = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  return (
    // 外层：w-full 背景通栏，flex justify-center
    <div className="w-full bg-white/95 dark:bg-[#121212]/95 backdrop-blur-sm border-b border-black/5 dark:border-white/5 z-40 transition-all duration-300 flex justify-center">
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 内层：限制 600px 宽度，确保内容对齐 */}
      <div className="w-full max-w-[600px] px-4 py-2">
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
        >
          {CATEGORY_IDS.map((catKey) => {
            const scLabel = ID_TO_SC[catKey] || catKey;
            let displayLabel = scLabel;
            if (settings.lang === "tc") {
              displayLabel = SC_TO_TC[scLabel] || scLabel;
            }

            const isActive = currentFilter === catKey;
            const isAll = catKey === "all";
            const colorClass = CATEGORY_COLORS[scLabel] || "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-100 dark:border-gray-700";

            return (
              <button
                key={catKey}
                onClick={() => onFilterChange(catKey)}
                style={fontStyleObj}
                className={`
                  shrink-0 px-3.5 py-1.5 rounded-lg text-[13px] font-bold border transition-all duration-200
                  ${isActive 
                    ? "bg-[#2c2c2c] text-white border-[#2c2c2c] shadow-md scale-105" 
                    : `${isAll ? "bg-gray-100 text-gray-600 border-transparent" : colorClass} hover:opacity-80`
                  }
                `}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}