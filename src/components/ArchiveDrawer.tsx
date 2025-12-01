"use client";

import { useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { useTheme } from "./ThemeContext";
import { NewsItem } from "./NewsCard";

interface ArchiveDrawerProps {
    archiveData: Record<string, NewsItem[]>;
    onSelectDate: (dateStr: string) => void;
}

export default function ArchiveDrawer({ archiveData, onSelectDate }: ArchiveDrawerProps) {
    const { settings } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);

    const fontStyleObj = {
        fontFamily: settings.fontStyle === "serif"
            ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
            : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
    };

    // Sort dates chronologically (oldest first, newest last)
    const sortedDates = Object.keys(archiveData)
        .sort((a, b) => a.localeCompare(b)); // Ascending order

    // Get today's date string
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Auto-scroll to bottom (today) within the container only
    useEffect(() => {
        if (containerRef.current) {
            // Scroll the container to the bottom, not the entire page
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    const formatDateDisplay = (dateStr: string) => {
        try {
            const date = parseISO(dateStr);
            const month = format(date, "MM");
            const day = format(date, "dd");
            const weekdayMap = ["日", "一", "二", "三", "四", "五", "六"];
            const weekday = weekdayMap[date.getDay()];

            return {
                monthDay: `${month}/${day}`,
                weekday: weekday,
            };
        } catch (e) {
            return { monthDay: dateStr, weekday: "" };
        }
    };

    if (sortedDates.length === 0) {
        return null;
    }

    return (
        <div className="w-full px-4 animate-in slide-in-from-top-2 duration-200">
            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

            <div className="max-w-[600px] mx-auto">
                {/* Scrollable Date List */}
                <div
                    ref={containerRef}
                    className="max-h-[144px] overflow-y-auto border-y border-gray-100 dark:border-gray-800/50 custom-scrollbar"
                >
                    {sortedDates.map((dateStr) => {
                        const newsCount = archiveData[dateStr]?.length || 0;
                        const { monthDay, weekday } = formatDateDisplay(dateStr);
                        const isToday = dateStr === todayStr;

                        return (
                            <button
                                key={dateStr}
                                onClick={() => onSelectDate(dateStr)}
                                style={fontStyleObj}
                                className="w-full h-[48px] flex items-center justify-between px-4 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-gray-800/30 last:border-b-0"
                            >
                                <div className="flex items-center gap-3">
                                    {/* Red dot indicator for today */}
                                    {isToday && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    )}

                                    {/* Date */}
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-sm ${isToday ? 'font-bold text-[var(--text-main)]' : 'text-[var(--text-sub)]'}`}>
                                            {monthDay}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {weekday}
                                        </span>
                                    </div>
                                </div>

                                {/* News count */}
                                <span className="text-xs text-gray-400">
                                    {newsCount} {settings.lang === "sc" ? "条" : "條"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
