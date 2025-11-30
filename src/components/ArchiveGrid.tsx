"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "./ThemeContext";

interface ArchiveGridProps {
    archiveData: Record<string, any[]>;
    onShowArchive: (dateStr: string) => void;
    onShowFullCalendar: () => void;
}

export default function ArchiveGrid({
    archiveData,
    onShowArchive,
    onShowFullCalendar,
}: ArchiveGridProps) {
    const { settings } = useTheme();

    const today = new Date();
    const days = [];
    const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const count = archiveData[dateStr] ? archiveData[dateStr].length : 0;
        const isToday = i === 0;
        const dayName = isToday ? "本日" : dayNames[d.getDay()];

        days.push({
            dateStr,
            dayName,
            dayNumber: d.getDate(),
            count,
            isToday,
            disabled: count === 0,
        });
    }

    return (
        <div className="py-2.5 my-2.5">
            <div className="grid grid-cols-8 gap-1">
                <div
                    className="bg-[var(--text-main)] text-white rounded-lg h-[54px] flex flex-col items-center justify-center shadow-sm cursor-pointer border border-transparent"
                    onClick={onShowFullCalendar}
                >
                    <span className="text-[8px] text-white/70 mb-[1px] leading-none">历史</span>
                    <span className="text-[14px] font-bold text-white leading-[1.2]">📅</span>
                </div>
                {days.map((day) => (
                    <div
                        key={day.dateStr}
                        className={cn(
                            "bg-white dark:bg-[#252525] rounded-lg h-[54px] flex flex-col items-center justify-center shadow-sm cursor-pointer border border-transparent transition-colors",
                            day.disabled && "opacity-50 pointer-events-none bg-[#f9f9f9] dark:bg-[#2a2a2a]",
                            day.isToday && "border-[var(--primary)] bg-[#fff5f5] dark:bg-[#311b1b]"
                        )}
                        onClick={() => onShowArchive(day.dateStr)}
                    >
                        <span className="text-[8px] text-[#aaa] mb-[1px] leading-none">{day.dayName}</span>
                        <span className="text-[11px] font-bold text-[var(--text-main)] dark:text-white leading-[1.2]">
                            {day.dayNumber}
                        </span>
                        <span className="text-[8px] text-[#999] leading-none mt-[1px]">{day.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
