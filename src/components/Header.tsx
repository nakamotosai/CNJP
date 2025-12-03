"use client";

import { useTheme } from "./ThemeContext";
import { Settings, Info, Heart, Tv, Sparkles, Newspaper, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HeaderProps {
  onOpenFav: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onRefresh?: () => void;
  favCount: number;
  activeTab: 'news' | 'live' | 'coming';
  onTabChange: (tab: 'news' | 'live' | 'coming') => void;
}

export default function Header({
  onOpenFav,
  onOpenAbout,
  onOpenSettings,
  onRefresh,
  favCount,
  activeTab,
  onTabChange
}: HeaderProps) {
  const { settings } = useTheme();
  const [showBadge, setShowBadge] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 关于页面小红点提示（每天一次）
    const today = new Date().toDateString();
    const lastClicked = localStorage.getItem("about_badge_date");
    if (lastClicked !== today) {
      setShowBadge(true);
    }

    // 域名横幅：每天第一次访问才显示
    const lastSeen = localStorage.getItem("banner-last-seen-date");
    if (lastSeen !== today) {
      setShowBanner(true);
    }

    // 调试用：强制每次都显示横幅（用完请删掉这行）
    // localStorage.removeItem("banner-last-seen-date");
  }, []);

  const handleAboutClick = () => {
    const today = new Date().toDateString();
    localStorage.setItem("about_badge_date", today);
    setShowBadge(false);
    onOpenAbout();
  };

  // 关闭横幅 → 只记录今天已看，明天再来
  const closeBanner = () => {
    setShowBanner(false);
    const today = new Date().toDateString();
    localStorage.setItem("banner-last-seen-date", today);
  };

  const text3DStyle = {
    textShadow: "0 2px 1px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)"
  };

  const icon3DStyle = {
    filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.15)) drop-shadow(0 2px 1px rgba(0,0,0,0.1))"
  };

  const englishText = "https://cn.saaaai.com";

  return (
    <>
      {/* 域名公告横幅：每天第一次访问显示 */}
      {showBanner && (
        <div className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white text-sm font-medium">
          <div className="relative max-w-[600px] mx-auto px-4 py-1.5 flex items-center justify-center gap-2">
            请收藏本站全新域名
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
      )}

      <header className="sticky top-0 w-full bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md z-50 shadow-sm dark:shadow-none transition-all duration-300 border-b border-gray-200/50 dark:border-white/5">
        <div className="relative max-w-[600px] mx-auto px-4 pt-4 pb-3">

          {/* Top Row: Logo & Icons */}
          <div className="flex items-center justify-between mb-4">

            {/* --- Logo Area --- */}
            <button
              onClick={onRefresh}
              className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity active:scale-95 duration-200 group"
              title={settings.lang === "sc" ? "点击刷新" : "點擊刷新"}
            >

              {/* logo暂时隐藏，以后可恢复 */}
              {/*
              <div className="relative w-8 h-8 rounded-lg overflow-hidden transition-all" style={icon3DStyle}>
                <Image src="/logo.png" alt="Logo" fill className="object-cover" />
              </div>
              */}

              <div className="flex flex-col justify-center w-fit ml-7 mt-1">
                <h1
                  style={{ ...text3DStyle }}
                  className="text-xl font-bold tracking-wide text-[var(--text-main)] leading-none whitespace-nowrap"
                >
                  {settings.lang === "sc" ? "从日本看中国" : "從日本看中國"}
                </h1>

                <div
                  className="w-full flex justify-between text-[0.6em] text-gray-400 font-sans mt-[3px] select-none font-medium"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.1)" }}
                >
                  {englishText.split('').map((char, index) => (
                    <span key={index} className={char === ' ' ? 'w-[0.5em]' : ''}>
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  ))}
                </div>
              </div>
            </button>

            {/* --- Right Icons Area --- */}
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenFav}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative group dark:text-gray-200"
                style={icon3DStyle}
              >
                <Heart className="w-5 h-5 text-[var(--text-main)]" />
                {favCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#121212]" />
                )}
              </button>

              <button
                onClick={handleAboutClick}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative dark:text-gray-200"
                style={icon3DStyle}
              >
                <Info className="w-5 h-5 text-[var(--text-main)]" />
                {showBadge && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 text-[8px] text-white justify-center items-center font-bold">!</span>
                  </span>
                )}
              </button>

              <button
                onClick={onOpenSettings}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 dark:text-gray-200"
                style={icon3DStyle}
              >
                <Settings className="w-5 h-5 text-[var(--text-main)]" />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="relative flex items-center p-1 bg-gray-100 dark:bg-white/10 rounded-xl">

            <button
              onClick={() => onTabChange('news')}
              className="relative flex-1 flex items-center justify-center py-2 text-sm font-medium transition-colors duration-200 z-10"
            >
              {activeTab === 'news' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-[#121212] rounded-lg shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-2 ${activeTab === 'news' ? 'text-[var(--text-main)] font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                <Newspaper className={`w-4 h-4 ${activeTab === 'news' ? 'text-[var(--primary)]' : 'text-gray-400'}`} />
                {settings.lang === "sc" ? "日媒中国报道" : "日媒中國報道"}
              </span>
            </button>

            <button
              onClick={() => onTabChange('live')}
              className="relative flex-1 flex items-center justify-center py-2 text-sm font-medium transition-colors duration-200 z-10"
            >
              {activeTab === 'live' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-white dark:bg-[#121212] rounded-lg shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className={`relative z-10 flex items-center gap-2 ${activeTab === 'live' ? 'text-[var(--text-main)] font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                <Tv className={`w-4 h-4 ${activeTab === 'live' ? 'text-red-500' : 'text-gray-400'}`} />
                {settings.lang === "sc" ? "日本实时监控" : "日本實時監控"}
              </span>
            </button>

          </div>
        </div>
      </header>
    </>
  );
}