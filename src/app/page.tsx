"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import LiveView from "@/components/LiveView";
import { Search, Loader2, X, Flame } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { CATEGORY_MAP, CATEGORIES } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { settings } = useTheme();
  const [mounted, setMounted] = useState(false);

  // --- State ---
  const [rawNewsData, setRawNewsData] = useState<NewsItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState("");
  const [favorites, setFavorites] = useState<NewsItem[]>([]);
  const [archiveData, setArchiveData] = useState<Record<string, NewsItem[]>>({});
  const [archiveIndex, setArchiveIndex] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'live' | 'coming'>('news');

  // Live View Persistence State
  const [isLiveMounted, setIsLiveMounted] = useState(false);
  const liveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // UI State
  const [currentFilter, setCurrentFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);

  // --- Smart Search Suggestions Logic ---
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // SECTION 1: Manual Trending Keywords
  const trendingNow = ["高市", "滨崎步", "台湾"];
  const TC_MAP: Record<string, string> = {
    "高市": "高市",
    "滨崎步": "濱崎步",
    "台湾": "台灣"
  };

  // SECTION 2: Hot Keywords (Auto-extracted)
  const hotKeywords = useMemo(() => {
    if (!rawNewsData || rawNewsData.length === 0) return [];

    const STOP_WORDS = new Set([
      "的", "了", "是", "在", "和", "有", "我", "这", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "怎么", "还是", "或者", "因为", "所以", "如果", "那个", "这个",
      "可以", "已经", "通过", "进行", "表示", "认为", "指出", "提到", "称", "显示", "发现", "介绍", "宣布", "透露", "强调",
      "日本", "中国", "消息", "报道", "新闻", "日媒", "韩媒", "发布", "推出"
    ]);

    const SOURCE_BLACKLIST = new Set([
      "日本经济新闻", "日经", "产经新闻", "日刊体育", "共同社", "路透", "路透中文网", "路透社", "朝日电视台", "朝日新闻", "每日新闻", "东洋经济", "钻石在线", "中央日报", "时事网", "时事通讯社",
      "Yahoo", "Yahoo!ニュース", "TBS", "Bloomberg", "BBC", "CNN", "NHK", "ニュース", "ライブドア", "Livedoor", "在线", "中文版", "数字版"
    ]);

    const wordCounts: Record<string, number> = {};
    const hasSegmenter = typeof Intl !== 'undefined' && (Intl as any).Segmenter;

    if (hasSegmenter) {
      const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' });
      rawNewsData.forEach(item => {
        if (!item.title) return;
        const cleanTitle = item.title.trim();
        const segments = segmenter.segment(cleanTitle);
        for (const { segment, isWordLike } of segments) {
          if (!isWordLike) continue;
          const word = segment.trim();
          if (
            word.length < 2 ||
            STOP_WORDS.has(word) ||
            SOURCE_BLACKLIST.has(word) ||
            /^\d+$/.test(word) ||
            /^\d+月$/.test(word) ||
            /^\d{4}$/.test(word) ||
            /^[a-zA-Z]+$/.test(word)
          ) {
            continue;
          }
          const weight = word.length >= 3 ? 1.5 : 1;
          wordCounts[word] = (wordCounts[word] || 0) + weight;
        }
      });
    }

    return Object.entries(wordCounts)
      .sort(([wordA, a], [wordB, b]) => {
        if (b !== a) return b - a;
        return wordB.length - wordA.length;
      })
      .slice(0, 15)
      .map(([word]) => word);
  }, [rawNewsData]);

  // SECTION 3: Hot Sources
  const hotSources = useMemo(() => {
    if (!rawNewsData || rawNewsData.length === 0) return [];
    const SOURCE_NAMES = new Set([
      "雅虎新闻", "雅虎", "共同社", "路透社", "路透", "产经新闻", "日本经济新闻", "日经新闻", "朝日新闻", "每日新闻",
      "读卖新闻", "时事通信", "时事通讯社", "日刊体育", "东洋经济", "钻石在线", "中央日报", "朝日电视台",
      "NHK", "TBS", "东京新闻", "富士电视台", "产经体育", "体育日报"
    ]);
    const sourceCounts: Record<string, number> = {};
    rawNewsData.forEach(item => {
      if (!item.title) return;
      const cleanTitle = item.title.trim();
      SOURCE_NAMES.forEach(sourceName => {
        if (cleanTitle.includes(sourceName)) {
          sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
        }
      });
    });
    return Object.entries(sourceCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([source]) => source);
  }, [rawNewsData]);

  const handleSuggestionClick = (keyword: string) => {
    handleSearchInput(keyword);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFav, setShowFav] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveDate, setArchiveDate] = useState("");

  const [pullStartY, setPullStartY] = useState(0);
  const [pullStartX, setPullStartX] = useState(0);
  const [pullCurrentY, setPullCurrentY] = useState(0);
  const PULL_THRESHOLD = 80;
  // const SWIPE_THRESHOLD = 50; // Removed swipe threshold

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      // Fetch latest news
      const r = await fetch("/data.json?t=" + Date.now());
      const data = await r.json();
      if (data && data.news) {
        setRawNewsData(data.news);
        setLastUpdated(data.last_updated || "");
      } else if (Array.isArray(data)) {
        setRawNewsData(data);
      }

      // Fetch archive index
      try {
        const rIndex = await fetch("/archive/index.json?t=" + Date.now());
        if (rIndex.ok) {
          const indexData = await rIndex.json();
          setArchiveIndex(indexData);
        }
      } catch (e) {
        console.error("Failed to fetch archive index", e);
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

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount((prev) => (prev < 100 ? prev + 25 : prev));
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Live View Keep Alive Logic
  useEffect(() => {
    if (activeTab === 'live') {
      setIsLiveMounted(true);
      if (liveTimeoutRef.current) {
        clearTimeout(liveTimeoutRef.current);
        liveTimeoutRef.current = null;
      }
    } else {
      // If switching away from live, set a timeout to unmount it
      if (isLiveMounted && !liveTimeoutRef.current) {
        liveTimeoutRef.current = setTimeout(() => {
          setIsLiveMounted(false);
          liveTimeoutRef.current = null;
        }, 5 * 60 * 1000); // 5 minutes
      }
    }
    return () => {
      // Cleanup on unmount (though this component likely won't unmount)
    };
  }, [activeTab, isLiveMounted]);


  const handleTouchStart = (e: React.TouchEvent) => {
    setPullStartX(e.touches[0].clientX);
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Pull to refresh logic
    if (pullStartY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      if (currentY > pullStartY) {
        setPullCurrentY(currentY - pullStartY);
      }
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    // Removed Swipe Logic

    // Pull to Refresh Logic
    if (pullCurrentY > PULL_THRESHOLD) {
      setIsRefreshing(true);
      await fetchData(false);
      setIsRefreshing(false);
    }
    setPullStartY(0);
    setPullStartX(0);
    setPullCurrentY(0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false);
    setIsRefreshing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(val.trim());
      setVisibleCount(25);
    }, 500);
  }, []);

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setVisibleCount(25);
  };

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
    return archiveData[archiveDate] || [];
  }, [archiveData, archiveDate]);

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

  const handleShowArchive = async (dateStr: string) => {
    setArchiveDate(dateStr);
    setShowArchive(true);
    setShowArchiveDrawer(false);

    if (!archiveData[dateStr]) {
      try {
        const r = await fetch(`/archive/${dateStr}.json`);
        if (r.ok) {
          const items = await r.json();
          setArchiveData(prev => ({
            ...prev,
            [dateStr]: items
          }));
        }
      } catch (e) {
        console.error(`Failed to load archive for ${dateStr}`, e);
      }
    }
  };

  const handleFilterChange = (cat: string) => {
    setCurrentFilter(cat);
    setVisibleCount(25);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="min-h-screen bg-[var(--background)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Refresh Indicator */}
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

      <Header
        onOpenFav={() => setShowFav(true)}
        onOpenAbout={() => setShowAbout(true)}
        onOpenSettings={() => setShowSettings(true)}
        onRefresh={handleRefresh}
        favCount={favorites.length}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* --- Backdrop --- */}
      <div
        className={`
          fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] transition-all duration-500
          ${showArchiveDrawer
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
          }
        `}
        onClick={() => setShowArchiveDrawer(false)}
      />

      <main className="max-w-[600px] mx-auto pb-10 relative">
        <AnimatePresence mode="wait">
          {activeTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* CategoryNav - 吸顶 */}
              <CategoryNav currentFilter={currentFilter} onFilterChange={handleFilterChange} />

              {/* Search & Archive Bar - 固定高度和间距 */}
              <div className="px-4 pb-3 relative z-45">
                <div className="flex justify-between items-center gap-3 h-12">
                  <div
                    ref={searchContainerRef}
                    className="flex-1 relative h-full min-w-0"
                  >
                    <div className="flex items-center gap-2 h-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-xl px-4 shadow-md dark:shadow-none transition-all focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:border-transparent">
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={searchInput}
                        placeholder={settings.lang === "sc" ? "搜索..." : "搜尋..."}
                        className="flex-1 bg-transparent border-none focus:ring-0 placeholder-gray-400 text-gray-700 dark:text-gray-200 text-sm p-0 outline-none min-w-0"
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => setShowSuggestions(true)}
                      />
                      {searchInput && (
                        <button
                          onClick={handleClearSearch}
                          title="Clear search"
                          className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 hover:scale-110 active:scale-95 transition-all flex-shrink-0"
                        >
                          <X className="w-3 h-3 text-gray-500 dark:text-gray-300" strokeWidth={3} />
                        </button>
                      )}
                    </div>

                    {showSuggestions && (trendingNow.length > 0 || hotKeywords.length > 0 || hotSources.length > 0) && !searchInput && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-100 dark:border-white/5 p-3 animate-in slide-in-from-top-2 fade-in duration-200 z-50 max-w-xl">
                        {trendingNow.length > 0 && (
                          <div className="mb-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
                              {settings.lang === "sc" ? "当下最热" : "當下最熱"}
                              <Flame className="w-3 h-3 text-red-500 fill-red-500" />
                            </div>
                            <div className="leading-relaxed text-sm">
                              {trendingNow.map((keyword, index) => (
                                <span key={keyword}>
                                  <button
                                    onClick={() => handleSuggestionClick(keyword)}
                                    className="text-gray-800 dark:text-gray-200 text-[13px] underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 hover:text-red-500 hover:decoration-red-500 dark:hover:text-red-400 dark:hover:decoration-red-400 transition-colors font-medium"
                                  >
                                    {settings.lang === "sc" ? keyword : (TC_MAP[keyword] || keyword)}
                                  </button>
                                  {index < trendingNow.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-2">·</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {trendingNow.length > 0 && hotKeywords.length > 0 && (
                          <div className="mb-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">
                              {settings.lang === "sc" ? "热门话题" : "熱門話題"}
                            </div>
                            <div className="leading-relaxed">
                              {hotKeywords.map((keyword, index) => (
                                <span key={keyword}>
                                  <button
                                    onClick={() => handleSuggestionClick(keyword)}
                                    className="text-gray-700 dark:text-gray-300 text-[12px] underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 hover:text-red-500 hover:decoration-red-500 dark:hover:text-red-400 dark:hover:decoration-red-400 transition-colors"
                                  >
                                    {keyword}
                                  </button>
                                  {index < hotKeywords.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-1.5">·</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {hotKeywords.length > 0 && hotSources.length > 0 && (
                          <div className="border-t border-gray-200 dark:border-gray-700 my-2.5"></div>
                        )}

                        {hotSources.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">
                              {settings.lang === "sc" ? "热门来源" : "熱門來源"}
                            </div>
                            <div className="leading-relaxed">
                              {hotSources.map((source, index) => (
                                <span key={source}>
                                  <button
                                    onClick={() => handleSuggestionClick(source)}
                                    className="text-gray-600 dark:text-gray-400 text-[11px] underline decoration-gray-300 dark:decoration-gray-600 underline-offset-2 hover:text-red-500 hover:decoration-red-500 dark:hover:text-red-400 dark:hover:decoration-red-400 transition-colors"
                                  >
                                    {source}
                                  </button>
                                  {index < hotSources.length - 1 && <span className="text-gray-300 dark:text-gray-600 mx-1.5">·</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowArchiveDrawer(!showArchiveDrawer)}
                    className="h-full px-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] text-sm font-medium text-[var(--text-main)] hover:border-[var(--primary)] hover:text-[var(--primary)] shadow-md dark:shadow-none transition-all whitespace-nowrap flex items-center gap-2 flex-shrink-0"
                  >
                    {settings.lang === "sc" ? "历史归档" : "歷史歸檔"}
                  </button>
                </div>

                {/* Archive Drawer Overlay */}
                <AnimatePresence>
                  {showArchiveDrawer && (
                    <div className="absolute top-full left-0 w-full z-50 px-4 mt-2">
                      <ArchiveDrawer
                        archiveData={archiveData}
                        archiveIndex={archiveIndex}
                        onSelectDate={handleShowArchive}
                        isOpen={showArchiveDrawer}
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <NewsList
                news={displayItems}
                isLoading={isLoading}
                onToggleFav={handleToggleFav}
                favorites={favorites}
                onShowArchive={handleShowArchive}
                onFilterCategory={handleFilterChange}
                archiveData={archiveData}
              />

              {!isLoading && searchQuery && filteredItems.length === 0 && (
                <div className="px-4 py-16 text-center">
                  <p className="text-base text-gray-500 dark:text-gray-400">
                    {settings.lang === "sc" ? "本次没搜到结果，换个关键词试试吧。" : "本次沒搜到結果，換個關鍵詞試試吧。"}
                  </p>
                </div>
              )}

              {!isLoading && visibleCount < filteredItems.length && (
                <div className="text-center py-8 text-[var(--text-sub)] text-sm">
                  Loading...
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live View - Keep Alive Logic */}
        <div style={{ display: activeTab === 'live' ? 'block' : 'none' }}>
          {isLiveMounted && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <LiveView />
            </motion.div>
          )}
        </div>
      </main>

      <BackToTop />

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

      {/* 隐形遮罩层:用于点击空白处关闭弹窗 */}
      {showSuggestions && (trendingNow.length > 0 || hotKeywords.length > 0 || hotSources.length > 0) && !searchInput && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
}