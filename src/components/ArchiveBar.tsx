"use client";

import { useState, useRef, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
        <div className="w-full relative z-10 flex items-center justify-center pt-3 pb-4 px-4">
            <style>{css}</style>
            
            <div className="w-full max-w-screen-xl">
                <div className="grid grid-cols-8 gap-1 lg:gap-5">
                    {/* History Button */}
                    <button
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="flex flex-col items-center justify-center gap-0.5 aspect-[3/4] rounded-xl bg-white dark:bg-[#1e1e1e] shadow-sm hover:shadow-3d-hover border border-black/5 dark:border-white/5 transition-all"
                        title={settings.lang === "sc" ? "历史归档" : "歷史歸檔"}
                    >
                        <CalendarIcon className="w-[1rem] h-[1rem] opacity-70" />
                    </button>

                    {/* Previous 6 days */}
                    {days.slice(0, 6).map((date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        const count = archiveData[dateStr]?.length || 0;
                        const weekday = getWeekdayChar(date);

                        return (
                            <button
                                key={date.toISOString()}
                                onClick={() => handleDayClick(date)}
                                style={fontStyleObj}
                                className="flex flex-col items-center justify-center gap-0.5 aspect-[3/4] rounded-xl bg-white dark:bg-[#1e1e1e] shadow-sm hover:shadow-3d-hover border border-black/5 dark:border-white/5 transition-all"
                            >
                                <span className="text-[0.5rem] text-[var(--text-sub)] font-medium leading-none">
                                    {format(date, "MM/dd")}
                                </span>
                                <span className="text-[0.5rem] text-[var(--text-sub)] opacity-70 font-normal leading-none">
                                    {weekday}
                                </span>
                                <span className="text-[0.8rem] font-black text-[var(--primary)] leading-none">
                                    {count}
                                </span>
                            </button>
                        );
                    })}

                    {/* Today Button */}
                    <button
                        onClick={() => handleDayClick(today)}
                        style={fontStyleObj}
                        className="flex flex-col items-center justify-center gap-0.5 aspect-[3/4] rounded-xl bg-[var(--primary)] shadow-3d hover:shadow-3d-hover text-white transition-all transform shadow-3d-hover"
                    >
                        <span className="text-[0.5rem] opacity-90 font-medium leading-none">
                            {settings.lang === "sc" ? "今日" : "今日"}
                        </span>
                        <span className="text-[0.5rem] opacity-80 font-normal leading-none">
                            {getWeekdayChar(today)}
                        </span>
                        <span className="text-[0.8rem] font-black leading-none">
                            {archiveData[format(today, "yyyy-MM-dd")]?.length || 0}
                        </span>
                    </button>
                </div>
            </div>

            {/* Calendar Popover */}
            {showCalendar && (
                <div
                    ref={calendarRef}
                    className="absolute top-[calc(100%-0.5rem)] left-4 bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-4 z-50 animate-in fade-in zoom-in-95 duration-200"
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