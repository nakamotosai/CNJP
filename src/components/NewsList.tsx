"use client";

import NewsCard, { NewsItem } from "./NewsCard";
import NewsCardSkeleton from "./NewsCardSkeleton";
import DailyBriefingCard, { DailyBriefingData } from "./DailyBriefingCard";
import { useTheme } from "./ThemeContext";
import { Loader2 } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";

interface NewsListProps {
  news: NewsItem[];
  isLoading: boolean;
  onToggleFav: (e: React.MouseEvent, item: NewsItem) => void;
  favorites: NewsItem[];
  onShowArchive: (dateStr: string) => void;
  onFilterCategory: (category: string) => void;
  archiveData: Record<string, NewsItem[]>;
  dailyBriefing: DailyBriefingData | null;
  currentFilter: string;
  searchQuery: string;
}

export default function NewsList({
  news,
  isLoading,
  onToggleFav,
  favorites,
  onFilterCategory,
  dailyBriefing,
  currentFilter,
  searchQuery,
}: NewsListProps) {
  const { settings } = useTheme();

  // Loading state
  if (isLoading) {
    return (
      <div className="px-4 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 lg:pb-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <NewsCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (news.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <p className="text-base text-gray-500 dark:text-gray-400">
            {settings.lang === "sc" ? "正在连接东京塔" : "正在連接東京塔"}
          </p>
        </div>
      </div>
    );
  }

  // Pure CSS Grid rendering - No JS height/width calculations
  return (
    <div className="px-4 lg:pb-6">
      {/* Daily Briefing Card - Only show when "All" is selected and NO search is active */}
      <AnimatePresence>
        {dailyBriefing && currentFilter === "all" && !searchQuery && (
          <motion.div
            key="daily-briefing"
            initial={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            animate={{
              opacity: 1,
              height: 'auto',
              marginBottom: 24,
              transition: {
                height: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] },
                opacity: { duration: 0.3, delay: 0.1 }
              }
            }}
            onAnimationComplete={() => {
              // Ensure shadow isn't clipped after entrance animation
              const el = document.getElementById('daily-briefing-wrapper');
              if (el) el.style.overflow = 'visible';
            }}
            id="daily-briefing-wrapper"
            exit={{
              opacity: 0,
              height: 0,
              marginBottom: 0,
              transition: {
                height: { duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] },
                opacity: { duration: 0.2 }
              }
            }}
            className="w-full"
          >
            <DailyBriefingCard data={dailyBriefing} className="w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* News Grid - Purely CSS driven */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {news.map((item, i) => {
          const isFav = favorites.some((f) => f.link === item.link);
          return (
            <NewsCard
              key={`${item.link}-${i}`}
              item={item}
              isFav={isFav}
              onToggleFav={onToggleFav}
              onFilterCategory={onFilterCategory}
            />
          );
        })}
      </div>
    </div>
  );
}
