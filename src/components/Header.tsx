"use client";

import { useTheme } from "./ThemeContext";
import { Settings, Info, Heart, Tv, Sparkles, Newspaper, X, CloudRain } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";


interface HeaderProps {
  onOpenFav: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onRefresh?: () => void;
  favCount: number;
  activeTab: 'news' | 'live' | 'disaster';
  onTabChange: (tab: 'news' | 'live' | 'disaster') => void;
  disableSticky?: boolean;
}

export default function Header({
  onOpenFav,
  onOpenAbout,
  onOpenSettings,
  onRefresh,
  favCount,
  activeTab,
  onTabChange,
  disableSticky = false
}: HeaderProps) {
  const { settings, updateSettings } = useTheme();
  const [showBadge, setShowBadge] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClicked = localStorage.getItem("about_badge_date");
    if (lastClicked !== today) {
      setShowBadge(true);
    }

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

  const handleAboutClick = () => {
    const today = new Date().toDateString();
    localStorage.setItem("about_badge_date", today);
    setShowBadge(false);
    onOpenAbout();
  };

  const closeBanner = () => {
    setShowBanner(false);
    // Store timestamp for 7-day check
    localStorage.setItem("banner-last-seen-timestamp", Date.now().toString());
  };

  const text3DStyle = {
    textShadow: "0 2px 1px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)"
  };

  const icon3DStyle = {
    filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.15)) drop-shadow(0 2px 1px rgba(0,0,0,0.1))"
  };

  const englishText = "https://cn.saaaai.com";

  const tabs = [
    {
      id: 'news' as const,
      icon: Newspaper,
      labelFull: settings.lang === "sc" ? "日媒中国报道" : "日媒中國報道",
      labelShort: settings.lang === "sc" ? "新闻" : "新聞",
      activeColor: "text-[var(--primary)]"
    },
    {
      id: 'live' as const,
      icon: Tv,
      labelFull: settings.lang === "sc" ? "日本实时监控" : "日本實時監控",
      labelShort: settings.lang === "sc" ? "直播" : "直播",
      activeColor: "text-red-500"
    },
    {
      id: 'disaster' as const,
      icon: CloudRain,
      labelFull: settings.lang === "sc" ? "日本天气灾害" : "日本天氣災害",
      labelShort: settings.lang === "sc" ? "灾害" : "災害",
      activeColor: "text-blue-500"
    }
  ];

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show if scrolling up, hide if scrolling down
      // But always show when at the top of the page
      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false); // Scrolling down
      } else {
        setIsVisible(true); // Scrolling up
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <>
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

      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isVisible ? 0 : -150 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`${disableSticky ? '' : 'sticky top-0'} w-full bg-white/95 dark:bg-transparent backdrop-blur-md z-50 shadow-sm dark:shadow-none transition-all duration-300 border-b border-gray-200/50 dark:border-white/5`}
      >
        <div className="relative max-w-[600px] lg:max-w-[1200px] mx-auto px-4 pt-4 pb-3">

          <div className="flex items-center justify-between mb-4 lg:mb-8 relative">
            {/* Title Wrapper - Absolute centered on large screens to avoid button interference */}
            <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2 lg:z-10">
              <button
                onClick={onRefresh}
                className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity active:scale-95 duration-200 group"
                title={settings.lang === "sc" ? "点击刷新" : "點擊刷新"}
              >
                <div className="flex flex-col justify-center w-fit ml-7 lg:ml-0 mt-1 lg:items-center">
                  <h1
                    style={{ ...text3DStyle, fontFamily: "'Noto Serif SC', 'Songti SC', serif" }}
                    className="text-xl lg:text-3xl font-bold tracking-wide text-[var(--text-main)] text-gradient-animated leading-none whitespace-nowrap"
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
            </div>

            {/* Placeholder to maintain flex layout for buttons if needed, or just let buttons float right */}
            <div className="hidden lg:block w-10 h-10" />

            <div className="flex items-center gap-1 z-20">
              <button
                onClick={onOpenFav}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative group"
                style={icon3DStyle}
              >
                <Heart className="w-5 h-5 text-[var(--text-main)] dark:text-gray-200" />
                {favCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0b0d12]" />
                )}
              </button>

              {/* Language Toggle Button */}
              <button
                onClick={() => updateSettings({ lang: settings.lang === 'sc' ? 'tc' : 'sc' })}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
                style={icon3DStyle}
                title={settings.lang === 'sc' ? '切换到繁体' : '切換到簡體'}
              >
                <span className="w-5 h-5 flex items-center justify-center text-base font-bold text-[var(--text-main)] dark:text-gray-200">
                  {settings.lang === 'sc' ? '繁' : '简'}
                </span>
              </button>

              <button
                onClick={handleAboutClick}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative"
                style={icon3DStyle}
              >
                <Info className="w-5 h-5 text-[var(--text-main)] dark:text-gray-200" />
                {showBadge && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 text-[8px] text-white justify-center items-center font-bold">!</span>
                  </span>
                )}
              </button>

              <button
                onClick={onOpenSettings}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
                style={icon3DStyle}
              >
                <Settings className="w-5 h-5 text-[var(--text-main)] dark:text-gray-200" />
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="tab-container w-full max-w-[600px] lg:max-w-[1200px] h-[44px] mx-auto flex items-center gap-2 dark:gap-3 px-1.5 dark:px-0 mt-3 overflow-hidden">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    relative h-[32px] dark:h-[34px] flex items-center justify-center text-[13px] font-medium 
                    transition-all duration-300 ease-in-out rounded-xl backdrop-blur-sm overflow-hidden
                    ${isActive
                      ? 'flex-[2] tab-active text-[var(--text-main)] dark:text-white'
                      : 'flex-1 tab-inactive text-gray-500 dark:text-gray-400 hover:bg-white/60'
                    }
                  `}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <tab.icon
                      className={`w-4 h-4 transition-colors duration-300 ${isActive ? tab.activeColor + ' dark:text-white' : 'text-gray-400'}`}
                    />
                    <span className={`${isActive ? 'font-bold' : ''}`}>
                      <span className={isActive ? "hidden" : "block md:hidden"}>
                        {tab.labelShort}
                      </span>
                      <span className={isActive ? "block" : "hidden md:block"}>
                        {tab.labelFull}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>


        </div>
      </motion.header>
    </>
  );
}