"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// 定义设置的数据结构
type Settings = {
  theme: "light" | "dark" | "system";
  lang: "sc" | "tc";
  fontStyle: "serif" | "sans";
  fontSize: number; // Changed from enum to number for continuous slider
};

// 默认设置：简体、宋体、16px
const defaultSettings: Settings = {
  theme: "system",
  lang: "sc",
  fontStyle: "serif",
  fontSize: 16,
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
    const saved = localStorage.getItem("site-settings-v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration: If fontSize was string (old version), reset to 16
        if (typeof parsed.fontSize === 'string') {
          parsed.fontSize = 16;
        }
        setSettings({ ...defaultSettings, ...parsed });
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

    // --- 处理字体 (通过 CSS 属性控制) ---
    body.setAttribute("data-font-style", settings.fontStyle);
    body.setAttribute("data-lang", settings.lang);

    // --- 处理字号 (无极调节) ---
    root.style.fontSize = `${settings.fontSize}px`;

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
    return {
      settings: defaultSettings,
      updateSettings: () => { },
    };
  }
  return context;
}