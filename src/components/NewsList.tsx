"use client";

import NewsCard, { NewsItem } from "./NewsCard";
import NewsCardSkeleton from "./NewsCardSkeleton";
import DailyBriefingCard, { DailyBriefingData } from "./DailyBriefingCard";
import { useTheme } from "./ThemeContext";
import { Loader2 } from "lucide-react";

interface NewsListProps {
  news: NewsItem[];
  isLoading: boolean;
  onToggleFav: (e: React.MouseEvent, item: NewsItem) => void;
  favorites: NewsItem[];
  onShowArchive: (dateStr: string) => void;
  onFilterCategory: (category: string) => void;
  archiveData: Record<string, NewsItem[]>;
  dailyBriefing: DailyBriefingData | null;
}

export default function NewsList({
  news,
  isLoading,
  onToggleFav,
  favorites,
  onFilterCategory,
  dailyBriefing,
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
      {/* Daily Briefing Card */}
      {dailyBriefing && (
        <div className="mb-4 lg:mb-6">
          <DailyBriefingCard data={dailyBriefing} className="w-full" />
        </div>
      )}

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