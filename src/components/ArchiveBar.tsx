"use client";

import { useState, useRef, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon, ChevronUp, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { zhCN, zhTW } from "date-fns/locale";
import { useTheme } from "./ThemeContext";
import { NewsItem } from "./NewsCard";

interface ArchiveBarProps {
    onShowArchive: (dateStr: string) => void;
    archiveData?: Record<string, NewsItem[]>;
}

export default function ArchiveBar({ onShowArchive, archiveData = {} }: ArchiveBarProps) {
    const { settings } = useTheme();
    const [showCalendar, setShowCalendar] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true); // Default expanded
    const calendarRef = useRef<HTMLDivElement>(null);

    // 修正：settings.fontStyle
    const fontStyleObj = {
        fontFamily: settings.fontStyle === "serif"
            ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
            : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
    };

    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => subDays(today, i)).reverse();

    const getWeekdayChar = (date: Date): string => {
        const dayMap = ["日", "一", "二", "三", "四", "五", "六"];
        return dayMap[date.getDay()];
    };

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, "yyyy-MM-dd");
        onShowArchive(dateStr);
        setShowCalendar(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setShowCalendar(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const css = `
        .rdp { --rdp-cell-size: 32px; --rdp-accent-color: var(--primary); margin: 0; }
        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: var(--background); }
        .rdp-day_selected { background-color: var(--primary); color: white; }
        .rdp-day_today { font-weight: bold; color: var(--primary); }
    `;

    const availableDates = Object.keys(archiveData);

    return (
        <div className="w-full relative z-10 flex flex-col items-center justify-center pt-2 pb-2 px-4">
            <style>{css}</style>

            <div className="w-full max-w-[600px]">
                {/* Header / Toggle Bar */}
                <div className="flex items-center justify-between mb-2">
                    <span style={fontStyleObj} className="text-xs font-bold text-[var(--text-sub)] tracking-widest uppercase opacity-70">
                        {settings.lang === "sc" ? "历史归档" : "歷史歸檔"}
                    </span>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-sub)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-sub)]" />}
                    </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="grid grid-cols-8 gap-2 animate-in slide-in-from-top-2 duration-200">
                        {/* History Button */}
                        <button
                            onClick={() => setShowCalendar(!showCalendar)}
                            className="flex flex-col items-center justify-center gap-1 aspect-square rounded-lg bg-transparent border border-black/10 dark:border-white/10 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all group"
                            title={settings.lang === "sc" ? "更多日期" : "更多日期"}
                        >
                            <CalendarIcon className="w-4 h-4 text-[var(--text-sub)] group-hover:text-[var(--primary)]" />
                        </button>

                        {/* Previous 6 days */}
                        {days.slice(0, 6).map((date) => {
                            const dateStr = format(date, "yyyy-MM-dd");
                            const count = archiveData[dateStr]?.length || 0;
                            const weekday = getWeekdayChar(date);
                            const isToday = false;

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => handleDayClick(date)}
                                    style={fontStyleObj}
                                    className="flex flex-col items-center justify-center gap-0.5 aspect-square rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all relative group"
                                >
                                    <span className="text-[10px] text-[var(--text-sub)] font-medium leading-none">
                                        {format(date, "MM/dd")}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-aux)] font-normal leading-none opacity-80">
                                        {weekday}
                                    </span>
                                    {count > 0 && (
                                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--primary)] opacity-40 group-hover:opacity-100"></span>
                                    )}
                                </button>
                            );
                        })}

                        {/* Today Button */}
                        <button
                            onClick={() => handleDayClick(today)}
                            style={fontStyleObj}
                            className="flex flex-col items-center justify-center gap-0.5 aspect-square rounded-lg bg-[var(--primary)] text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                        >
                            <span className="text-[10px] font-bold leading-none opacity-90">
                                {settings.lang === "sc" ? "今日" : "今日"}
                            </span>
                            <span className="text-[10px] font-normal leading-none opacity-80">
                                {getWeekdayChar(today)}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Calendar Popover */}
            {showCalendar && (
                <div
                    ref={calendarRef}
                    className="absolute top-full left-4 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-4 z-50 animate-in fade-in zoom-in-95 duration-200"
                >
                    <DayPicker
                        mode="single"
                        selected={undefined}
                        onSelect={(day) => day && handleDayClick(day)}
                        locale={settings.lang === "sc" ? zhCN : zhTW}
                        modifiers={{
                            available: (date) => availableDates.includes(format(date, "yyyy-MM-dd")),
                        }}
                        modifiersStyles={{
                            available: {
                                fontWeight: "bold",
                                textDecoration: "underline",
                                textDecorationColor: "var(--primary)"
                            }
                        }}
                        disabled={{ after: new Date() }}
                    />
                </div>
            )}
        </div>
    );
}