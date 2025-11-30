"use client";

import React, { Fragment } from "react";
import NewsCard, { NewsItem } from "./NewsCard";
import ArchiveBar from "./ArchiveBar";

interface NewsListProps {
  news: NewsItem[];
  onToggleFav: (e: React.MouseEvent, item: NewsItem) => void;
  favorites: NewsItem[];
  onShowArchive: (dateStr: string) => void;
  onFilterCategory: (category: string) => void;
  archiveData?: Record<string, NewsItem[]>;
}

export default function NewsList({
  news,
  onToggleFav,
  favorites,
  onShowArchive,
  onFilterCategory,
  archiveData
}: NewsListProps) {
  if (!news || news.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-sub)]">
        <p>暂无新闻数据</p>
      </div>
    );
  }

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
          
          {/* 在第 5 条新闻之后插入 ArchiveBar */}
          {index === 4 && (
            // 使用 -mx-4 抵消父容器的 padding，让 ArchiveBar 能够全宽显示
            <div className="-mx-4 my-2">
              <ArchiveBar 
                onShowArchive={onShowArchive} 
                archiveData={archiveData} 
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}