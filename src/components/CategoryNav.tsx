"use client";

import { useTheme } from "./ThemeContext";
import { CATEGORIES, CATEGORY_DOT_COLORS } from "@/lib/constants";
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface CategoryNavProps {
  currentFilter: string;
  onFilterChange: (category: string) => void;
}

export default function CategoryNav({ currentFilter, onFilterChange }: CategoryNavProps) {
  const { settings } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const animationRef = useRef<number | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Triple the items for infinite scroll illusion
  const marqueeItems = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const scrollSpeed = 0.5; // Pixels per frame

    const animate = () => {
      if (!isPaused && !isStopped && scrollContainer) {
        scrollContainer.scrollLeft += scrollSpeed;

        // Infinite scroll logic:
        // If we've scrolled past the first set (approx 1/3 width), jump back to 0
        // We need to calculate the width of one set.
        // Since we have 3 identical sets, scrollWidth / 3 is the width of one set.
        const oneSetWidth = scrollContainer.scrollWidth / 3;

        if (scrollContainer.scrollLeft >= oneSetWidth) {
          scrollContainer.scrollLeft -= oneSetWidth;
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPaused, isStopped]);

  const handleInteractionStart = () => {
    if (isStopped) return;
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
  };

  const handleInteractionEnd = () => {
    if (isStopped) return;
    // Resume after 2 seconds
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 2000);
  };

  const handleToggleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStopped) {
      // Resume
      setIsStopped(false);
      setIsPaused(false);
    } else {
      // Stop and reset
      setIsStopped(true);
      setIsPaused(true);
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    }
  };

  const handleCategoryClick = (key: string) => {
    onFilterChange(key);
    // Pause for 2 seconds then resume
    if (!isStopped) {
      setIsPaused(true);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 2000);
    }
  };

  return (
    <div className="w-full sticky top-[114px] z-40 px-4 pb-3"
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleInteractionEnd}
    >
      <nav
        className="max-w-[600px] mx-auto flex items-center h-12 px-4 
                   bg-white/90 dark:bg-[#1e1e1e]/90 
                   backdrop-blur-xl 
                   border border-gray-200/50 dark:border-white/10
                   shadow-md dark:shadow-none rounded-xl overflow-hidden"
      >
        {/* Container with mask to fade edges */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-x-auto no-scrollbar mask-linear-fade"
          style={{ scrollBehavior: isStopped ? 'smooth' : 'auto' }}
        >
          <div className="flex items-center h-full gap-2.5 w-max px-2 py-2">
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
                      ? "bg-gray-800 dark:bg-white text-white dark:text-gray-900 shadow-md scale-105 font-bold"
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

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mask-linear-fade {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
        }
      `}</style>
    </div>
  );
}