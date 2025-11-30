"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Header from "@/components/Header";
import CategoryNav from "@/components/CategoryNav";
import NewsList from "@/components/NewsList";
import { NewsItem } from "@/components/NewsCard";
import SettingsModal from "@/components/modals/SettingsModal";
import AboutModal from "@/components/modals/AboutModal";
import FavModal from "@/components/modals/FavModal";
import ArchiveModal from "@/components/modals/ArchiveModal";
import { Search } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { CATEGORY_MAP } from "@/lib/constants";

export default function Home() {
  const { settings } = useTheme();
  const [mounted, setMounted] = useState(false);

  // --- State ---
  const [rawNewsData, setRawNewsData] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [favorites, setFavorites] = useState<NewsItem[]>([]);
  const [archiveData, setArchiveData] = useState<Record<string, NewsItem[]>>({});

  // UI State
  const [currentFilter, setCurrentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFav, setShowFav] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveDate, setArchiveDate] = useState("");

  // --- Effects ---
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const savedFav = localStorage.getItem("favorites");
      if (savedFav) setFavorites(JSON.parse(savedFav));
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
  }, []);

  useEffect(() => {
    fetch("/data.json?t=" + Date.now())
      .then((r) => r.json())
      .then((data) => {
        if (data && data.news) {
          setRawNewsData(data.news);
          setLastUpdated(data.last_updated || "");
        } else if (Array.isArray(data)) {
          setRawNewsData(data);
        }
      })
      .catch((e) => console.error("Fetch error", e));
  }, []);

  useEffect(() => {
    const newData: Record<string, NewsItem[]> = {};
    rawNewsData.forEach((item) => {
      if (item.timestamp) {
        const d = new Date(item.timestamp * 1000);
        if (!isNaN(d.getTime())) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (!newData[dateStr]) newData[dateStr] = [];
          newData[dateStr].push(item);
        }
      }
    });
    setArchiveData(newData);
  }, [rawNewsData]);

  // --- Scroll Handler ---
  const lastScrollTop = useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollDelta = scrollTop - lastScrollTop.current;

      // 防抖阈值 5px
      if (Math.abs(scrollDelta) < 5) return;

      if (scrollDelta > 0 && scrollTop > 60) {
        setIsHeaderHidden(true);
      } else if (scrollDelta < 0) {
        setIsHeaderHidden(false);
      }
      
      lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop;

      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount((prev) => (prev < 100 ? prev + 25 : prev));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- Logic ---
  const filteredItems = useMemo(() => {
    let filtered = rawNewsData;
    if (currentFilter !== "all") {
      filtered = filtered.filter((item) => {
        const itemCategory = item.category || "其他";
        const itemCategoryKey = CATEGORY_MAP[itemCategory] || "other";
        return itemCategoryKey === currentFilter;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const origin = (item.origin || "").toLowerCase();
        return title.includes(q) || origin.includes(q);
      });
    }
    return filtered;
  }, [rawNewsData, currentFilter, searchQuery]);

  const displayItems = filteredItems.slice(0, visibleCount);

  const filteredArchiveItems = useMemo(() => {
    const items = archiveData[archiveDate] || [];
    if (currentFilter === "all") return items;
    return items.filter((item) => {
      const itemCategory = item.category || "其他";
      const itemCategoryKey = CATEGORY_MAP[itemCategory] || "other";
      return itemCategoryKey === currentFilter;
    });
  }, [archiveData, archiveDate, currentFilter]);

  const handleToggleFav = (e: React.MouseEvent, item: NewsItem) => {
    e.stopPropagation();
    const exists = favorites.some((f) => f.link === item.link);
    let newFavs;
    if (exists) {
      newFavs = favorites.filter((f) => f.link !== item.link);
    } else {
      newFavs = [item, ...favorites];
    }
    setFavorites(newFavs);
    localStorage.setItem("favorites", JSON.stringify(newFavs));
  };

  const handleRemoveFav = (item: NewsItem) => {
    const newFavs = favorites.filter((f) => f.link !== item.link);
    setFavorites(newFavs);
    localStorage.setItem("favorites", JSON.stringify(newFavs));
  };

  const handleClearFav = () => {
    if (confirm("确定要清空所有收藏吗？")) {
      setFavorites([]);
      localStorage.setItem("favorites", "[]");
    }
  };

  const handleShowArchive = (dateStr: string) => {
    setArchiveDate(dateStr);
    setShowArchive(true);
  };

  const handleFilterChange = (cat: string) => {
    setCurrentFilter(cat);
    setVisibleCount(25);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = (val: string) => {
    setSearchQuery(val.trim());
    setVisibleCount(25);
  };

  const fontStyle = {
    fontFamily: settings.fontStyle === "serif"
      ? "var(--font-noto-serif-tc), var(--font-noto-serif-sc), serif"
      : "var(--font-noto-sans-tc), var(--font-noto-sans-sc), sans-serif",
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* 
          1. Header (Fixed, w-full, z-50)
             隐藏时向上移动 100% (-60px)
      */}
      <div 
        className="fixed top-0 left-0 w-full z-50 transition-transform duration-300 ease-out"
        style={{ transform: isHeaderHidden ? "translateY(-100%)" : "translateY(0)" }}
      >
        <Header
          onOpenFav={() => setShowFav(true)}
          onOpenAbout={() => setShowAbout(true)}
          onOpenSettings={() => setShowSettings(true)}
          favCount={favorites.length}
        />
      </div>

      {/* 
          2. CategoryNav (Fixed, w-full, z-40)
             初始位置 top-[60px] (header下方)。
             当 Header 隐藏时，Header 移走了，Nav 需要上移到 top-0。
             移动距离 = -60px。
      */}
      <div
        className="fixed top-[60px] left-0 w-full z-40 transition-transform duration-300 ease-out"
        style={{ transform: isHeaderHidden ? "translateY(-60px)" : "translateY(0)" }}
      >
        <CategoryNav currentFilter={currentFilter} onFilterChange={handleFilterChange} />
      </div>

      {/* 
          3. Main Content
             pt-[110px]: 预留头部空间 (60px Header + ~50px Nav)
             max-w-[600px] mx-auto: 内容居中
      */}
      <main className="pt-[110px] pb-10 max-w-[600px] mx-auto relative">
        
        {/* Control Bar (Search & Info) */}
        <div className="px-4 pb-2 pt-1 flex justify-between items-end">
          <div className="flex flex-col justify-end max-w-[60%]">
            <div 
              style={fontStyle}
              className="text-[13px] font-bold text-[var(--text-main)] mb-0.5 leading-[1.2]"
            >
              {searchQuery
                ? `"${searchQuery}"`
                : currentFilter !== "all"
                  ? CATEGORY_MAP[currentFilter] || currentFilter
                  : settings.lang === "sc"
                    ? "100条日媒最新发布的中国新闻"
                    : "100條日媒最新發布的中國新聞"}
            </div>
            <div style={fontStyle} className="text-[10px] text-[var(--text-sub)] font-normal">
              {lastUpdated && (settings.lang === "sc" ? "数据更新于：" : "數據更新於：") + lastUpdated}
            </div>
          </div>
          <div className="relative w-[110px] group">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none z-10" />
            <input
              type="text"
              placeholder={settings.lang === "sc" ? "搜索..." : "搜尋..."}
              className="w-full py-1.5 pl-6 pr-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#2c2c2c] text-[11px] outline-none text-[var(--text-main)] transition-all focus:w-[140px] focus:absolute focus:right-0 focus:shadow-md focus:border-[var(--primary)]"
              onInput={(e) => handleSearch(e.currentTarget.value)}
            />
          </div>
        </div>

        {/* News List */}
        <NewsList
          news={displayItems}
          onToggleFav={handleToggleFav}
          favorites={favorites}
          onShowArchive={handleShowArchive}
          onFilterCategory={handleFilterChange}
          archiveData={archiveData}
        />

        {/* Loading */}
        {visibleCount < filteredItems.length && (
          <div className="text-center py-8 text-[var(--text-sub)] text-sm">
            Loading...
          </div>
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onClearFavorites={handleClearFav}
      />
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      <FavModal
        isOpen={showFav}
        onClose={() => setShowFav(false)}
        favorites={favorites}
        onRemoveFav={handleRemoveFav}
        onClearFavorites={handleClearFav}
      />
      <ArchiveModal
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
        dateStr={archiveDate}
        items={filteredArchiveItems}
        favorites={favorites}
        onToggleFav={handleToggleFav}
        currentFilter={currentFilter}
      />
    </div>
  );
}