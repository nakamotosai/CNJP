"use client";

import { useTheme } from "./ThemeContext";
import { CATEGORIES, CATEGORY_DOT_COLORS } from "@/lib/constants";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play } from "lucide-react";

// Map category keys to tag color classes for dark mode
const TAG_COLOR_CLASSES: Record<string, string> = {
  all: "",
  politics: "tag-purple",
  military: "tag-pink",
  economy: "tag-yellow",
  society: "tag-blue",
  entertainment: "tag-pink",
  sports: "tag-green",
  other: "",
};

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (category: string) => void;
  disableSticky?: boolean;
  onShowToast?: (message: string) => void;
  totalCount?: number;
  getCategoryCount?: (category: string) => number;
  isActive?: boolean; // NEW: Controls whether animation runs
}

export default function CategoryNav({
  currentFilter,
  onFilterChange,
  disableSticky = false,
  onShowToast,
  totalCount = 0,
  getCategoryCount,
  isActive = true // Default to active
}: CategoryNavProps) {
  const { settings } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const animationRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [offset, setOffset] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  const marqueeItems = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];

  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 3);
    }
  }, []);

  // Animation loop - now respects isActive prop
  useEffect(() => {
    if (contentWidth === 0 || isStopped || !isActive) {
      // Stop animation when not active
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const scrollSpeed = 30;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPaused && !isStopped && isActive) {
        setOffset(prev => {
          const newOffset = prev + (scrollSpeed * deltaTime) / 1000;
          if (newOffset >= contentWidth) {
            return newOffset - contentWidth;
          }
          return newOffset;
        });
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused, isStopped, contentWidth, isActive]);

  const handleMouseEnter = useCallback(() => {
    if (isStopped || !isActive) return;
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
  }, [isStopped, isActive]);

  const handleMouseLeave = useCallback(() => {
    if (isStopped || !isActive) return;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
  }, [isStopped, isActive]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isStopped || !isActive) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isDraggingRef.current = false;
  }, [isStopped, isActive]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isStopped || !touchStartRef.current || !isActive) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (deltaX > deltaY && deltaX > 10) {
      isDraggingRef.current = true;
      setIsPaused(true);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    }
  }, [isStopped, isActive]);

  const handleTouchEnd = useCallback(() => {
    if (isStopped || !isActive) return;
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    touchStartRef.current = null;
    isDraggingRef.current = false;
  }, [isStopped, isActive]);

  const handleToggleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

    if (isStopped) {
      setIsStopped(false);
      setIsPaused(false);
      lastTimeRef.current = 0;
    } else {
      setIsStopped(true);
      setIsPaused(true);
      setOffset(0);
    }
  };

  const getCategoryLabel = (key: string, label: string) => {
    if (settings.lang === "sc") return label;
    const tcMap: Record<string, string> = {
      "全部": "全部",
      "时政": "時政",
      "军事": "軍事",
      "经济": "經濟",
      "社会": "社會",
      "娱乐": "娛樂",
      "体育": "體育",
    };
    return tcMap[label] || label;
  };

  const handleCategoryClick = (key: string, label: string) => {
    onFilterChange(key);

    if (onShowToast && getCategoryCount) {
      const categoryLabel = getCategoryLabel(key, label);
      if (key === 'all') {
        const msg = settings.lang === 'sc'
          ? `当前已加载 ${totalCount} 篇新闻`
          : `當前已加載 ${totalCount} 篇新聞`;
        onShowToast(msg);
      } else {
        const count = getCategoryCount(key);
        const msg = settings.lang === 'sc'
          ? `${totalCount} 篇新闻中找到 ${count} 篇${categoryLabel}新闻`
          : `${totalCount} 篇新聞中找到 ${count} 篇${categoryLabel}新聞`;
        onShowToast(msg);
      }
    }

    if (!isStopped && isActive) {
      setIsPaused(true);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    }
  };

  return (
    <div
      className="w-full z-50 px-4 pb-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <nav className="category-nav-container w-full max-w-[600px] lg:max-w-[1200px] h-[38px] mx-auto flex items-center px-1 dark:px-0 mt-3 dark:py-1">
        {/* Left Toggle Button - Fixed width for perfect alignment */}
        <div className="flex items-center justify-center w-[52px] border-r border-gray-100 dark:border-white/10 shrink-0 h-4">
          <button
            onClick={handleToggleStop}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full 
                       bg-gray-100/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 
                       hover:bg-gray-200 dark:hover:bg-white/10 hover:scale-110
                       active:scale-95 transition-all"
            title={isStopped ? "Resume Scrolling" : "Stop Scrolling"}
          >
            {isStopped ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden mask-fade-edges">
          <div
            ref={contentRef}
            className="flex items-center h-full gap-2.5 dark:gap-2 w-max px-2 dark:px-1 py-2 dark:py-1.5"
            style={{
              transform: isStopped ? 'translate3d(0, 0, 0)' : `translate3d(-${offset}px, 0, 0)`,
              willChange: isActive ? 'transform' : 'auto',
            }}
          >
            {marqueeItems.map((cat, index) => {
              const uniqueKey = `${cat.key}-${index}`;
              const isActiveFilter = currentFilter === cat.key;
              const isAllButton = cat.key === 'all';
              const dotColor = CATEGORY_DOT_COLORS[cat.key] || "bg-gray-400";

              return (
                <button
                  key={uniqueKey}
                  onClick={() => handleCategoryClick(cat.key, cat.label)}
                  className={`
                    relative flex items-center gap-1.5 text-[13px] transition-all duration-200 
                    whitespace-nowrap flex-shrink-0 px-3.5 dark:px-4 h-[30px] dark:h-[32px] rounded-xl
                    ${isAllButton && isActiveFilter
                      ? `category-tag-active text-[var(--text-main)] dark:text-white font-bold` // Rich look for All button
                      : isActiveFilter
                        ? `bg-gray-100/80 dark:bg-white/10 text-[var(--text-main)] dark:text-white font-bold` // Simple active for others
                        : `text-gray-500 hover:text-[var(--text-main)] dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 font-medium` // Clean inactive for all
                    }
                  `}
                >
                  {isAllButton ? (
                    <span className="w-2.5 h-2.5 rounded-full rainbow-dot shrink-0" />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0 opacity-60 group-hover:opacity-100 transition-opacity`} />
                  )}
                  <span className={isAllButton ? "font-bold" : ""}>{getCategoryLabel(cat.key, cat.label)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}