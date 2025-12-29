"use client";

import { useTheme } from "./ThemeContext";
import { Settings, Heart, Tv, Sparkles, Newspaper, X, CloudRain, AlertTriangle, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationBanner from "./NotificationBanner";
import { ABOUT_PAGE_CONTENT } from "@/lib/about-content";


interface HeaderProps {
  onOpenFav: () => void;
  onOpenSettings: () => void;
  onRefresh?: () => void;
  favCount: number;
  activeTab: 'news' | 'live' | 'disaster';
  onTabChange: (tab: 'news' | 'live' | 'disaster') => void;
  disableSticky?: boolean;
}

export default function Header({
  onOpenFav,
  onOpenSettings,
  onRefresh,
  favCount,
  activeTab,
  onTabChange,
  disableSticky = false
}: HeaderProps) {
  const { settings, updateSettings } = useTheme();
  const [showBadge, setShowBadge] = useState(false);

  /* - EARTHQUAKE ALERT LOGIC - */
  const [quakeAlert, setQuakeAlert] = useState<{
    id: string;
    location: string;
    magnitude: number;
    shindo: string; // e.g., "5强"
    time: string;
  } | null>(null);

  useEffect(() => {
    const checkEarthquake = async () => {
      try {
        // Fetch recent earthquakes (code 551 is standard info)
        const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=5");
        const data = await res.json();

        if (!Array.isArray(data)) return;

        // Thresholds: Magnitude >= 6.0 (User request) OR Max Scale >= 55 (Shindo 6-)
        // Time window: Last 1 hour
        const ONE_HOUR = 60 * 60 * 1000;
        const now = Date.now();

        const majorQuake = data.find((item: any) => {
          if (!item.earthquake || !item.earthquake.hypocenter) return false;

          const quakeTime = new Date(item.earthquake.time).getTime();
          const isRecent = (now - quakeTime) < ONE_HOUR;
          const mag = item.earthquake.hypocenter.magnitude || 0;
          const scale = item.earthquake.maxScale || 0;

          // P2PQuake Scale: 45=5-, 50=5+, 55=6-, 60=6+, 70=7
          const isMajor = mag >= 6.0 || scale >= 55;
          return isRecent && isMajor;
        });

        if (majorQuake) {
          const dismissedId = localStorage.getItem("dismissed_quake_id");
          if (dismissedId !== majorQuake.id) {
            const getShindoStr = (scale: number) => {
              if (scale >= 70) return "7";
              if (scale >= 60) return "6强";
              if (scale >= 55) return "6弱";
              if (scale >= 50) return "5强";
              if (scale >= 45) return "5弱";
              return "4";
            };

            setQuakeAlert({
              id: majorQuake.id,
              location: majorQuake.earthquake.hypocenter.name,
              magnitude: majorQuake.earthquake.hypocenter.magnitude,
              shindo: getShindoStr(majorQuake.earthquake.maxScale),
              time: majorQuake.earthquake.time
            });
          }
        } else {
          // No major quake anymore, clear alert if it was showing
          setQuakeAlert(null);
        }
      } catch (e) {
        console.error("Failed to check earthquake alerts", e);
      }
    };

    checkEarthquake(); // Initial check
    const interval = setInterval(checkEarthquake, 2 * 60 * 1000); // Check every 2 minutes for better timeliness
    return () => clearInterval(interval);
  }, []);

  const dismissQuakeAlert = () => {
    if (quakeAlert) {
      localStorage.setItem("dismissed_quake_id", quakeAlert.id);
      setQuakeAlert(null);
    }
  };

  // About page badge logic - shows when version changes or first visit
  // Reads version from about-content.ts changelog, so updating changelog auto-triggers badge
  const latestVersion = ABOUT_PAGE_CONTENT.sc.sections.changelog.entries[0]?.version || "1.0.0";

  useEffect(() => {
    const seenVersion = localStorage.getItem("about_seen_version");
    if (seenVersion !== latestVersion) {
      setShowBadge(true);
    }
  }, [latestVersion]);

  const handleAboutClick = () => {
    localStorage.setItem("about_seen_version", latestVersion);
    setShowBadge(false);
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
  const lastScrollYRef = useRef(0);
  const SCROLL_THRESHOLD = 50; // Don't hide until scrolled past 50px
  const DELTA = 5; // Minimum scroll distance to trigger a change
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;

      // If we haven't scrolled more than the delta, do nothing
      if (Math.abs(currentScrollY - lastScrollY) < DELTA) return;

      // Show if scrolling up, hide if scrolling down
      if (currentScrollY < SCROLL_THRESHOLD) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > SCROLL_THRESHOLD) {
        setIsVisible(false); // Scrolling down
      } else {
        setIsVisible(true); // Scrolling up
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <AnimatePresence>
        {quakeAlert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full bg-red-600 text-white z-[100] relative overflow-hidden"
          >
            <div className="max-w-[600px] mx-auto px-4 py-2 flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                  <span className="font-bold text-lg leading-none">
                    {settings.lang === "sc" ? "地震速报" : "地震速報"}
                  </span>
                  <span className="opacity-90 leading-tight">
                    {settings.lang === "sc"
                      ? `${quakeAlert.location} 发生 M${quakeAlert.magnitude.toFixed(1)} 地震`
                      : `${quakeAlert.location} 發生 M${quakeAlert.magnitude.toFixed(1)} 地震`}
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold w-fit">
                    {settings.lang === "sc" ? `震度 ${quakeAlert.shindo}` : `震度 ${quakeAlert.shindo}`}
                  </span>
                </div>
              </div>

              <button
                onClick={dismissQuakeAlert}
                className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationBanner />

      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isVisible ? 0 : -150 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`${disableSticky ? '' : 'sticky top-0'} w-full bg-white/95 dark:bg-transparent backdrop-blur-md z-50 shadow-sm dark:shadow-none transition-all duration-300 border-b border-gray-200/50 dark:border-white/5 overflow-hidden`}
      >
        {/* BRANDING WATERMARK LAYER - Pattern for Header */}
        <div
          className="absolute inset-0 opacity-[0.06] dark:opacity-[0.06] pointer-events-none z-0 select-none"
          style={{
            backgroundImage: "url('/back.png')",
            backgroundSize: '400px auto',
            backgroundPosition: 'center',
            backgroundRepeat: 'repeat',
            filter: 'grayscale(100%) brightness(0.9) contrast(1.1)',
          }}
        />

        <div className="relative max-w-[600px] lg:max-w-[1200px] mx-auto px-4 pt-4 pb-3 z-10">

          <div className="flex items-center justify-between mb-4 lg:mb-8 relative">
            {/* Title Wrapper - Absolute centered on large screens to avoid button interference */}
            <div className="lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2 lg:z-10">
              <button
                onClick={() => {
                  window.scrollTo(0, 0);
                  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
                    history.scrollRestoration = 'manual';
                  }
                  localStorage.removeItem("default_tab");
                  window.location.reload();
                }}
                className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity active:scale-95 duration-200 group"
                title={settings.lang === "sc" ? "点击刷新" : "點擊刷新"}
              >
                <motion.div
                  animate={{ rotate: [0, 3, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                  className="relative w-[24px] h-[24px] lg:w-[36px] lg:h-[36px] shrink-0 category-tag-active"
                >
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    fill
                    className="object-contain p-[2px] lg:p-[3px]"
                    priority
                  />
                </motion.div>
                <div className="flex flex-col justify-center w-fit lg:items-center">
                  <h1
                    style={{ fontFamily: "'Noto Serif SC', 'Songti SC', serif" }}
                    className="text-xl lg:text-3xl font-bold tracking-wide text-[var(--text-main)] text-gradient-animated leading-none whitespace-nowrap"
                  >
                    {settings.lang === "sc" ? "从日本看中国" : "從日本看中國"}
                  </h1>

                  <div
                    className="w-full flex justify-between text-[0.6em] text-gray-400 font-sans leading-none select-none font-medium"
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
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative group"
              >
                <Heart className="w-5 h-5 text-[var(--text-main)] dark:text-gray-300" />
                {favCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#0b0d12]" />
                )}
              </button>

              {/* Language Toggle Button */}
              <button
                onClick={() => updateSettings({ lang: settings.lang === 'sc' ? 'tc' : 'sc' })}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
                title={settings.lang === 'sc' ? '切换到繁体' : '切換到簡體'}
              >
                <span className="text-[15px] font-bold text-[var(--text-main)] dark:text-gray-300 leading-none">
                  {settings.lang === 'sc' ? '繁' : '简'}
                </span>
              </button>

              {/* Settings Button */}
              <button
                onClick={onOpenSettings}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
              >
                <Settings className="w-5 h-5 text-[var(--text-main)] dark:text-gray-300" />
              </button>

              {/* About Button - Now rightmost with arrow icon */}
              <Link
                href="/about"
                onClick={handleAboutClick}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative"
              >
                <ArrowRight className="w-5 h-5 text-[var(--text-main)] dark:text-gray-300" />
                {showBadge && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5 pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 text-[8px] text-white justify-center items-center font-bold">!</span>
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="tab-container w-full max-w-[600px] lg:max-w-[1200px] h-[44px] mx-auto flex items-center gap-2 dark:gap-3 px-1.5 dark:px-0 mt-3">
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
                      ? 'flex-[2] tab-active text-[var(--text-main)] dark:text-zinc-100'
                      : 'flex-1 tab-inactive text-gray-500 dark:text-gray-400 hover:bg-white/60'
                    }
                  `}
                >
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <tab.icon
                      className={`w-4 h-4 transition-colors duration-300 ${isActive ? tab.activeColor + ' dark:text-zinc-100' : 'text-gray-400'}`}
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