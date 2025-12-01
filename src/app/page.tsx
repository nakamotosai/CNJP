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
import ArchiveDrawer from "@/components/ArchiveDrawer";
import BackToTop from "@/components/BackToTop";
import { Search, Loader2 } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { CATEGORY_MAP, CATEGORIES } from "@/lib/constants";

export default function Home() {
  const { settings } = useTheme();
  const [mounted, setMounted] = useState(false);

  // --- State ---
  const [rawNewsData, setRawNewsData] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [favorites, setFavorites] = useState<NewsItem[]>([]);
  const [archiveData, setArchiveData] = useState<Record<string, NewsItem[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // UI State
  const [currentFilter, setCurrentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFav, setShowFav] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveDate, setArchiveDate] = useState("");

  // Pull to Refresh State
  const [pullStartY, setPullStartY] = useState(0);
  const [pullCurrentY, setPullCurrentY] = useState(0);
  const PULL_THRESHOLD = 80;

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

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const r = await fetch("/data.json?t=" + Date.now());
      const data = await r.json();
      if (data && data.news) {
        setRawNewsData(data.news);
        setLastUpdated(data.last_updated || "");
      } else if (Array.isArray(data)) {
        setRawNewsData(data);
      }
    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount((prev) => (prev < 100 ? prev + 25 : prev));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // --- Pull to Refresh Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      if (currentY > pullStartY) {
        setPullCurrentY(currentY - pullStartY);
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullCurrentY > PULL_THRESHOLD) {
      setIsRefreshing(true);
      await fetchData(false); // Refresh data without full screen loading
      setIsRefreshing(false);
    }
    setPullStartY(0);
    setPullCurrentY(0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false);
    setIsRefreshing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    setShowArchiveDrawer(false);
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
    <div
      className="min-h-screen bg-[var(--background)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to Refresh Indicator */}
      <div
        className="fixed top-0 left-0 w-full flex justify-center items-center pointer-events-none z-[60] transition-all duration-200"
        style={{
          height: pullCurrentY > 0 ? Math.min(pullCurrentY, 100) : 0,
          opacity: pullCurrentY > 0 ? Math.min(pullCurrentY / PULL_THRESHOLD, 1) : 0
        }}
      >
        <div className="bg-white dark:bg-[#2c2c2c] rounded-full p-2 shadow-md mt-4">
          <Loader2 className={`w-5 h-5 text-[var(--primary)] ${pullCurrentY > PULL_THRESHOLD || isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* 
          1. Header + Utility Bar (Static Flow)
          Zone A + B
      */}
      <Header
        onOpenFav={() => setShowFav(true)}
        onOpenAbout={() => setShowAbout(true)}
        onOpenSettings={() => setShowSettings(true)}
        onRefresh={handleRefresh}
        favCount={favorites.length}
      >
        {/* Utility Bar (Search & Archive) */}
        <div className="flex justify-between items-center gap-3">
          {/* Search Input - Left/Center */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none z-10" />
            <input
              type="text"
              placeholder={settings.lang === "sc" ? "搜索..." : "搜尋..."}
              className="w-full py-1.5 pl-6 pr-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#2c2c2c] text-[13px] outline-none text-[var(--text-main)] transition-all focus:bg-white focus:shadow-md focus:border-[var(--primary)]"
              onInput={(e) => handleSearch(e.currentTarget.value)}
            />
          </div>

          {/* Archive Button - Right */}
          <button
            type="button"
            onClick={() => setShowArchiveDrawer(!showArchiveDrawer)}
            style={fontStyle}
            className="py-1.5 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#2c2c2c] text-[12px] text-[var(--text-main)] hover:border-[var(--primary)] hover:shadow-md transition-all whitespace-nowrap"
          >
            {settings.lang === "sc" ? "历史归档" : "歷史歸檔"}
          </button>
        </div>
      </Header>

      {/* Archive Drawer - Animated Wrapper */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-[#121212] border-b border-gray-100 dark:border-gray-800
          ${showArchiveDrawer ? "max-h-[200px] opacity-100 pb-2" : "max-h-0 opacity-0 border-none"}
        `}
      >
        <ArchiveDrawer
          archiveData={archiveData}
          onSelectDate={handleShowArchive}
        />
      </div>

      {/* 
          2. Content Module (Zone C + D)
          Contains CategoryNav (Sticky) and NewsList
      */}
      <main className="max-w-[600px] mx-auto pb-10">

        {/* CategoryNav (Zone C) */}
        <CategoryNav currentFilter={currentFilter} onFilterChange={handleFilterChange} />

        {/* News List (Zone D) */}
        <NewsList
          news={displayItems}
          isLoading={isLoading}
          onToggleFav={handleToggleFav}
          favorites={favorites}
          onShowArchive={handleShowArchive}
          onFilterCategory={handleFilterChange}
          archiveData={archiveData}
        />

        {/* Loading */}
        {!isLoading && visibleCount < filteredItems.length && (
          <div className="text-center py-8 text-[var(--text-sub)] text-sm">
            Loading...
          </div>
        )}
      </main>

      {/* Back To Top Button */}
      <BackToTop />

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