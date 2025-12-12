"use client";

import { X, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "../ThemeContext";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearFavorites: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onClearFavorites,
}: SettingsModalProps) {
  const { settings, updateSettings } = useTheme();

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="custom-scrollbar relative w-full max-w-sm bg-white dark:bg-[#1e1e1e] modal-content rounded-3xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 style={fontStyleObj} className="text-xl font-bold text-[var(--text-main)]">
            {settings.lang === "sc" ? "设置" : "設置"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
            <X className="w-6 h-6 text-[var(--text-sub)]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {/* 1. Appearance (Full Width) */}
          <div className="col-span-2 space-y-3">
            <label style={fontStyleObj} className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">
              {settings.lang === "sc" ? "外观" : "外觀"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "light", icon: Sun, label: settings.lang === "sc" ? "浅色" : "淺色" },
                { id: "dark", icon: Moon, label: settings.lang === "sc" ? "深色" : "深色" },
                { id: "system", icon: Monitor, label: settings.lang === "sc" ? "系统" : "系統" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateSettings({ theme: opt.id as any })}
                  style={fontStyleObj}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border transition-all ${settings.theme === opt.id
                    ? "settings-modal-active"
                    : "bg-gray-50 dark:bg-white/[0.05] text-[var(--text-sub)] border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                    }`}
                >
                  <opt.icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Default Startup Tab */}
          <div className="col-span-2 space-y-3">
            <label style={fontStyleObj} className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">
              {settings.lang === "sc" ? "默认启动页" : "默認啟動頁"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "news", label: settings.lang === "sc" ? "新闻" : "新聞" },
                { id: "live", label: settings.lang === "sc" ? "直播" : "直播" },
                { id: "disaster", label: settings.lang === "sc" ? "灾害" : "災害" },
              ].map((tab) => {
                // Logic to check if this is the current default
                const isDefault = (typeof window !== 'undefined' ? localStorage.getItem("default_tab") : "news") === tab.id || (!localStorage.getItem("default_tab") && tab.id === "news");

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      localStorage.setItem("default_tab", tab.id);
                      // Force re-render to update UI state is tricky here without local state, 
                      // but we can just use a forceUpdate or rely on user closing modal.
                      // For better UX, let's use a simple state in this component if needed, 
                      // but for now let's just re-render by calling updateSettings with same params to trigger context update or just let it be.
                      // Actually, better to just update a local state to show selection immediately.
                      updateSettings({ ...settings }); // Dummy update to trigger re-render
                    }}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${(typeof window !== 'undefined' && (localStorage.getItem("default_tab") || "news") === tab.id)
                      ? "settings-modal-active"
                      : "bg-gray-50 dark:bg-white/[0.05] text-[var(--text-sub)] border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                      }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Font Style (Full Width - horizontal) */}
          <div className="col-span-2 space-y-3">
            <label style={fontStyleObj} className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">
              {settings.lang === "sc" ? "字体" : "字體"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateSettings({ fontStyle: "serif" })}
                className={`py-2 rounded-xl border transition-all text-xs font-bold ${settings.fontStyle === "serif"
                  ? "settings-modal-active"
                  : "bg-gray-50 dark:bg-white/[0.05] text-[var(--text-sub)] border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                  }`}
              >
                <span className="font-serif">宋体</span>
              </button>
              <button
                onClick={() => updateSettings({ fontStyle: "sans" })}
                className={`py-2 rounded-xl border transition-all text-xs font-bold ${settings.fontStyle === "sans"
                  ? "settings-modal-active"
                  : "bg-gray-50 dark:bg-white/[0.05] text-[var(--text-sub)] border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10"
                  }`}
              >
                <span className="font-sans">黑体</span>
              </button>
            </div>
          </div>

          {/* 5. Font Size (Full Width) */}
          <div className="col-span-2 space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <label style={fontStyleObj} className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-wider">
                {settings.lang === "sc" ? "字号大小" : "字號大小"}
              </label>
              <span className="text-[10px] font-bold text-[var(--text-main)] bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded">
                {settings.fontSize}px
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-sub)]">A</span>
              <input
                type="range"
                min="11"
                max="19"
                step="1"
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                className="settings-slider flex-1 h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg cursor-pointer"
              />
              <span className="text-lg text-[var(--text-main)]">A</span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="col-span-2 pt-4 border-t border-gray-100 dark:border-white/10">
            <p
              style={fontStyleObj}
              className="text-[10px] text-center text-gray-400 leading-relaxed"
            >
              {settings.lang === "sc"
                ? "本网站仅用于新闻聚合展示，所有内容均来源于公开渠道。"
                : "本網站僅用於新聞聚合展示，所有內容均來源於公開渠道。"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}