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
            <div className="bg-white/95 dark:bg-[#1a1a1a]/90 backdrop-blur-2xl shadow-elevated rounded-2xl border border-gray-200/60 dark:border-white/10 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                <div className="max-w-full">
                    <div
                        ref={containerRef}
                        className="max-h-[300px] overflow-y-auto custom-scrollbar"
                    >
                        {sortedDates.map((dateStr) => {
                            const newsCount = archiveIndex[dateStr] || 0;
                            const { monthDay, weekday } = formatDateDisplay(dateStr);
                            const isToday = dateStr === todayStr;

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => onSelectDate(dateStr)}
                                    style={fontStyleObj}
                                    className="w-full h-[48px] flex items-center justify-between px-4 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 transition-all border-b border-gray-100/50 dark:border-white/5 last:border-b-0 group relative overflow-hidden"
                                >
                                    {/* Hover active indicator */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <div className="flex items-center gap-3">
                                        {isToday && (
                                            <div className="relative">
                                                <span className="w-2 h-2 rounded-full bg-red-500 block" />
                                                <span className="absolute inset-0 w-2 h-2 rounded-full bg-red-500 animate-ping opacity-40" />
                                            </div>
                                        )}
                                        <div className="flex items-baseline gap-2.5">
                                            <span className={`text-[15px] ${isToday ? 'font-black text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300 font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                                {monthDay}
                                            </span>
                                            <span className={`text-[11px] font-medium tracking-wide ${isToday ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-400'}`}>
                                                {weekday === "日" || weekday === "六" ? (
                                                    <span className="text-red-400 opacity-80">{weekday}</span>
                                                ) : weekday}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-black text-gray-400 dark:text-sub group-hover:text-indigo-500 transition-colors">
                                            {newsCount}
                                        </span>
                                        <span className="text-[10px] text-gray-300 dark:text-gray-600 font-medium">
                                            {settings.lang === "sc" ? "条" : "條"}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}