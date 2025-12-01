"use client";

import { useTheme } from "./ThemeContext";
import { Settings, Info, Heart } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface HeaderProps {
  onOpenFav: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onRefresh?: () => void;
  favCount: number;
  children?: React.ReactNode;
}

export default function Header({
  onOpenFav,
  onOpenAbout,
  onOpenSettings,
  onRefresh,
  favCount,
  children
}: HeaderProps) {
  const { settings } = useTheme();
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClicked = localStorage.getItem("about_badge_date");
    if (lastClicked !== today) {
      setShowBadge(true);
    }
  }, []);

  const handleAboutClick = () => {
    const today = new Date().toDateString();
    localStorage.setItem("about_badge_date", today);
    setShowBadge(false);
    onOpenAbout();
  };

  // 立体文字阴影：一层深色投影 + 一层浅色环境光，营造厚度感
  const text3DStyle = {
    textShadow: "0 2px 1px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.1)"
  };

  // 立体图标阴影：更深的投影
  const icon3DStyle = {
    filter: "drop-shadow(0 4px 3px rgba(0,0,0,0.15)) drop-shadow(0 2px 1px rgba(0,0,0,0.1))"
  };

  // 英文副标题拆分逻辑
  const englishText = "CHINA NEWS FROM JAPAN";

  return (
    <header className="sticky top-0 w-full bg-white/80 dark:bg-[#202020]/80 backdrop-blur-md z-50 shadow-md transition-all duration-300 border-b border-gray-200/50 dark:border-white/5">
      <div className="max-w-[600px] mx-auto px-4 pt-3 pb-0">
        {/* Top Row: Logo & Icons */}
        <div className="flex items-center justify-between mb-3">

          {/* --- Logo Area --- */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity active:scale-95 duration-200 group"
            title={settings.lang === "sc" ? "点击刷新" : "點擊刷新"}
          >
            {/* Logo Image */}
            <div
              className="relative w-10 h-10 rounded-lg overflow-hidden transition-all"
              style={icon3DStyle} // 应用立体阴影
            >
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-cover"
              />
            </div>

            {/* Title Text Container */}
            <div className="flex flex-col justify-center w-fit">
              {/* Chinese Title */}
              <h1
                style={{
                  ...text3DStyle // 应用文字立体阴影
                }}
                className="text-lg font-bold tracking-wide text-[var(--text-main)] leading-none whitespace-nowrap"
              >
                {settings.lang === "sc" ? "从日本看中国" : "從日本看中國"}
              </h1>

              {/* English Subtitle - Flexbox Split Character Mode */}
              {/* 核心修改：使用 flex justify-between 让每一个字符（包括空格）均匀分布 */}
              <div
                className="w-full flex justify-between text-[0.42em] text-gray-400 font-sans mt-[3px] select-none font-medium"
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
            {/* Favorites Button */}
            <button
              onClick={onOpenFav}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative group"
              title={settings.lang === "sc" ? "收藏" : "收藏"}
              style={icon3DStyle} // 应用立体阴影
            >
              <Heart className="w-5 h-5 text-[var(--text-main)]" />
              {favCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#121212]" />
              )}
            </button>

            {/* About Button */}
            <button
              onClick={handleAboutClick}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200 relative"
              title={settings.lang === "sc" ? "关于本站" : "關於本站"}
              style={icon3DStyle} // 应用立体阴影
            >
              <Info className="w-5 h-5 text-[var(--text-main)]" />
              {showBadge && (
                <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 pointer-events-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 text-[8px] text-white justify-center items-center font-bold">!</span>
                </span>
              )}
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all active:scale-90 duration-200"
              title={settings.lang === "sc" ? "设置" : "設置"}
              style={icon3DStyle} // 应用立体阴影
            >
              <Settings className="w-5 h-5 text-[var(--text-main)]" />
            </button>
          </div>
        </div>

        {/* Utility Bar (Search & Archive) */}
        {children}
      </div>
    </header>
  );
}