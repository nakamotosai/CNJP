"use client";

import React, { Fragment } from "react";
import NewsCard, { NewsItem } from "./NewsCard";
import NewsCardSkeleton from "./NewsCardSkeleton";
import { useTheme } from "./ThemeContext";

interface NewsListProps {
  news: NewsItem[];
  isLoading: boolean;
  onToggleFav: (e: React.MouseEvent, item: NewsItem) => void;
  favorites: NewsItem[];
  onShowArchive: (dateStr: string) => void;
  onFilterCategory: (category: string) => void;
  archiveData?: Record<string, NewsItem[]>;
}

export default function NewsList({
  news,
  isLoading,
  onToggleFav,
  favorites,
  onShowArchive,
  onFilterCategory,
  archiveData
}: NewsListProps) {
  const { settings } = useTheme();

  // Show skeleton when loading
  if (isLoading) {
    return (
      <div className="w-full px-4 space-y-4 pb-8">
        {Array.from({ length: 5 }).map((_, index) => (
          <NewsCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Show friendly empty state when no data (and not loading)
  if (!news || news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-sub)]">
        <div className="text-center space-y-2">
          <p className="text-lg">
            {settings.lang === "sc" ? "正在连接东京塔..." : "正在連接東京塔..."}
          </p>
          <p className="text-sm opacity-60">
            {settings.lang === "sc" ? "暂无新闻数据" : "暫無新聞數據"}
          </p>
        </div>
      </div>
    );
  }

  // Show actual news cards
  return (
    <div className="w-full px-4 space-y-4 pb-8">
      {news.map((item, index) => (
        <Fragment key={`${item.link}-${index}`}>
          <NewsCard
            item={item}
            isFav={favorites.some((f) => f.link === item.link)}
            onToggleFav={onToggleFav}
            onFilterCategory={onFilterCategory}
          />
        </Fragment>
      ))}
    </div>
  );
}