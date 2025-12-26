"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function NotificationBanner() {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Banner: check if 7 days have passed since last dismissal
        const lastSeenTimestamp = localStorage.getItem("banner-last-seen-timestamp");
        if (lastSeenTimestamp) {
            const daysSinceDismiss = (Date.now() - parseInt(lastSeenTimestamp)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismiss >= 7) {
                setShowBanner(true);
            }
        } else {
            // First time visitor, show banner
            setShowBanner(true);
        }
    }, []);

    const closeBanner = () => {
        setShowBanner(false);
        // Store timestamp for 7-day check
        localStorage.setItem("banner-last-seen-timestamp", Date.now().toString());
    };

    if (!showBanner) return null;

    return (
        <div className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white text-sm font-medium">
            <div className="relative max-w-[600px] mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
                已升级为PWA架构，可在设置中安装到本地
                <span className="font-bold mx-1">cn.saaaai.com</span>
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
