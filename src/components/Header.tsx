import { Settings, Info, Star } from "lucide-react";
import { useTheme } from "./ThemeContext";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenFav: () => void;
  favCount: number;
}

export default function Header({
  onOpenSettings,
  onOpenAbout,
  onOpenFav,
  favCount,
}: HeaderProps) {
  const { settings } = useTheme();

  const fontStyleObj = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  return (
    // 外层：w-full 背景通栏，flex justify-center 负责让内部容器水平居中
    <header className="w-full h-[60px] bg-white/95 dark:bg-[#121212]/95 backdrop-blur-sm border-b border-black/5 dark:border-white/5 flex justify-center z-50">
      
      {/* 内层：限制最大宽度 600px，确保与下方新闻卡片严格对齐 */}
      <div className="w-full max-w-[600px] px-4 flex items-center justify-between h-full">
        
        <div className="flex flex-col">
          <h1 
            style={fontStyleObj}
            className="text-2xl font-bold text-[var(--text-main)] tracking-tight leading-none drop-shadow-md"
          >
            {settings.lang === "sc" ? "从日本看中国" : "從日本看中國"}
          </h1>
          <span 
            style={fontStyleObj}
            className="text-[10px] text-[var(--text-sub)] tracking-wider uppercase mt-0.5 opacity-80 drop-shadow-sm"
          >
            China News From Japan
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenFav}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
            aria-label="Favorites"
          >
            <Star className="w-[1.2rem] h-[1.2rem] text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors" />
            {favCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex min-w-[14px] h-[14px] px-0.5 items-center justify-center rounded-full bg-[#ff3b30] text-[9px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#121212] leading-none z-10">
                {favCount > 99 ? "99+" : favCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenAbout}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
            aria-label="About"
          >
            <Info className="w-[1.2rem] h-[1.2rem] text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors" />
          </button>

          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
            aria-label="Settings"
          >
            <Settings className="w-[1.2rem] h-[1.2rem] text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors" />
          </button>
        </div>
      </div>
    </header>
  );
}