"use client";

import { useTheme } from "./ThemeContext";
import { CATEGORIES, CATEGORY_DOT_COLORS } from "@/lib/constants";
import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play } from "lucide-react";

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (category: string) => void;
}

export default function CategoryNav({ currentFilter, onFilterChange }: CategoryNavProps) {
  const { settings } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false); // 默认开启滚动
  const animationRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTimeRef = useRef<number>(0);

  // CSS Transform 动画状态
  const [offset, setOffset] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  // 触摸事件相关
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Triple the items for infinite scroll illusion
  const marqueeItems = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];

  // 测量内容宽度
  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 3);
    }
  }, []);

  // CSS Transform 动画
  useEffect(() => {
    if (contentWidth === 0 || isStopped) return;

    const scrollSpeed = 30; // pixels per second

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaTime = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (!isPaused && !isStopped) {
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
  }, [isPaused, isStopped, contentWidth]);

  // 鼠标事件 - PC端悬停暂停1秒后恢复
  const handleMouseEnter = useCallback(() => {
    if (isStopped) return;
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    // 1秒后自动恢复
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
  }, [isStopped]);

  const handleMouseLeave = useCallback(() => {
    if (isStopped) return;
    // 离开时也确保1秒后恢复
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
  }, [isStopped]);

  // 触摸事件 - 只在水平滑动组件时暂停，1秒后恢复
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isStopped) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isDraggingRef.current = false;
  }, [isStopped]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isStopped || !touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (deltaX > deltaY && deltaX > 10) {
      isDraggingRef.current = true;
      setIsPaused(true);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    }
  }, [isStopped]);

  const handleTouchEnd = useCallback(() => {
    if (isStopped) return;
    // 拖动后1秒恢复滚动
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    touchStartRef.current = null;
    isDraggingRef.current = false;
  }, [isStopped]);

  const handleToggleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);

    if (isStopped) {
      // 立即恢复滚动，不等待
      setIsStopped(false);
      setIsPaused(false);
      lastTimeRef.current = 0;
    } else {
      // 暂停并重置位置
      setIsStopped(true);
      setIsPaused(true);
      setOffset(0);
    }
  };

  const handleCategoryClick = (key: string) => {
    onFilterChange(key);
    if (!isStopped) {
      setIsPaused(true);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 1000);
    }
  };

  return (
    <div
      className="w-full sticky top-[200px] z-50 px-4 pb-1"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <nav
        className="w-full max-w-[600px] h-[52px] mx-auto bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center px-1 mt-3 overflow-hidden"
      >
        {/* Container - CSS Transform */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={contentRef}
            className="flex items-center h-full gap-2.5 w-max px-2 py-2 will-change-transform"
            style={{
              transform: isStopped ? 'translate3d(0, 0, 0)' : `translate3d(-${offset}px, 0, 0)`,
            }}
          >
            {marqueeItems.map((cat, index) => {
              const uniqueKey = `${cat.key}-${index}`;
              const isActive = currentFilter === cat.key;
              const dotColor = CATEGORY_DOT_COLORS[cat.key] || "bg-gray-400";

              return (
                <button
                  key={uniqueKey}
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`
                    relative flex items-center gap-1.5 text-[13px] font-medium transition-all duration-200 
                    whitespace-nowrap flex-shrink-0 px-3.5 py-1.5 rounded-full
                    ${isActive
                      ? "bg-gray-800 dark:bg-white text-white dark:text-gray-900 shadow-md font-bold"
                      : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 active:scale-95"
                    }
                  `}
                >
                  {cat.key !== 'all' && (
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  )}
                  <span>
                    {settings.lang === "sc"
                      ? cat.label
                      : (cat.label === "时政" ? "時政"
                        : cat.label === "军事" ? "軍事"
                          : cat.label === "经济" ? "經濟"
                            : cat.label === "社会" ? "社會"
                              : cat.label === "娱乐" ? "娛樂"
                                : cat.label === "体育" ? "體育"
                                  : cat.label)
                    }
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stop/Play Button */}
        <button
          onClick={handleToggleStop}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full 
                     bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 
                     hover:bg-gray-200 dark:hover:bg-white/20 hover:scale-110
                     active:scale-95 transition-all ml-2.5"
          title={isStopped ? "Resume Scrolling" : "Stop Scrolling"}
        >
          {isStopped ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
        </button>
      </nav>
    </div>
  );
}