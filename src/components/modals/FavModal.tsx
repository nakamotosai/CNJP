"use client";

import { X, Trash2, ExternalLink } from "lucide-react";
import { NewsItem } from "../NewsCard";
import { useTheme } from "../ThemeContext";

interface FavModalProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: NewsItem[];
  onRemoveFav: (item: NewsItem) => void;
  onClearFavorites: () => void;
}

export default function FavModal({
  isOpen,
  onClose,
  favorites,
  onRemoveFav,
  onClearFavorites,
}: FavModalProps) {
  const { settings } = useTheme();

  // 修正：settings.fontStyle
  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
          <h2 style={fontStyleObj} className="text-lg font-bold text-[var(--text-main)]">
            {settings.lang === "sc" ? "我的收藏" : "我的收藏"}
            <span className="ml-2 text-sm font-normal text-[var(--text-sub)]">
              ({favorites.length})
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-sub)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-sub)] opacity-60">
              <Trash2 className="w-8 h-8 mb-2" />
              <p style={fontStyleObj} className="text-sm">
                {settings.lang === "sc" ? "暂无收藏内容" : "暫無收藏內容"}
              </p>
            </div>
          ) : (
            favorites.map((item, idx) => (
              <div
                key={`${item.link}-${idx}`}
                style={fontStyleObj}
                className="group relative flex flex-col gap-2 p-3 rounded-xl bg-[var(--background)] border border-black/5 dark:border-white/5 hover:border-[var(--primary)] transition-colors"
              >
                <div className="text-sm font-bold text-[var(--text-main)] leading-snug pr-6 cursor-text">
                  {item.title}
                </div>
                
                <div className="flex items-center justify-between text-xs text-[var(--text-sub)] mt-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-[var(--primary)] underline decoration-2 underline-offset-2 flex items-center gap-1"
                    >
                      {item.origin || "Unknown"}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                    <span className="opacity-70">{item.time_str}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onRemoveFav(item);
                    }}
                    className="text-red-500 hover:text-red-600 font-medium px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {settings.lang === "sc" ? "删除" : "刪除"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {favorites.length > 0 && (
          <div className="p-4 border-t border-black/5 dark:border-white/5 bg-[var(--background)]">
            <button
              onClick={onClearFavorites}
              style={fontStyleObj}
              className="w-full py-2.5 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {settings.lang === "sc" ? "清空所有收藏" : "清空所有收藏"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}