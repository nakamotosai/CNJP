"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function NotificationBanner() {
    const [showBanner, setShowBanner] = useState(false);
    const [isHolidayMode, setIsHolidayMode] = useState(false);

    useEffect(() => {
        // 设置新年祝福的开始和结束时间
        // 当前时间: 2025-12-31T16:45:05
        // 持续显示3天 (例如从 2025-12-31 到 2026-01-03)
        const holidayStartTime = new Date("2025-12-31T00:00:00").getTime();
        const holidayEndTime = new Date("2026-01-04T00:00:00").getTime(); // 1月4号凌晨结束
        const now = Date.now();

        const inHolidayRange = now >= holidayStartTime && now < holidayEndTime;
        setIsHolidayMode(inHolidayRange);

        if (inHolidayRange) {
            // 新年期间对所有人生效，忽略 localStorage
            setShowBanner(true);
        } else {
            // 恢复原本逻辑：仅对新人或 7 天未见的用户生效
            const lastSeenTimestamp = localStorage.getItem("banner-last-seen-timestamp");
            if (lastSeenTimestamp) {
                const daysSinceDismiss = (now - parseInt(lastSeenTimestamp)) / (1000 * 60 * 60 * 24);
                if (daysSinceDismiss >= 7) {
                    setShowBanner(true);
                }
            } else {
                // 第一次访问
                setShowBanner(true);
            }
        }
    }, []);

    const closeBanner = () => {
        setShowBanner(false);
        // 如果不是在节日期间，存储点击关闭的时间戳
        // 如果在节日期间，也记录一下，虽然逻辑上被 inHolidayRange 覆盖，但为了用户体验（避免每次刷新都弹），
        // 我们可以允许用户在当日 session 或 24 小时内不再看到
        localStorage.setItem("banner-last-seen-timestamp", Date.now().toString());
    };

    if (!showBanner) return null;

    return (
        <div className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white text-sm font-medium">
            <div className="relative max-w-[600px] mx-auto px-4 py-1.5 flex items-center justify-center gap-2 text-center">
                {isHolidayMode ? (
                    "本站访问量暴增导致ai解读功能可能变慢，谢谢理解，2026新年快乐！"
                ) : (
                    <>
                        已升级为PWA架构，可在设置中安装到本地
                        <span className="font-bold mx-1">cn.saaaai.com</span>
                    </>
                )}
                <button
                    onClick={closeBanner}
                    className="absolute right-4 p-1 rounded-full hover:bg-white/20 active:scale-90 transition-all"
                    aria-label="关闭公告"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
