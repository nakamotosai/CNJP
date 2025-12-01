"use client";

import NewsCard, { NewsItem } from "./NewsCard";
import NewsCardSkeleton from "./NewsCardSkeleton";
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
}

export default function NewsList({
  news,
  isLoading,
  onToggleFav,
  favorites,
  onShowArchive,
  onFilterCategory,
  archiveData,
}: NewsListProps) {
  const { settings } = useTheme();

  // Loading state - Show skeleton screens
  if (isLoading) {
    return (
      <div className="px-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <NewsCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state - No news available
  if (news.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          <p
            className="text-base text-gray-500 dark:text-gray-400"
          >
            {settings.lang === "sc" ? "正在连接东京塔" : "正在連接東京塔"}
          </p>
        </div>
      </div>
    );
  }

  // Normal state - Render news cards
  return (
    <div className="px-4 space-y-3">
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
  );
}