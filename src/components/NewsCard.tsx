"use client";

import React, { memo, useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useTheme } from "./ThemeContext";
import { useAiAnalysis } from "./AiAnalysisContext";
import { formatDistanceToNow } from "date-fns";
import { zhCN, zhTW } from "date-fns/locale";
import Modal from "./Modal";
import { CATEGORY_MAP, CATEGORY_DOT_COLORS } from "@/lib/constants";
import { Heart, ExternalLink, Tag, Sparkles, Loader2, AlertCircle, Clock, Zap, Users, WifiOff, RefreshCcw } from "lucide-react";

export interface NewsItem {
    title: string;
    title_tc?: string;
    title_ja?: string;
    link: string;
    timestamp?: number;
    time_str?: string;
    origin: string;
    category?: string;
    logo?: string;
    description?: string;
}

interface AnalysisResult {
    title: string;
    simplified: string;
    traditional: string;
    original_url: string;
    analyzed_at: string;
}

interface AnalyzeResponse {
    source: "cache" | "generate" | "gemini-3";
    hash_id: string;
    data: AnalysisResult;
    queue_position?: number;
}

interface NewsCardProps {
    item: NewsItem;
    isFav?: boolean;
    onToggleFav?: (e: React.MouseEvent, item: NewsItem) => void;
    onFilterCategory?: (category: string) => void;
}

const SC_TO_TC_CATEGORY: Record<string, string> = {
    "时政": "時政", "经济": "經濟", "社会": "社會", "娱乐": "娛樂",
    "科技": "科技", "体育": "體育", "其他": "其他",
};

const AI_ANALYZE_API = "/api";

function NewsCardComponent({
    item,
    isFav = false,
    onToggleFav,
    onFilterCategory,
}: NewsCardProps) {
    const { settings } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logoError, setLogoError] = useState(false);

    // AI 解读状态
    const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [analyzeSource, setAnalyzeSource] = useState<"cache" | "generate" | "gemini-3" | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [totalTime, setTotalTime] = useState<number | null>(null);
    const [queuePosition, setQueuePosition] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);

    // 本地已读记录状态
    const [isLocallyAnalyzed, setIsLocallyAnalyzed] = useState(false);

    // 初始化时从 localStorage 检查
    useEffect(() => {
        try {
            const analyzedList = JSON.parse(localStorage.getItem('cnjp_ai_history') || '[]');
            if (analyzedList.includes(item.link)) {
                setIsLocallyAnalyzed(true);
            }
        } catch (e) {
            console.error("Local storage error:", e);
        }
    }, [item.link]);

    // 记录到本地的方法
    const markAsAnalyzedLocally = () => {
        try {
            const analyzedList = JSON.parse(localStorage.getItem('cnjp_ai_history') || '[]');
            if (!analyzedList.includes(item.link)) {
                analyzedList.push(item.link);
                // 只保留最近 200 条记录，防止 storage 过大
                const limitedList = analyzedList.slice(-200);
                localStorage.setItem('cnjp_ai_history', JSON.stringify(limitedList));
                setIsLocallyAnalyzed(true);
            }
        } catch (e) {
            console.error("Local storage save error:", e);
        }
    };

    // 缓存状态（是否已解读）
    const [hasCachedAnalysis, setHasCachedAnalysis] = useState<boolean | null>(null);
    const [isCheckingCache, setIsCheckingCache] = useState(false);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const timeDisplay = useMemo(() => {
        if (item.time_str) return item.time_str;
        if (item.timestamp) {
            try {
                return formatDistanceToNow(new Date(item.timestamp * 1000), {
                    addSuffix: true,
                    locale: settings.lang === "sc" ? zhCN : zhTW,
                });
            } catch { return ""; }
        }
        return "";
    }, [item.time_str, item.timestamp, settings.lang]);

    const { displayCategory, categoryKey, dotColor } = useMemo(() => {
        const rawCategory = item.category || "其他";
        let displayCat = rawCategory.substring(0, 2);
        if (settings.lang === "tc") {
            displayCat = SC_TO_TC_CATEGORY[displayCat] || displayCat;
        }
        const catKey = CATEGORY_MAP[rawCategory] || "other";
        const color = CATEGORY_DOT_COLORS[catKey] || "bg-gray-400";
        return { displayCategory: displayCat, categoryKey: catKey, dotColor: color };
    }, [item.category, settings.lang]);

    const displayTitle = useMemo(() => {
        return (settings.lang === "tc" && item.title_tc) ? item.title_tc : item.title;
    }, [settings.lang, item.title, item.title_tc]);

    const handleCategoryClick = () => {
        if (onFilterCategory && item.category) {
            onFilterCategory(categoryKey);
            setIsModalOpen(false);
        }
    };

    const handleAiAnalyze = async (e: React.MouseEvent, forceRefresh: boolean = false) => {
        e.stopPropagation();

        if (aiAnalysis && !forceRefresh) {
            setShowAnalysis(!showAnalysis);
            return;
        }

        if (isAnalyzing || isBackgroundLoading) return;

        setIsAnalyzing(true);
        setAnalyzeError(null);
        setIsOffline(false);
        setElapsedTime(0);
        setTotalTime(null);
        setQueuePosition(0);

        const startTime = Date.now();
        timerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        try {
            const response = await fetch(`${AI_ANALYZE_API}/analyze?t=${Date.now()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.link, title: item.title, title_ja: item.title_ja, force: forceRefresh }),
            });

            if (timerRef.current) clearInterval(timerRef.current);
            const finalTime = Math.floor((Date.now() - startTime) / 1000);
            setTotalTime(finalTime);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData: any = {};
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { detail: `服务器错误 (${response.status}): ${errorText.slice(0, 100)}` };
                }

                if (errorData.offline || response.status === 503 || response.status === 502) {
                    setIsOffline(true);
                    throw new Error(settings.lang === "sc"
                        ? "站长的电脑没开机，等开机后会自动进行解读，请耐心等待。"
                        : "站長的電腦沒開機，等開機後會自動進行解讀，請耐心等待。");
                }

                // 处理付费墙/正文提取失败 (422)
                if (response.status === 422) {
                    throw new Error(settings.lang === "sc"
                        ? "该文章受付费订阅限制或无法抓取正文，AI 无法解读"
                        : "該文章受付費訂閱限制或無法抓取正文，AI 無法解讀");
                }

                throw new Error(errorData.detail || errorData.error || `请求失败: ${response.status}`);
            }

            const result: AnalyzeResponse = await response.json();
            setAiAnalysis(result.data);
            setAnalyzeSource(result.source);
            setShowAnalysis(true);
            markAsAnalyzedLocally(); // 成功后记录到本地
            setIsBackgroundLoading(false);

        } catch (err) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network'))) {
                setIsOffline(true);
                setAnalyzeError(settings.lang === "sc"
                    ? "站长的电脑没开机，等开机后会自动进行解读，请耐心等待。"
                    : "站長的電腦沒開機，等開機後會自動進行解讀，請耐心等待。");
            } else {
                setAnalyzeError(err instanceof Error ? err.message : "分析失败，请重试");
            }
            setIsBackgroundLoading(false);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Modal 打开时，如果已有缓存，直接展示
    const handleCardClick = () => {
        setIsModalOpen(true);
        if (aiAnalysis) {
            setShowAnalysis(true);
        }
    };

    const handleModalClose = () => {
        if (isAnalyzing) setIsBackgroundLoading(true);
        setIsModalOpen(false);
    };

    const analysisContent = useMemo(() => {
        if (!aiAnalysis) return null;
        return settings.lang === "tc" ? aiAnalysis.traditional : aiAnalysis.simplified;
    }, [aiAnalysis, settings.lang]);

    const { queueLength } = useAiAnalysis();

    const loadingHint = useMemo(() => {
        // 优先显示实际排队人数
        const currentQueue = queuePosition > 0 ? queuePosition : queueLength;

        if (currentQueue > 5) {
            return settings.lang === "sc"
                ? `前方还有 ${currentQueue} 个请求正在排队，请耐心等待...`
                : `前方還有 ${currentQueue} 個請求正在排隊，請耐心等待...`;
        }

        // 渐进式提示逻辑
        if (elapsedTime < 5) {
            return settings.lang === "sc" ? "AI 正在阅读全文..." : "AI 正在閱讀全文...";
        } else if (elapsedTime < 12) {
            return settings.lang === "sc"
                ? "您可以暂时离开，AI 将在后台持续解读..."
                : "您可以暫時離開，AI 將在後台持續解讀...";
        } else if (elapsedTime < 20) {
            return settings.lang === "sc"
                ? "受技术或反爬限制，解读内容可能偶有偏差..."
                : "受技術或反爬機制限制，解讀內容可能偶有偏差...";
        } else if (elapsedTime < 28) {
            return settings.lang === "sc"
                ? "深度解读通常需要 30 秒左右，请耐心等待..."
                : "深度解讀通常需要 30 秒左右，請耐心等待...";
        } else {
            return settings.lang === "sc"
                ? "本次由 Google Gemma 3 模型为您解读..."
                : "本次由 Google Gemma 3 模型為您解讀...";
        }
    }, [elapsedTime, queuePosition, queueLength, settings.lang]);

    const isAnalyzed = isLocallyAnalyzed || aiAnalysis !== null;

    return (
        <>
            <div
                onClick={handleCardClick}
                className="news-card-container w-full bg-white dark:bg-white/[0.03] p-4 rounded-2xl shadow-card dark:shadow-none md:hover:shadow-card-hover dark:md:hover:bg-white/[0.06] md:hover:-translate-y-1 active:scale-[0.98] md:active:scale-100 transition-all duration-300 cursor-pointer border border-transparent dark:border-white/5 group relative overflow-hidden"
            >
                {/* 顶部行：收藏 | 分类 | 来源 | 时间 ... AI状态 */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[11px]">
                        {/* 收藏按钮 - 左侧 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(e, item); }}
                            className={`p-1.5 rounded-full transition-all active:scale-90 ${isFav
                                ? "text-[var(--primary)] bg-indigo-50 dark:bg-indigo-900/20"
                                : "text-gray-300 hover:text-[var(--primary)] hover:bg-gray-50 dark:hover:bg-white/5"
                                }`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
                        </button>

                        <span className="text-gray-300 dark:text-gray-800">|</span>

                        {/* 分类 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); handleCategoryClick(); }}
                            className="flex items-center gap-1.5 group/cat"
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="text-gray-500 dark:text-sub group-hover/cat:text-[var(--text-main)] dark:group-hover/cat:text-gray-300 transition-colors font-medium">
                                {displayCategory}
                            </span>
                        </button>

                        <span className="text-gray-300 dark:text-gray-800">|</span>

                        {/* 来源 */}
                        <div className="flex items-center gap-1.5">
                            {item.logo && !logoError && (
                                <Image src={item.logo} alt="" width={12} height={12}
                                    className="object-contain opacity-60 grayscale"
                                    onError={() => setLogoError(true)} loading="lazy" unoptimized />
                            )}
                            <span className="text-[var(--text-aux)] font-medium tracking-wide">{item.origin}</span>
                        </div>

                        <span className="text-[var(--text-aux)] opacity-60">•</span>

                        {/* 时间 */}
                        <span className="text-[var(--text-aux)] tracking-wide opacity-80">{timeDisplay}</span>
                    </div>

                    {/* AI 状态标签 - 右侧极简设计 */}
                    <div className="flex items-center">
                        {(isBackgroundLoading || isAnalyzing) ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 text-[10px] font-bold">
                                <Loader2 className="w-3 h-3 animate-spin" />
                            </div>
                        ) : isAnalyzed ? (
                            <div className="ai-animated-badge flex items-center justify-center w-[22px] h-[22px] rounded-md shadow-sm">
                                <span className="text-[10px] font-black text-white tracking-tighter">AI</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* 标题 */}
                <h3 style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
                    className="text-[16px] font-bold leading-[1.5] text-[var(--text-main)] line-clamp-2 md:group-hover:text-[var(--primary)] transition-colors">
                    {displayTitle}
                </h3>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleModalClose} title="" size={showAnalysis && aiAnalysis ? "wide" : "default"}>
                <div className="flex flex-col px-5 pt-5 pb-5">
                    {/* ===== 顶部按钮栏 ===== */}
                    <div className="flex items-stretch gap-2 pb-3 border-b border-gray-100 dark:border-border">
                        <button
                            onClick={(e) => onToggleFav && onToggleFav(e, item)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${isFav
                                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500"
                                : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-sub hover:bg-gray-200 dark:hover:bg-white/10"
                                }`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`} />
                            <span>{settings.lang === "sc" ? "收藏" : "收藏"}</span>
                        </button>
                        <button
                            onClick={handleCategoryClick}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-sub text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                        >
                            <Tag className="w-3.5 h-3.5" />
                            <span>{displayCategory}</span>
                        </button>
                        <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-sub text-xs font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                        >
                            <span>{settings.lang === "sc" ? "阅读原文" : "閱讀原文"}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    {/* ===== 中间内容区 ===== */}
                    <div className="py-4 pb-12 space-y-3">
                        <h2 className="text-lg font-bold leading-snug text-[var(--text-main)]">
                            {displayTitle}
                        </h2>

                        {item.title_ja && (
                            <h3 className="text-sm font-medium text-gray-500 dark:text-sub leading-relaxed">
                                {item.title_ja}
                            </h3>
                        )}

                        <div className="flex items-center gap-3 text-xs text-[var(--text-sub)]">
                            <span className="font-medium">{item.origin}</span>
                            <span>•</span>
                            <span>{timeDisplay}</span>
                        </div>

                        {/* 分割线 - 仅在有活动时显示 */}
                        {(isAnalyzing || (showAnalysis && aiAnalysis) || analyzeError) && (
                            <div className="h-px bg-gray-100 dark:bg-white/10 my-4" />
                        )}

                        {/* 统一的 AI 分析区域容器 */}
                        {(isAnalyzing || (showAnalysis && aiAnalysis)) && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 pb-2">
                                {/* 统一头部：标题 + 状态徽章 */}
                                <div className="flex items-center justify-between mb-4 select-none">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg transition-colors duration-500 ${isAnalyzing
                                            ? "bg-indigo-50 dark:bg-indigo-500/10"
                                            : "bg-indigo-50 dark:bg-indigo-500/20"
                                            }`}>
                                            {isAnalyzing ? (
                                                <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            )}
                                        </div>
                                        <span className="font-bold text-[var(--text-main)] dark:text-zinc-100 text-base">
                                            AI {settings.lang === "sc" ? "深度解读" : "深度解讀"}
                                        </span>
                                    </div>

                                    {/* 右侧状态/控制区 */}
                                    <div className="flex items-center gap-2">
                                        {isAnalyzing ? (
                                            // 加载中状态
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-medium text-gray-400 tabular-nums">
                                                    {elapsedTime}s
                                                </span>
                                                <div className="h-4 w-[1px] bg-gray-200 dark:bg-white/10" />
                                                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 rounded-full animate-pulse">
                                                    <Zap className="w-3 h-3 opacity-50" />
                                                    {settings.lang === "sc" ? "正在生成..." : "正在生成..."}
                                                </span>
                                            </div>
                                        ) : (
                                            // 完成状态
                                            <>
                                                {analyzeSource === "gemini-3" && (
                                                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/30">
                                                        <Zap className="w-3 h-3" /> Google Gemma 3 ({totalTime || 0}s)
                                                    </span>
                                                )}
                                                {analyzeSource === "generate" && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full border border-orange-100 dark:border-orange-900/30">
                                                        Ollama Qwen
                                                    </span>
                                                )}
                                                {analyzeSource === "cache" && (
                                                    <span className="text-[10px] font-medium px-2 py-0.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                                                        云端缓存
                                                    </span>
                                                )}

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAiAnalysis(null);
                                                        setShowAnalysis(false);
                                                        setAnalyzeSource(null);
                                                        setTotalTime(null);
                                                        setAnalyzeError(null);
                                                        handleAiAnalyze(e, true);
                                                    }}
                                                    disabled={isAnalyzing}
                                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                                                    title={settings.lang === "sc" ? "重新解读" : "重新解讀"}
                                                >
                                                    <RefreshCcw className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 内容区域：骨架屏 vs 真实内容 */}
                                <div className="relative min-h-[100px]">
                                    {isAnalyzing ? (
                                        <div className="space-y-4 animate-pulse pt-2">
                                            {/* 骨架屏 - 模拟文本段落 */}
                                            <div className="space-y-2">
                                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-3/4"></div>
                                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div>
                                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-5/6"></div>
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-2/3"></div>
                                                <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-full"></div>
                                            </div>

                                            {/* 底部进度条与提示 */}
                                            <div className="pt-6 flex flex-col items-center justify-center gap-3 opacity-90">
                                                <div className="w-full max-w-[200px] h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-500/50 transition-all duration-300 ease-out"
                                                        style={{ width: `${Math.min((elapsedTime / 45) * 100, 95)}%` }}
                                                    />
                                                </div>
                                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
                                                    {loadingHint}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none animate-in fade-in duration-500">
                                            <div className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-400 whitespace-pre-wrap font-sans">
                                                {analysisContent}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 错误提示 */}
                        {analyzeError && (
                            <div className="py-4 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{analyzeError}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ===== 底部 AI 解读大按钮 (仅在未开始且未显示时显示) ===== */}
                    {(!isAnalyzing && !(showAnalysis && aiAnalysis) && !analyzeError) && (
                        <div className="pt-3 border-t border-gray-100 dark:border-border px-5 pb-5">
                            <button
                                onClick={handleAiAnalyze}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all bg-[var(--primary)] text-white hover:brightness-110 shadow-lg shadow-[var(--primary)]/20"
                            >
                                <Sparkles className="w-5 h-5" />
                                <span>{settings.lang === "sc" ? "AI 智能解读" : "AI 智能解讀"}</span>
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}

const NewsCard = memo(NewsCardComponent, (prevProps, nextProps) => {
    return (
        prevProps.item.link === nextProps.item.link &&
        prevProps.isFav === nextProps.isFav &&
        prevProps.item.title === nextProps.item.title
    );
});

export default NewsCard;