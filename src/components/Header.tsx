"use client";

import { useTheme } from "./ThemeContext";
import { Settings, Info, Heart } from "lucide-react";
import Image from "next/image";

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

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  return (
    <header className="w-full bg-white dark:bg-[#121212] z-50">
      <div className="max-w-[600px] mx-auto px-4 pt-3 pb-2">
        {/* Top Row: Logo & Icons */}
        <div className="flex items-center justify-between mb-3">
          {/* Logo & Titles - Click to Refresh */}
          <button
            onClick={onRefresh}
            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            title={settings.lang === "sc" ? "点击刷新" : "點擊刷新"}
          >
            <div className="relative w-8 h-8 rounded-lg overflow-hidden shadow-sm shrink-0">
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center">
              <h1
                style={fontStyleObj}
                className="text-lg font-bold tracking-wide text-[var(--text-main)] leading-tight"
              >
                {settings.lang === "sc" ? "从日本看中国" : "從日本看中國"}
              </h1>
              <span className="text-[8px] text-gray-400 font-medium tracking-wider uppercase">
                China News From Japan
              </span>
            </div>
          </button>

          {/* Right Icons */}
          <div className="flex items-center gap-1">
            {/* Favorites */}
            <button
              onClick={onOpenFav}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative group"
              title={settings.lang === "sc" ? "收藏" : "收藏"}
            >
              <Heart className="w-5 h-5 text-[var(--text-main)]" />
              {favCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#121212]" />
              )}
            </button>

            {/* About */}
            <button
              onClick={onOpenAbout}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors relative"
              title={settings.lang === "sc" ? "关于本站" : "關於本站"}
            >
              <Info className="w-5 h-5 text-[var(--text-main)]" />
              {/* Exclamation badge for new users */}
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 text-[8px] text-white justify-center items-center font-bold">!</span>
              </span>
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={settings.lang === "sc" ? "设置" : "設置"}
            >
              <Settings className="w-5 h-5 text-[var(--text-main)]" />
            </button>
          </div>
        </div>

        {/* Utility Bar (Search & Archive) - Passed as children */}
        {children}
      </div>
    </header>
  );
}