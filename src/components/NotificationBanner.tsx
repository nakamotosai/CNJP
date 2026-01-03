"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTheme } from "./ThemeContext";

export default function NotificationBanner() {
    const { settings } = useTheme();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // 目标时间范围：从 2026-01-03 开始共 3 天 (直到 2026-01-06 凌晨)
        const holidayStartTime = new Date("2026-01-03T00:00:00").getTime();
        const holidayEndTime = new Date("2026-01-06T00:00:00").getTime();
        const now = Date.now();

        const inHolidayRange = now >= holidayStartTime && now < holidayEndTime;

        if (inHolidayRange) {
            // 逻辑：每天显示1次。
            // 使用日期字符串作为 Key 检查今天是否已关闭
            const today = new Date().toISOString().split('T')[0];
            const hasSeenToday = localStorage.getItem(`banner-dismissed-${today}`);

            if (!hasSeenToday) {
                setShowBanner(true);
            }
        }
    }, []);

    const closeBanner = () => {
        setShowBanner(false);
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`banner-dismissed-${today}`, "true");
    };

    if (!showBanner) return null;

    return (
        <div className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white text-[13px] font-medium">
            <div className="relative max-w-[600px] lg:max-w-[1200px] mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center">
                <span className="flex-1">
                    {settings.lang === "sc"
                        ? "新增全世界实时匿名聊天功能，祝大家2026新年快乐！"
                        : "新增全世界實時匿名聊天功能，祝大家2026新年快樂！"
                    }
                </span>
                <button
                    onClick={closeBanner}
                    className="p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all shrink-0"
                    aria-label="关闭公告"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
