"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// 定义设置的数据结构
type Settings = {
  theme: "light" | "dark" | "system";
  lang: "sc" | "tc";
  fontStyle: "serif" | "sans";
  fontSize: number;
};

// 默认兜底设置 (万一探测失败用这个)
const defaultSettings: Settings = {
  theme: "dark",
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

  // 1. 初始化 & 自动探测逻辑 (核心修改)
  useEffect(() => {
    const saved = localStorage.getItem("site-settings-v2");

    // A. 如果是老用户 (有缓存)，使用缓存设置
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 兼容旧数据：如果 fontSize 是字符串，重置为 16
        if (typeof parsed.fontSize === 'string') {
          parsed.fontSize = 16;
        }
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    // B. 如果是新用户 (无缓存)，执行自动探测
    else {
      // --- 1. 探测语言 (简繁体) ---
      const navLang = navigator.language.toLowerCase();
      // 只要包含 tw, hk, mo 就认为是繁体用户
      const isTrad = ['tw', 'hk', 'mo'].some(code => navLang.includes(code));
      const detectedLang = isTrad ? 'tc' : 'sc';

      // --- 2. 探测设备 (字号适配) ---
      const isMobile = window.innerWidth < 768;
      // 手机端字号稍微给大一点点(17)，电脑端更宽松(18)
      const detectedFontSize = isMobile ? 17 : 18;

      // --- 3. 应用探测结果 ---
      setSettings({
        ...defaultSettings,
        theme: "dark", // 默认使用深色模式
        lang: detectedLang,
        fontSize: detectedFontSize,
        fontStyle: "serif", // 默认保持宋体
      });
    }

    setMounted(true);
  }, []);

  // 2. 监听设置变化，应用样式 (这部分保持不变，因为逻辑很完善)
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const body = document.body;

    // --- 处理明暗模式 ---
    root.classList.remove("light", "dark");
    let effectiveTheme = settings.theme;

    // 如果是 system，实时检查系统的深色设置
    if (settings.theme === "system") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    root.classList.add(effectiveTheme);

    // --- 处理字体 (通过 CSS 属性控制) ---
    body.setAttribute("data-font-style", settings.fontStyle);

    // --- 处理语言 (HTML lang 属性 + data属性) ---
    root.setAttribute("lang", settings.lang === 'sc' ? 'zh-CN' : 'zh-TW');
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
    // 避免水合不匹配，加载前渲染空或者 loading，或者直接渲染 children
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ settings, updateSettings }}>
      {/* 
        Key Trick: 当语言改变时，强制 React 重新渲染下级组件 
        这能确保所有简繁体文本立即更新，不会有残留
      */}
      <div key={settings.lang}>
        {children}
      </div>
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