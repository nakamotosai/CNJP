"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// 定义设置的数据结构
type Settings = {
  theme: "light" | "dark" | "system"; // 稍微扩展一下支持跟随系统，兼容性更好
  lang: "sc" | "tc";             // 简繁
  fontStyle: "serif" | "sans";   // 字体样式 (保持你原本的命名 fontStyle)
  fontSize: "sm" | "base" | "lg";// 字号
};

// 默认设置：简体、宋体
const defaultSettings: Settings = {
  theme: "system", // 默认跟随系统，或者你可以改成 'light'
  lang: "sc",      // 默认简体
  fontStyle: "serif", // 默认宋体
  fontSize: "base",
};

// 创建 Context
const ThemeContext = createContext<{
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // 1. 初始化
  useEffect(() => {
    // 关键修改：我修改了 key 为 'site-settings-v2'
    // 这会强制忽略你浏览器里旧的 'site-settings' 缓存，
    // 从而让你立刻应用 defaultSettings (简体+宋体)。
    const saved = localStorage.getItem("site-settings-v2");
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    setMounted(true);
  }, []);

  // 2. 监听设置变化，应用样式
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const body = document.body;

    // --- 处理明暗模式 ---
    root.classList.remove("light", "dark");
    let effectiveTheme = settings.theme;
    if (settings.theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    root.classList.add(effectiveTheme);

    // --- 处理字体 (关键修复：双重字体栈) ---
    // 以前的代码只加载单一种类字体，导致繁体模式下缺字回退到黑体。
    // 现在我们同时声明两种字体变量，缺字时会自动互补。
    let fontFamily = "";
    if (settings.fontStyle === "serif") {
      // 宋体模式：根据当前语言优先显示对应的字形，但备选另一种，防止回退到系统黑体
      if (settings.lang === "sc") {
        fontFamily = "var(--font-noto-serif-sc), var(--font-noto-serif-tc), serif";
      } else {
        fontFamily = "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif";
      }
    } else {
      // 黑体模式
      if (settings.lang === "sc") {
        fontFamily = "var(--font-noto-sans-sc), var(--font-noto-sans-tc), sans-serif";
      } else {
        fontFamily = "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif";
      }
    }
    body.style.fontFamily = fontFamily;

    // --- 处理字号 ---
    const sizeMap = {
      sm: "14px",
      base: "16px",
      lg: "19px"
    };
    root.style.fontSize = sizeMap[settings.fontSize];

    // --- 保存到本地存储 ---
    localStorage.setItem("site-settings-v2", JSON.stringify(settings));

  }, [settings, mounted]);

  // 更新函数
  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ settings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 导出 Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    // 避免 SSR 报错，返回默认值
    return {
      settings: defaultSettings,
      updateSettings: () => { },
    };
  }
  return context;
}