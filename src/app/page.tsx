"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Header from "@/components/Header";
import BulletinBoard from "@/components/BulletinBoard";
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
import DisasterSection from "@/components/disaster/DisasterSection";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { Search, Loader2, X, Flame, Calendar, ArrowUpDown } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { CATEGORY_MAP } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { DailyBriefingData } from "@/components/DailyBriefingCard";

// R2 公开访问 URL - 使用自定义域名以便中国用户访问
// R2 公开访问 URL - 本地开发时走代理绕过 CORS
const R2_PUBLIC_URL = process.env.NODE_ENV === "development"
  ? "/r2-proxy"
  : "https://r2.cn.saaaai.com";

export default function Home() {
  const { settings } = useTheme();


  // --- State ---
  const [rawNewsData, setRawNewsData] = useState<NewsItem[]>([]);
  const [allNewsData, setAllNewsData] = useState<NewsItem[]>([]); // 所有历史数据（合并去重后）
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false); // 是否已加载完全部历史
  const [lastUpdated, setLastUpdated] = useState("");
  const [favorites, setFavorites] = useState<NewsItem[]>([]);
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefingData | null>(null);

  // 归档相关
  const [archiveData, setArchiveData] = useState<Record<string, NewsItem[]>>({});
  const [archiveIndex, setArchiveIndex] = useState<Record<string, number>>({});

  // UI 状态
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'news' | 'live' | 'disaster'>('news');
  const [mountNews, setMountNews] = useState(true);
  const [mountLive, setMountLive] = useState(false);
  const [mountDisaster, setMountDisaster] = useState(false);
  const [isSearchingAll, setIsSearchingAll] = useState(false);
  const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());

  // Tab 偏好
  useEffect(() => {
    const defaultTab = localStorage.getItem("default_tab") as 'news' | 'live' | 'disaster' | null;
    if (defaultTab && ['news', 'live', 'disaster'].includes(defaultTab)) {
      setActiveTab(defaultTab);
      if (defaultTab === 'live') setMountLive(true);
      if (defaultTab === 'disaster') setMountDisaster(true);
    }
  }, []);

  // Retention Strategy: Keep tabs in background for 5 minutes
  const newsUnmountRef = useRef<NodeJS.Timeout | null>(null);
  const liveUnmountRef = useRef<NodeJS.Timeout | null>(null);
  const disasterUnmountRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const RETENTION_TIME = 5 * 60 * 1000; // 5 minutes

    // News
    if (activeTab === 'news') {
      setMountNews(true);
      if (newsUnmountRef.current) {
        clearTimeout(newsUnmountRef.current);
        newsUnmountRef.current = null;
      }
    } else {
      if (!newsUnmountRef.current) {
        newsUnmountRef.current = setTimeout(() => {
          setMountNews(false);
          newsUnmountRef.current = null;
        }, RETENTION_TIME);
      }
    }

    // Live
    if (activeTab === 'live') {
      setMountLive(true);
      if (liveUnmountRef.current) {
        clearTimeout(liveUnmountRef.current);
        liveUnmountRef.current = null;
      }
    } else {
      if (!liveUnmountRef.current) {
        liveUnmountRef.current = setTimeout(() => {
          setMountLive(false);
          liveUnmountRef.current = null;
        }, RETENTION_TIME);
      }
    }

    // Disaster
    if (activeTab === 'disaster') {
      setMountDisaster(true);
      if (disasterUnmountRef.current) {
        clearTimeout(disasterUnmountRef.current);
        disasterUnmountRef.current = null;
      }
    } else {
      if (!disasterUnmountRef.current) {
        disasterUnmountRef.current = setTimeout(() => {
          setMountDisaster(false);
          disasterUnmountRef.current = null;
        }, RETENTION_TIME);
      }
    }

    return () => {
      // We don't necessarily want to clear on every activeTab change if we want the timers to persist
    };
  }, [activeTab]);

  // Filter & Search
  const [currentFilter, setCurrentFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState(""); // 实际用于搜索
  const [visibleCount, setVisibleCount] = useState(25);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);

  // Sort State
  const [sortMode, setSortMode] = useState<'publish' | 'fetch'>('publish');
  const [showSortToast, setShowSortToast] = useState(false);
  const sortToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // New Content Logic
  const [newContentCount, setNewContentCount] = useState(0);
  const [pendingNewsData, setPendingNewsData] = useState<NewsItem[] | null>(null);
  const [pendingLastUpdated, setPendingLastUpdated] = useState("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Smart Search Suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showFav, setShowFav] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveDate, setArchiveDate] = useState("");

  // Pull to refresh
  const [pullStartY, setPullStartY] = useState(0);

  const [pullCurrentY, setPullCurrentY] = useState(0);
  const PULL_THRESHOLD = 80;

  // Category Toast
  const [categoryToast, setCategoryToast] = useState<string | null>(null);
  const categoryToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToSearchBar = () => {
    if (searchBarRef.current) {
      const rect = searchBarRef.current.getBoundingClientRect();
      const scrollTop = window.pageYOffset + rect.top - 8;
      window.scrollTo({ top: scrollTop, behavior: "smooth" });
    }
  };

  const handleShowCategoryToast = useCallback((message: string) => {
    setCategoryToast(message);
    if (categoryToastTimeoutRef.current) {
      clearTimeout(categoryToastTimeoutRef.current);
    }
    categoryToastTimeoutRef.current = setTimeout(() => {
      setCategoryToast(null);
    }, 1500);
  }, []);
  // SECTION 1: Manual Trending Keywords
  const trendingNow = ["高市", "滨崎步", "台湾", "逮捕", "香港"];
  const TC_MAP: Record<string, string> = {
    "高市": "高市",
    "滨崎步": "濱崎步",
    "台湾": "台灣",
    "逮捕": "逮捕",
    "香港": "香港"
  };

  const handleTabChange = (tab: 'news' | 'live' | 'disaster') => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    window.scrollTo(0, 0);
    setActiveTab(tab);
    localStorage.setItem("default_tab", tab);
  };

  // --- Initial Mount ---
  // --- Initial Mount ---
  useEffect(() => {
    try {
      const savedFav = localStorage.getItem("favorites");
      if (savedFav) setFavorites(JSON.parse(savedFav));
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
  }, []);

  // 加载下一页归档数据 (Lazy Load)
  const loadMoreHistory = async () => {
    if (Object.keys(archiveIndex).length === 0 || isHistoryLoaded || isSearchingAll) return;

    const allDates = Object.keys(archiveIndex).sort().reverse();
    const nextDate = allDates.find(d => !loadedDates.has(d));

    if (!nextDate) {
      setIsHistoryLoaded(true);
      return;
    }

    setIsSearchingAll(true);
    try {
      const archiveUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/archive/${nextDate}.json`
        : `/archive/${nextDate}.json`;

      const r = await fetch(archiveUrl);
      if (r.ok) {
        const items: NewsItem[] = await r.json();

        // 合并数据并去重
        setAllNewsData(prev => {
          const combined = [...prev, ...items];
          const seen = new Set();
          return combined.filter(item => {
            if (!item.link || seen.has(item.link)) return false;
            seen.add(item.link);
            return true;
          }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });

        setLoadedDates(prev => new Set([...prev, nextDate]));
        console.log(`📚 已加载历史归档: ${nextDate} (${items.length} 条)`);
      }
    } catch (e) {
      console.error(`Failed to load archive ${nextDate}`, e);
    } finally {
      setIsSearchingAll(false);
    }
  };

  // 一键加载全部历史
  const loadAllHistory = async () => {
    if (Object.keys(archiveIndex).length === 0 || isHistoryLoaded) return;

    // 如果已经在加载中，就不重复触发，除非是 loadMore 触发的单次加载，这里强制接管
    if (isSearchingAll) return;

    setIsSearchingAll(true);
    try {
      const allDates = Object.keys(archiveIndex).sort().reverse();
      const unloadedDates = allDates.filter(d => !loadedDates.has(d));

      if (unloadedDates.length === 0) {
        setIsHistoryLoaded(true);
        setIsSearchingAll(false);
        return;
      }

      console.log(`🚀 开始加载剩余历史归档: ${unloadedDates.length} 个文件`);

      // 并发请求，每次 5 个，避免瞬间爆卡
      const BATCH_SIZE = 5;
      let allNewItems: NewsItem[] = [];

      for (let i = 0; i < unloadedDates.length; i += BATCH_SIZE) {
        const batchDates = unloadedDates.slice(i, i + BATCH_SIZE);
        const promises = batchDates.map(date =>
          fetch(R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/archive/${date}.json` : `/archive/${date}.json`)
            .then(r => r.ok ? r.json() : [])
            .catch(e => {
              console.warn(`Failed to load ${date}`, e);
              return [];
            })
        );

        const results = await Promise.all(promises);
        results.forEach(items => allNewItems.push(...items));

        // 每批次更新一次 LoadedDates，避免中间态
        setLoadedDates(prev => {
          const next = new Set(prev);
          batchDates.forEach(d => next.add(d));
          return next;
        });
      }

      setAllNewsData(prev => {
        const combined = [...prev, ...allNewItems];
        const seen = new Set();
        return combined.filter(item => {
          if (!item.link || seen.has(item.link)) return false;
          seen.add(item.link);
          return true;
        }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      });

      setIsHistoryLoaded(true);
      console.log(`✅ 全部历史加载完成，新增 ${allNewItems.length} 条`);

    } catch (e) {
      console.error("Failed to load all history", e);
    } finally {
      setIsSearchingAll(false);
    }
  };

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    let capturedRawData: NewsItem[] = [];

    try {
      // 1. 获取最新 data.json
      const dataUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/data.json?t=${Date.now()}`
        : `/data.json?t=${Date.now()}`;

      let data;
      try {
        const r = await fetch(dataUrl);
        if (!r.ok) throw new Error("Network response was not ok");
        data = await r.json();
      } catch (e) {
        console.warn("Primary data fetch failed, trying local fallback...", e);
        // Fallback to local
        const rFallback = await fetch(`/data.json?t=${Date.now()}`);
        data = await rFallback.json();
      }

      if (data && data.news) {
        setRawNewsData(data.news);
        capturedRawData = data.news;
        setLastUpdated(data.last_updated || "");
        setNewContentCount(0);
        setPendingNewsData(null);
        setPendingLastUpdated("");
      } else if (Array.isArray(data)) {
        setRawNewsData(data);
        capturedRawData = data;
      }

      // 1.5 获取每日简报 (ollama/latest.json)
      try {
        const briefingUrl = `${R2_PUBLIC_URL}/ollama/latest.json?t=${Date.now()}`;
        const rBriefing = await fetch(briefingUrl);
        if (rBriefing.ok) {
          const briefingData = await rBriefing.json();
          setDailyBriefing(briefingData);
        }
      } catch (e) {
        console.error("Failed to fetch daily briefing", e);
      }

      // 2. 获取归档索引 并 预加载最近 3 天
      try {
        const indexUrl = R2_PUBLIC_URL
          ? `${R2_PUBLIC_URL}/archive/index.json?t=${Date.now()}`
          : `/archive/index.json?t=${Date.now()}`;

        let indexData;
        try {
          const rIndex = await fetch(indexUrl);
          if (!rIndex.ok) throw new Error("Network response was not ok");
          indexData = await rIndex.json();
        } catch (e) {
          // Fallback
          const rIndexFallback = await fetch(`/archive/index.json?t=${Date.now()}`);
          if (rIndexFallback.ok) {
            indexData = await rIndexFallback.json();
          }
        }

        if (indexData) {
          setArchiveIndex(indexData);

          // 🚀 核心优化：并行预加载最近 3 个归档
          const allDates = Object.keys(indexData).sort().reverse();
          const PREFETCH_DAYS = 3;
          const prefetchDates = allDates.slice(0, PREFETCH_DAYS);

          console.log(`🚀 正在预加载最近 ${PREFETCH_DAYS} 天归档:`, prefetchDates);

          const prefetchPromises = prefetchDates.map(date =>
            fetch(R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/archive/${date}.json` : `/archive/${date}.json`)
              .then(r => r.ok ? r.json() : [])
              .catch(() => [])
          );

          const prefetchResults = await Promise.all(prefetchPromises);
          const prefetchedItems = prefetchResults.flat();

          // 初始状态下，allNewsData = rawNewsData + prefetched
          setAllNewsData(prev => {
            // 注意：fetchData 可能被 refresh 触发，所以这里 prev 可能是旧数据，
            // 但既然是 refresh，我们最好重置为 capturedRawData + prefetched
            // 不过为了稳妥，我们做一次全量去重合并
            const combined = [...capturedRawData, ...prefetchedItems];
            const seen = new Set();
            return combined.filter(item => {
              if (!item.link || seen.has(item.link)) return false;
              seen.add(item.link);
              return true;
            }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          });

          setLoadedDates(new Set(prefetchDates));
          console.log(`✅ 预加载完成，共 ${prefetchedItems.length} 条`);
        } else {
          setAllNewsData(capturedRawData);
        }

      } catch (e) {
        console.error("Failed to fetch archive index", e);
        setAllNewsData(capturedRawData);
      }

    } catch (e) {
      console.error("Fetch error", e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  // 轮询检查新内容
  const checkForNewContent = useCallback(async () => {
    try {
      const dataUrl = R2_PUBLIC_URL
        ? `${R2_PUBLIC_URL}/data.json?t=${Date.now()}`
        : `/data.json?t=${Date.now()}`;
      const r = await fetch(dataUrl);
      const data = await r.json();

      if (data && data.news && data.last_updated !== lastUpdated) {
        const currentLinks = new Set(rawNewsData.map(item => item.link));
        const newItems = data.news.filter((item: NewsItem) => !currentLinks.has(item.link));

        if (newItems.length > 0) {
          setNewContentCount(newItems.length);
          setPendingNewsData(data.news);
          setPendingLastUpdated(data.last_updated || "");
        }
      }

      // Check briefing updates
      const briefingUrl = `${R2_PUBLIC_URL}/ollama/latest.json?t=${Date.now()}`;
      const rBriefing = await fetch(briefingUrl);
      if (rBriefing.ok) {
        const briefingData = await rBriefing.json();
        setDailyBriefing(briefingData);
      }
    } catch (e) {
      console.error("Check for new content failed", e);
    }
  }, [lastUpdated, rawNewsData]);

  useEffect(() => {
    fetchData();
    pollingIntervalRef.current = setInterval(() => {
      checkForNewContent();
    }, 5 * 60 * 1000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // 更新轮询依赖
  useEffect(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      checkForNewContent();
    }, 5 * 60 * 1000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [checkForNewContent]);

  const loadNewContent = () => {
    if (pendingNewsData) {
      setRawNewsData(pendingNewsData);
      setLastUpdated(pendingLastUpdated);
      setNewContentCount(0);
      setPendingNewsData(null);
      setPendingLastUpdated("");
      window.scrollTo({ top: 0, behavior: "smooth" });

      // 更新最新数据后，如果历史已加载，也应该尝试合并更新 allNewsData
      // 简单起见，这里可以让 loadAllArchiveData 重新判断或不做处理，
      // 因为新内容通常很少，暂时仅更新 rawNewsData。
      // 若要严谨，可将 pendingNewsData merge 到 allNewsData:
      if (isHistoryLoaded) {
        setAllNewsData(prev => {
          const next = [...prev];
          const seen = new Set(next.map(n => n.link));
          pendingNewsData.forEach(item => {
            if (!seen.has(item.link)) next.unshift(item);
          });
          return next.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        });
      }
    }
  };

  // 归档侧边栏数据源准备
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

  // Data Source Decision: Always use allNewsData for consistency
  const dataSource = useMemo(() => {
    if (allNewsData.length > 0) return allNewsData;
    return rawNewsData;
  }, [allNewsData, rawNewsData]);


  // 无限滚动主要逻辑
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 800; // 提前 800px 触发

      if (scrollPos >= threshold) {
        setVisibleCount((prev) => {
          const nextCount = prev + 25;

          // 如果显示数量接近当前已加载的总数，且还有历史可以加载，则触发加载历史
          if (nextCount >= dataSource.length - 10 && !isHistoryLoaded && !isSearchingAll) {
            loadMoreHistory();
          }

          return nextCount;
        });
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dataSource.length, isHistoryLoaded, isSearchingAll]);




  // Section: Hot Keywords (Full Scope Support)
  const hotKeywords = useMemo(() => {
    const source = dataSource;
    if (!source || source.length === 0) return [];

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

    // 只分析最新的 200 条，避免全量分析太卡
    const analysisTarget = source.slice(0, 200);

    if (hasSegmenter) {
      const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' });
      analysisTarget.forEach(item => {
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
  }, [dataSource]);

  // Section: Hot Sources
  const hotSources = useMemo(() => {
    const source = dataSource;
    if (!source || source.length === 0) return [];

    const SOURCE_NAMES = new Set([
      "雅虎新闻", "雅虎", "共同社", "路透社", "路透", "产经新闻", "日本经济新闻", "日经新闻", "朝日新闻", "每日新闻",
      "读卖新闻", "时事通信", "时事通讯社", "日刊体育", "东洋经济", "钻石在线", "中央日报", "朝日电视台",
      "NHK", "TBS", "东京新闻", "富士电视台", "产经体育", "体育日报"
    ]);
    const sourceCounts: Record<string, number> = {};
    // 分析最新的 300 条
    source.slice(0, 300).forEach(item => {
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
  }, [dataSource]);

  // Filtering & Sorting
  const sortedNewsData = useMemo(() => {
    const sorted = [...dataSource].sort((a, b) => {
      if (sortMode === 'fetch') {
        const fetchA = (a as any).fetched_at || a.timestamp || 0;
        const fetchB = (b as any).fetched_at || b.timestamp || 0;
        return fetchB - fetchA;
      } else {
        return (b.timestamp || 0) - (a.timestamp || 0);
      }
    });
    return sorted;
  }, [dataSource, sortMode]);

  const filteredItems = useMemo(() => {
    let filtered = sortedNewsData;

    // Category Filter
    if (currentFilter !== "all") {
      filtered = filtered.filter((item) => {
        const itemCategory = item.category || "其他";
        const itemCategoryKey = CATEGORY_MAP[itemCategory] || "other";
        return itemCategoryKey === currentFilter;
      });
    }

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => {
        const title = (item.title || "").toLowerCase();
        const titleTc = (item.title_tc || "").toLowerCase();
        const titleJa = (item.title_ja || "").toLowerCase();
        const origin = (item.origin || "").toLowerCase();
        return title.includes(q) || titleTc.includes(q) || titleJa.includes(q) || origin.includes(q);
      });
    }

    return filtered;
  }, [sortedNewsData, currentFilter, searchQuery]);

  const displayItems = filteredItems.slice(0, visibleCount);
  const filteredArchiveItems = useMemo(() => archiveData[archiveDate] || [], [archiveData, archiveDate]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {

    if (window.scrollY === 0) setPullStartY(e.touches[0].clientY);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      if (currentY > pullStartY) setPullCurrentY(currentY - pullStartY);
    }
  };
  const handleTouchEnd = async () => {
    if (pullCurrentY > PULL_THRESHOLD) {
      setIsRefreshing(true);
      await fetchData(false);
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

  // Search Helpers
  const handleSearchInput = useCallback((val: string) => {
    setSearchInput(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(val.trim());
      setVisibleCount(25);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);
  }, []);
  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setVisibleCount(25);
  };
  const handleSuggestionClick = (keyword: string) => {
    handleSearchInput(keyword);
    setShowSuggestions(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggleSortMode = () => {
    const newMode = sortMode === 'publish' ? 'fetch' : 'publish';
    setSortMode(newMode);
    setShowSortToast(true);
    if (sortToastTimeoutRef.current) clearTimeout(sortToastTimeoutRef.current);
    sortToastTimeoutRef.current = setTimeout(() => setShowSortToast(false), 2500);
  };

  // Fav Logic
  const handleToggleFav = (e: React.MouseEvent, item: NewsItem) => {
    e.stopPropagation();
    const exists = favorites.some((f) => f.link === item.link);
    let newFavs;
    if (exists) newFavs = favorites.filter((f) => f.link !== item.link);
    else newFavs = [item, ...favorites];
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

  // Count logic for CategoryNav
  const getCategoryCount = useCallback((category: string) => {
    // Determine which dataset to use for counting
    // Always use dataSource (which could be full history or raw)
    const source = dataSource;
    return source.filter(item => {
      const cat = item.category ? (CATEGORY_MAP[item.category] || item.category) : '';
      return cat === category;
    }).length;
  }, [dataSource]);

  const handleFilterChange = (cat: string) => {
    setCurrentFilter(cat);
    setVisibleCount(25);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleSelectArchiveDate = async (dateStr: string) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setArchiveDate(dateStr);
    setShowArchive(true);
    setShowArchiveDrawer(false);
    if (!archiveData[dateStr]) {
      try {
        const archiveUrl = R2_PUBLIC_URL
          ? `${R2_PUBLIC_URL}/archive/${dateStr}.json`
          : `/archive/${dateStr}.json`;
        const r = await fetch(archiveUrl);
        if (r.ok) {
          const items = await r.json();
          setArchiveData(prev => ({ ...prev, [dateStr]: items }));
        }
      } catch (e) {
        console.error(`Failed to load archive for ${dateStr}`, e);
      }
    }
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
        <div className="bg-white dark:bg-[#2c2c2c] rounded-full p-2 shadow-card mt-4">
          <Loader2 className={`w-5 h-5 text-[var(--primary)] ${pullCurrentY > PULL_THRESHOLD || isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* 排序切换提示 Toast */}
      <AnimatePresence>
        {showSortToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-sm font-medium rounded-xl shadow-floating backdrop-blur-sm"
          >
            {sortMode === 'publish'
              ? (settings.lang === "sc" ? "当前排序规则为新闻实际时间顺序" : "當前排序規則為新聞實際時間順序")
              : (settings.lang === "sc" ? "当前排序规则为后台抓取时间顺序" : "當前排序規則為後台抓取時間順序")
            }
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        onOpenFav={() => setShowFav(true)}
        onOpenAbout={() => setShowAbout(true)}
        onOpenSettings={() => setShowSettings(true)}
        onRefresh={handleRefresh}
        favCount={favorites.length}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        disableSticky={showSuggestions || showArchiveDrawer}
      />

      {/* --- Backdrop for Archive Drawer OR Search Suggestions --- */}
      <div
        className={`
          fixed inset-0 z-[100] bg-black/30 backdrop-blur-[3px] transition-all duration-300
          ${(showArchiveDrawer || showSuggestions)
            ? "opacity-100 visible pointer-events-auto"
            : "opacity-0 invisible pointer-events-none"
          }
        `}
        onClick={() => {
          setShowArchiveDrawer(false);
          setShowSuggestions(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      <main className="max-w-[600px] lg:max-w-[1200px] mx-auto pb-10 relative">
        <div className="relative w-full overflow-hidden">
          {/* News Tab - 5-Min Retention Strategy */}
          {mountNews && (
            <div className={activeTab === 'news' ? "block" : "hidden"}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-[600px] lg:max-w-[1200px] mx-auto overflow-hidden"
              >
                {/* Bulletin Board - Now outside Header */}
                <div className="bulletin-container w-full max-w-[600px] lg:max-w-[1200px] mx-auto mb-3 px-4">
                  <BulletinBoard isActive={activeTab === 'news'} />
                </div>

                {/* CategoryNav */}
                <CategoryNav
                  currentFilter={currentFilter}
                  onFilterChange={handleFilterChange}
                  disableSticky={showSuggestions || showArchiveDrawer}
                  onShowToast={handleShowCategoryToast}
                  totalCount={dataSource.length}
                  getCategoryCount={getCategoryCount}
                  isActive={activeTab === 'news'}
                />

                {/* Category Toast - Bottom of Screen */}
                <AnimatePresence>
                  {categoryToast && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3 }}
                      className="fixed inset-x-0 bottom-24 z-[300] flex justify-center pointer-events-none"
                    >
                      <div className="px-4 py-2.5 bg-black/85 text-white text-sm rounded-full shadow-floating backdrop-blur-md whitespace-nowrap flex items-center gap-2 pointer-events-auto">
                        <span>{categoryToast}</span>
                        {/* Show Load All button if not fully loaded (for ANY category) */}
                        {!isHistoryLoaded && !isSearchingAll && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadAllHistory();
                            }}
                            className="ml-1 px-2 py-0.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-full transition-colors"
                          >
                            {settings.lang === 'sc' ? "加载至今全部新闻" : "加載至今全部新聞"}
                          </button>
                        )}
                        {/* Show loading spinner if currently loading all */}
                        {isSearchingAll && (
                          <span className="text-orange-400 text-xs flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {settings.lang === 'sc' ? "加载中..." : "加載中..."}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={searchBarRef} className={`relative max-w-[600px] lg:max-w-[1200px] mx-auto px-4 mb-3.5 ${(showSuggestions || showArchiveDrawer) ? "z-[200]" : "z-30"}`}>
                  {/* Search & Tool Bar */}
                  <div className="search-bar-container w-full max-w-[600px] lg:max-w-[1200px] h-[38px] mx-auto flex items-center px-1 dark:px-2 mt-1.5 backdrop-blur-md">

                    {/* Left: Search Input */}
                    <div className="flex-1 flex items-center h-full px-3 gap-2">
                      {!searchInput ? (
                        <Flame className="w-5 h-5 text-orange-500 shrink-0 fire-emoji" />
                      ) : (
                        <Search className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                      <input
                        ref={input => {
                          // @ts-ignore
                          searchContainerRef.current = input?.parentElement;
                        }}
                        type="text"
                        value={searchInput}
                        onChange={(e) => handleSearchInput(e.target.value)}
                        onFocus={() => {
                          setShowSuggestions(true);
                          setShowArchiveDrawer(false);
                          setTimeout(scrollToSearchBar, 50);
                        }}
                        placeholder={settings.lang === "sc" ? "大家都在搜…" : "大家都在搜…"}
                        className="w-full h-full bg-transparent border-none outline-none text-[15px] placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-700 dark:text-gray-200"
                      />
                      {isSearchingAll && (
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
                      )}
                      {searchInput && (
                        <button onClick={handleClearSearch}>
                          <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                        </button>
                      )}
                    </div>

                    <div className="w-[1px] h-6 bg-gray-200 dark:bg-white/10 shrink-0" />

                    {/* Right: Tools (Archive & Sort) */}
                    <div className="flex items-center gap-1 pl-1 pr-1 dark:pr-2 shrink-0">
                      <button
                        onClick={toggleSortMode}
                        className="flex items-center justify-center w-8 h-[30px] dark:h-[32px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => {
                            const newState = !showArchiveDrawer;
                            setShowArchiveDrawer(newState);
                            setShowSuggestions(false);
                            if (newState) setTimeout(scrollToSearchBar, 50);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 h-[30px] dark:h-[32px] rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-[12px] font-medium">{settings.lang === "sc" ? "存档" : "存檔"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Archive Drawer (Moved here for correct positioning) */}
                  <AnimatePresence>
                    {showArchiveDrawer && (
                      <div className="absolute top-[60px] left-0 right-0 mx-auto w-[300px] z-[200]">
                        <ArchiveDrawer
                          archiveData={archiveData}
                          archiveIndex={archiveIndex}
                          onSelectDate={handleSelectArchiveDate}
                          isOpen={showArchiveDrawer}
                        />
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Search Suggestions Dropdown */}
                  <AnimatePresence>
                    {showSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-[60px] left-0 right-0 mx-auto w-[300px] bg-white/95 dark:bg-[#1a1a2e]/95 backdrop-blur-md rounded-2xl shadow-elevated border border-gray-100 dark:border-white/10 overflow-hidden z-[200]"
                      >
                        <div className="p-3">
                          <div className="mb-3">
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 px-1">{settings.lang === "sc" ? "热门搜索" : "熱門搜索"}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {trendingNow.map(k => (
                                <button
                                  key={k}
                                  onClick={() => handleSuggestionClick(k)}
                                  className="px-2.5 py-1 bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 text-xs rounded-lg hover:bg-orange-100 dark:hover:bg-orange-500/25 transition-colors"
                                >
                                  {settings.lang === "sc" ? k : TC_MAP[k] || k}
                                </button>
                              ))}
                            </div>
                          </div>

                          {hotKeywords.length > 0 && (
                            <div className="mb-3">
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 px-1">{settings.lang === "sc" ? "上升热词" : "上升熱詞"}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {hotKeywords.map(k => (
                                  <button
                                    key={k}
                                    onClick={() => handleSuggestionClick(k)}
                                    className="px-2.5 py-1 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                                  >
                                    {k}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {hotSources.length > 0 && (
                            <div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-2 px-1">{settings.lang === "sc" ? "热门媒体" : "熱門媒體"}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {hotSources.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleSuggestionClick(s)}
                                    className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/25 transition-colors"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* New Content Notification */}
                <AnimatePresence>
                  {newContentCount > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      className="flex justify-center mt-4 mb-2 relative z-30"
                    >
                      <button
                        onClick={loadNewContent}
                        className="group flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-floating shadow-blue-500/30 transition-all active:scale-95"
                      >
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-200 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                        </span>
                        <span className="text-[13px] font-medium tracking-wide">
                          {settings.lang === "sc" ? `发现 ${newContentCount} 条新内容` : `發現 ${newContentCount} 條新內容`}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* News List */}
                <NewsList
                  news={displayItems}
                  isLoading={isLoading}
                  onToggleFav={handleToggleFav}
                  favorites={favorites}
                  onShowArchive={handleSelectArchiveDate}
                  onFilterCategory={handleFilterChange}
                  archiveData={archiveData}
                  dailyBriefing={dailyBriefing}
                />

                {/* Footer / Status */}
                <div className="py-8 text-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
                      <p className="text-xs text-gray-400">
                        {settings.lang === "sc" ? "正在加载内容..." : "正在加載內容..."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">

                      {/* Load All Button - 当历史数据未完全加载时显示 */}
                      {!isHistoryLoaded && !isSearchingAll && (
                        <div className="flex flex-col items-center gap-2">
                          <button
                            onClick={loadAllHistory}
                            className="px-6 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-full transition-colors flex items-center gap-2"
                          >
                            <span>{settings.lang === "sc" ? "加载全部历史数据" : "加載全部歷史數據"}</span>
                          </button>
                          <p className="text-[10px] text-gray-400">
                            {settings.lang === "sc"
                              ? "当前默认仅加载最近 3 天的新闻，点击按钮加载更早的内容"
                              : "當前默認僅加載最近 3 天的新聞，點擊按鈕加載更早的內容"}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-gray-300 dark:text-white/20">
                        {filteredItems.length === 0
                          ? (
                            <div className="flex flex-col items-center gap-2">
                              <span>{settings.lang === "sc" ? "没有找到相关内容" : "沒有找到相關內容"}</span>
                              {!isHistoryLoaded && (
                                <button onClick={loadAllHistory} className="text-blue-400 hover:underline">
                                  {settings.lang === "sc" ? "尝试加载全部历史？" : "嘗試加載全部歷史？"}
                                </button>
                              )}
                            </div>
                          )
                          : (
                            <>
                              {settings.lang === "sc" ? "已加载" : "已加載"} {filteredItems.length} {settings.lang === "sc" ? "条内容" : "條內容"}
                              {isSearchingAll && (
                                <span className="ml-2 inline-flex items-center gap-1 text-orange-400">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  {settings.lang === "sc" ? "正在下载历史归档..." : "正在下載歷史歸檔..."}
                                </span>
                              )}
                            </>
                          )
                        }
                      </p>
                      <BackToTop />
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* Disaster Tab - 5-Min Retention */}
          {mountDisaster && (
            <div className={activeTab === 'disaster' ? "block" : "hidden"}>
              <motion.div
                key="disaster-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <DisasterSection />
              </motion.div>
            </div>
          )}

          {/* Persistent Live View - 5-Min Retention */}
          {mountLive && (
            <div className={activeTab === 'live' ? "block" : "hidden"}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <LiveView />
              </motion.div>
            </div>
          )}
        </div>
      </main >

      {/* Settings Modal */}
      < SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)
        }
        onClearFavorites={handleClearFav}
      />

      {/* About Modal */}
      < AboutModal
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
      />

      {/* Favorites Modal */}
      <FavModal
        isOpen={showFav}
        onClose={() => setShowFav(false)}
        favorites={favorites}
        onRemoveFav={handleRemoveFav}
        onClearFavorites={handleClearFav}
      />

      {/* Archive Detail Modal */}
      <ArchiveModal
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
        dateStr={archiveDate}
        items={filteredArchiveItems}
        onToggleFav={handleToggleFav}
        favorites={favorites}
        currentFilter={currentFilter}
      />

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div >
  );
}