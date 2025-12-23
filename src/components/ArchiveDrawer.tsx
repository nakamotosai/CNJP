"use client";

import { useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { useTheme } from "./ThemeContext";
import { NewsItem } from "./NewsCard";
import { motion } from "framer-motion";

interface ArchiveDrawerProps {
    archiveData: Record<string, NewsItem[]>;
    archiveIndex: Record<string, number>;
    onSelectDate: (dateStr: string) => void;
    isOpen: boolean;
}

export default function ArchiveDrawer({ archiveData, archiveIndex, onSelectDate, isOpen }: ArchiveDrawerProps) {
    const { settings } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);

    const fontStyleObj = {
        fontFamily: settings.fontStyle === "serif"
            ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
            : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
    };

    // 按日期排序 (从 archiveIndex 获取所有日期)
    const sortedDates = Object.keys(archiveIndex)
        .sort((a, b) => a.localeCompare(b));

    const todayStr = format(new Date(), "yyyy-MM-dd");

    // 自动滚动到底部
    useEffect(() => {
        if (isOpen && containerRef.current) {
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            }, 50);
        }
    }, [isOpen]);

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
        <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full pointer-events-auto"
        >
            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

            <div className="bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-xl shadow-elevated rounded-2xl border border-gray-200/60 dark:border-white/10 overflow-hidden ring-1 ring-black/5">
                <div className="max-w-full">
                    <div
                        ref={containerRef}
                        className="max-h-[260px] overflow-y-auto custom-scrollbar"
                    >
                        {sortedDates.map((dateStr) => {
                            // 优先使用 archiveIndex 中的计数
                            const newsCount = archiveIndex[dateStr] || 0;
                            const { monthDay, weekday } = formatDateDisplay(dateStr);
                            const isToday = dateStr === todayStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => onSelectDate(dateStr)}
                                    style={fontStyleObj}
                                    className="w-full h-[40px] flex items-center justify-between px-3 hover:bg-gray-100/80 dark:hover:bg-white/10 transition-all border-b border-gray-100/80 dark:border-white/5 last:border-b-0 group"
                                >
                                    <div className="flex items-center gap-2">
                                        {isToday && (
                                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                        )}
                                        <div className="flex items-baseline gap-2">
                                            <span className={`text-sm ${isToday ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'}`}>
                                                {monthDay}
                                            </span>
                                            <span className="text-xs text-gray-400 group-hover:text-gray-500">
                                                {weekday}
                                            </span>
                                        </div>
                                    </div>

                                    <span className="text-xs font-medium text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md">
                                        {newsCount} {settings.lang === "sc" ? "条" : "條"}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}